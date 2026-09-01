alter table public.access_requests
  add column if not exists requested_country_iso2 char(2);

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'access_requests_requested_country_iso2_fkey'
      and conrelid = 'public.access_requests'::regclass
  ) then
    alter table public.access_requests
      add constraint access_requests_requested_country_iso2_fkey
      foreign key (requested_country_iso2)
      references public.country_catalog(iso2)
      on update cascade
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'access_requests_requested_scope_type_check'
      and conrelid = 'public.access_requests'::regclass
  ) then
    alter table public.access_requests
      add constraint access_requests_requested_scope_type_check
      check (
        requested_scope_type is null
        or requested_scope_type in ('national','diocese','vicariate','zone','parish','pastoral_area','organization_unit','entity')
      );
  end if;
end;
$migration$;

create index if not exists access_requests_country_status_idx
  on public.access_requests(requested_country_iso2, status, submitted_at desc)
  where requested_country_iso2 is not null;

comment on column public.access_requests.requested_country_entity_id is
  'Legacy compatibility only. New account requests use requested_country_iso2 as the canonical territorial anchor.';
comment on column public.access_requests.requested_country_iso2 is
  'Canonical ISO-3166 alpha-2 country anchor used to route and authorize account-request review.';

create or replace function app_private.is_requestable_account_scope(
  p_country_iso2 char(2), p_scope_type text, p_scope_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $function$
declare
  v_scope_type text := lower(nullif(btrim(p_scope_type), ''));
begin
  if p_country_iso2 is null then return false; end if;
  if not exists (
    select 1 from public.country_catalog country_row
    where country_row.iso2 = p_country_iso2 and country_row.is_enabled_by_default
  ) then return false; end if;
  if v_scope_type = 'national' then return p_scope_id is null; end if;
  if p_scope_id is null then return false; end if;

  if v_scope_type in ('diocese', 'parish', 'entity') then
    return exists (
      select 1
      from public.ecclesiastical_entities entity_row
      join public.entity_types entity_type on entity_type.id = entity_row.entity_type_id
      where entity_row.id = p_scope_id
        and entity_row.status = 'active'
        and entity_row.visibility = 'public'
        and entity_row.country_iso2 = p_country_iso2
        and (
          v_scope_type = 'entity'
          or (v_scope_type = 'diocese' and entity_type.key in ('archdiocese','diocese','military_ordinariate'))
          or (v_scope_type = 'parish' and entity_type.key in ('parish','quasi_parish'))
        )
    );
  end if;

  if v_scope_type in ('vicariate', 'zone') then
    return exists (
      select 1
      from public.structure_nodes node_row
      join public.structure_levels level_row on level_row.id = node_row.level_id
      where node_row.id = p_scope_id
        and node_row.is_current
        and node_row.status = 'active'
        and node_row.visibility = 'public'
        and level_row.level_key = case when v_scope_type = 'vicariate' then 'vicariate' else 'pastoral_zone' end
        and app_private.resolve_scope_country_iso2(v_scope_type, null, null, null, null, node_row.id) = p_country_iso2
    );
  end if;

  if v_scope_type = 'pastoral_area' then
    return exists (
      select 1 from public.pastoral_areas area_row
      where area_row.id = p_scope_id
        and area_row.status = 'active'
        and area_row.visibility = 'public'
        and app_private.resolve_scope_country_iso2('pastoral_area', null, null, area_row.id, null, null) = p_country_iso2
    );
  end if;

  if v_scope_type = 'organization_unit' then
    return exists (
      select 1 from public.organization_units unit_row
      where unit_row.id = p_scope_id
        and unit_row.is_current
        and unit_row.status = 'active'
        and unit_row.visibility = 'public'
        and app_private.resolve_scope_country_iso2('organization_unit', null, null, null, unit_row.id, null) = p_country_iso2
    );
  end if;

  return false;
end;
$function$;

create or replace function app_private.list_account_request_scopes(p_country_iso2 char(2), p_scope_type text)
returns table(id uuid, name text)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_scope_type text := lower(nullif(btrim(p_scope_type), ''));
begin
  if v_user_id is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  if v_scope_type not in ('diocese','vicariate','zone','parish','pastoral_area','organization_unit','entity') then
    raise exception 'Tipo de ámbito no permitido' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.country_catalog country_row
    where country_row.iso2 = p_country_iso2 and country_row.is_enabled_by_default
  ) then raise exception 'País no disponible para solicitudes' using errcode = '22023'; end if;

  if v_scope_type in ('diocese','parish','entity') then
    return query
      select entity_row.id, entity_row.name
      from public.ecclesiastical_entities entity_row
      where app_private.is_requestable_account_scope(p_country_iso2, v_scope_type, entity_row.id)
      order by entity_row.name;
    return;
  end if;
  if v_scope_type in ('vicariate','zone') then
    return query
      select node_row.id, node_row.name
      from public.structure_nodes node_row
      where app_private.is_requestable_account_scope(p_country_iso2, v_scope_type, node_row.id)
      order by node_row.name;
    return;
  end if;
  if v_scope_type = 'pastoral_area' then
    return query
      select area_row.id, area_row.name
      from public.pastoral_areas area_row
      where app_private.is_requestable_account_scope(p_country_iso2, v_scope_type, area_row.id)
      order by area_row.name;
    return;
  end if;
  return query
    select unit_row.id, unit_row.name
    from public.organization_units unit_row
    where app_private.is_requestable_account_scope(p_country_iso2, v_scope_type, unit_row.id)
    order by unit_row.name;
end;
$function$;

create or replace function public.list_account_request_scopes(p_country_iso2 char(2), p_scope_type text)
returns table(id uuid, name text)
language sql
stable
security invoker
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
as $function$
  select * from app_private.list_account_request_scopes(p_country_iso2, p_scope_type);
$function$;

revoke all on function app_private.is_requestable_account_scope(char(2), text, uuid) from public, anon, authenticated;
revoke all on function app_private.list_account_request_scopes(char(2), text) from public, anon, authenticated;
revoke all on function public.list_account_request_scopes(char(2), text) from public, anon;
grant execute on function public.list_account_request_scopes(char(2), text) to authenticated, service_role;

create or replace function app_private.get_my_account_context()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare v_user_id uuid := auth.uid(); v_result jsonb;
begin
  if v_user_id is null then raise exception 'No autenticado' using errcode='42501'; end if;
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'user_id', p.id, 'email', p.email, 'full_name', p.full_name, 'phone', p.phone,
      'status', p.status, 'person_id', p.person_id, 'registration_source', p.registration_source,
      'preferred_locale', p.preferred_locale, 'timezone', p.timezone, 'avatar_url', p.avatar_url,
      'terms_accepted_at', p.terms_accepted_at, 'terms_version', p.terms_version,
      'privacy_accepted_at', p.privacy_accepted_at, 'privacy_version', p.privacy_version,
      'onboarding_step', p.onboarding_step, 'onboarding_completed_at', p.onboarding_completed_at
    ),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'assignment_id', ura.id, 'role_key', r.key, 'role_name', r.name,
        'scope_type', ura.scope_type, 'scope_entity_id', ura.scope_entity_id
      ) order by r.name)
      from public.user_role_assignments ura join public.roles r on r.id=ura.role_id
      where ura.user_id=p.id and ura.status='active'
        and (ura.starts_at is null or ura.starts_at<=current_date)
        and (ura.ends_at is null or ura.ends_at>=current_date)
    ), '[]'::jsonb),
    'access_requests', coalesce((
      select jsonb_agg(to_jsonb(ar) order by ar.created_at desc)
      from public.access_requests ar where ar.user_id=p.id
    ), '[]'::jsonb),
    'request_options', jsonb_build_object(
      'countries', coalesce((
        select jsonb_agg(jsonb_build_object(
          'iso2', btrim(country_row.iso2::text),
          'name', coalesce(country_row.name_es, country_row.name_en),
          'flag_emoji', country_row.flag_emoji
        ) order by coalesce(country_row.name_es, country_row.name_en))
        from public.country_catalog country_row where country_row.is_enabled_by_default
      ), '[]'::jsonb),
      'roles', coalesce((
        select jsonb_agg(jsonb_build_object('id', role_row.id, 'key', role_row.key, 'name', role_row.name) order by role_row.name)
        from public.roles role_row where role_row.key <> 'super_admin'
      ), '[]'::jsonb)
    )
  ) into v_result
  from public.profiles p where p.id=v_user_id;
  if v_result is null then raise exception 'Perfil de acceso no encontrado' using errcode='22023'; end if;
  return v_result;
end;
$function$;

create or replace function app_private.submit_my_access_request(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_type text := nullif(btrim(payload->>'request_type'),'');
  v_id uuid := nullif(payload->>'request_id','')::uuid;
  v_justification text := nullif(btrim(payload->>'justification'),'');
  v_notes text := nullif(btrim(payload->>'requester_notes'),'');
  v_country_text text := upper(nullif(btrim(payload->>'requested_country_iso2'),''));
  v_country_iso2 char(2);
  v_role_id uuid := nullif(payload->>'requested_role_id','')::uuid;
  v_scope_type text := lower(nullif(btrim(payload->>'requested_scope_type'),''));
  v_scope_id uuid := nullif(payload->>'requested_scope_id','')::uuid;
  v_existing public.access_requests%rowtype;
  v_row public.access_requests%rowtype;
begin
  if v_user_id is null then raise exception 'No autenticado' using errcode='42501'; end if;
  if v_type not in ('initial_access','scope_change','role_change','account_closure') then
    raise exception 'Tipo de solicitud no permitido en autoservicio' using errcode='22023';
  end if;
  if v_justification is null then raise exception 'Debes explicar el motivo' using errcode='22023'; end if;

  if v_id is not null then
    select * into v_existing from public.access_requests
    where id=v_id and user_id=v_user_id and status in ('draft','information_required') for update;
    if not found then raise exception 'Solicitud no modificable' using errcode='22023'; end if;
    if v_existing.request_type is distinct from v_type then
      raise exception 'No puedes cambiar el tipo de una solicitud existente' using errcode='22023';
    end if;
    v_country_text := coalesce(v_country_text, btrim(v_existing.requested_country_iso2::text));
    v_role_id := coalesce(v_role_id, v_existing.requested_role_id);
    v_scope_type := coalesce(v_scope_type, v_existing.requested_scope_type);
    v_scope_id := coalesce(v_scope_id, v_existing.requested_scope_id);
  end if;

  if v_country_text is null or char_length(v_country_text) <> 2 then
    raise exception 'Debes seleccionar un país válido' using errcode='22023';
  end if;
  v_country_iso2 := v_country_text::char(2);
  if not exists (
    select 1 from public.country_catalog country_row
    where country_row.iso2=v_country_iso2 and country_row.is_enabled_by_default
  ) then raise exception 'El país seleccionado no está habilitado para solicitudes' using errcode='22023'; end if;

  if v_type in ('initial_access','account_closure') then
    v_role_id := null; v_scope_type := null; v_scope_id := null;
  elsif v_type='role_change' then
    v_scope_type := null; v_scope_id := null;
    if v_role_id is null or not exists (
      select 1 from public.roles role_row where role_row.id=v_role_id and role_row.key <> 'super_admin'
    ) then raise exception 'Debes seleccionar un rol permitido' using errcode='22023'; end if;
  elsif v_type='scope_change' then
    v_role_id := null;
    if v_scope_type not in ('national','diocese','vicariate','zone','parish','pastoral_area','organization_unit','entity') then
      raise exception 'Debes seleccionar un tipo de ámbito válido' using errcode='22023';
    end if;
    if not app_private.is_requestable_account_scope(v_country_iso2, v_scope_type, v_scope_id) then
      raise exception 'El ámbito seleccionado no pertenece al país o no está disponible' using errcode='22023';
    end if;
  end if;

  if v_id is null and exists (
    select 1 from public.access_requests request_row
    where request_row.user_id=v_user_id and request_row.request_type=v_type
      and request_row.status in ('submitted','under_review','information_required')
  ) then raise exception 'Ya existe una solicitud abierta de este tipo' using errcode='23505'; end if;

  if v_id is null then
    insert into public.access_requests(
      user_id, request_type, status, requested_person_id, requested_country_entity_id, requested_country_iso2,
      requested_role_id, requested_scope_type, requested_scope_id, justification, requester_notes, submitted_at
    ) values (
      v_user_id, v_type, 'submitted', null, null, v_country_iso2,
      v_role_id, v_scope_type, v_scope_id, v_justification, v_notes, now()
    ) returning * into v_row;
  else
    update public.access_requests set
      status='submitted', requested_person_id=null, requested_country_entity_id=null,
      requested_country_iso2=v_country_iso2, requested_role_id=v_role_id,
      requested_scope_type=v_scope_type, requested_scope_id=v_scope_id,
      justification=v_justification, requester_notes=v_notes,
      reviewer_notes=null, submitted_at=now(), reviewed_at=null, reviewed_by=null, updated_at=now()
    where id=v_id returning * into v_row;
  end if;
  return to_jsonb(v_row);
end;
$function$;

create or replace function app_private.admin_review_access_request(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
as $function$
declare
  v_actor uuid := auth.uid();
  v_id uuid := nullif(payload->>'request_id','')::uuid;
  v_decision text := nullif(btrim(payload->>'decision'),'');
  v_notes text := nullif(btrim(payload->>'reviewer_notes'),'');
  v_row public.access_requests%rowtype;
begin
  if v_actor is null or not app_private.current_user_has_permission('users.manage') then
    raise exception 'No autorizado para revisar solicitudes de acceso' using errcode='42501';
  end if;
  if v_decision not in ('under_review','information_required','approved','rejected') then raise exception 'Decisión no permitida' using errcode='22023'; end if;
  if v_decision in ('information_required','rejected') and v_notes is null then raise exception 'Debes indicar el motivo' using errcode='22023'; end if;
  select * into v_row from public.access_requests where id=v_id for update;
  if not found or v_row.status not in ('submitted','under_review','information_required') then raise exception 'Solicitud no disponible' using errcode='22023'; end if;
  if v_row.user_id=v_actor then raise exception 'No puedes revisar tu propia solicitud' using errcode='42501'; end if;
  if not app_private.current_user_has_role(array['super_admin']) then
    if v_row.requested_country_iso2 is null
       or not app_private.current_user_can_manage_country('users.manage', v_row.requested_country_iso2) then
      raise exception 'La solicitud está fuera de tu ámbito territorial' using errcode='42501';
    end if;
  end if;
  update public.access_requests set
    status=v_decision, reviewer_notes=v_notes, reviewed_by=v_actor,
    reviewed_at=case when v_decision in ('approved','rejected') then now() else reviewed_at end, updated_at=now()
  where id=v_id returning * into v_row;
  if v_decision='approved' and v_row.request_type='person_link' and v_row.requested_person_id is not null then
    update public.profiles set person_id=v_row.requested_person_id,updated_at=now()
    where id=v_row.user_id and person_id is null;
  end if;
  return to_jsonb(v_row);
end;
$function$;
