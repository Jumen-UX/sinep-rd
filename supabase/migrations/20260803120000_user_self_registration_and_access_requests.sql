-- Controlled self-registration, personal account context and access-request workflow.
-- Authentication remains in auth.users; profiles remains the access profile;
-- roles and scopes remain exclusively in user_role_assignments.

alter table public.profiles
  add column if not exists person_id uuid references public.persons(id) on delete set null,
  add column if not exists registration_source text not null default 'invitation',
  add column if not exists preferred_locale text not null default 'es-419',
  add column if not exists timezone text not null default 'America/Santo_Domingo',
  add column if not exists avatar_url text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists privacy_version text;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_registration_source_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_registration_source_check
      check (registration_source in ('invitation', 'self_registration', 'administrative_provisioning'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_preferred_locale_length_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_preferred_locale_length_check
      check (char_length(preferred_locale) between 2 and 35);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_timezone_length_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_timezone_length_check
      check (char_length(timezone) between 1 and 80);
  end if;
end;
$migration$;

create unique index if not exists profiles_person_id_unique_idx
  on public.profiles(person_id)
  where person_id is not null;

create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_type text not null,
  status text not null default 'draft',
  requested_person_id uuid references public.persons(id) on delete set null,
  requested_country_entity_id uuid references public.ecclesiastical_entities(id) on delete set null,
  requested_role_id uuid references public.roles(id) on delete set null,
  requested_scope_type text,
  requested_scope_id uuid,
  justification text,
  requester_notes text,
  reviewer_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_requests_type_check check (
    request_type in ('initial_access', 'person_link', 'scope_change', 'role_change', 'account_closure')
  ),
  constraint access_requests_status_check check (
    status in ('draft', 'submitted', 'under_review', 'information_required', 'approved', 'rejected', 'cancelled')
  ),
  constraint access_requests_justification_length_check check (
    justification is null or char_length(justification) <= 4000
  ),
  constraint access_requests_requester_notes_length_check check (
    requester_notes is null or char_length(requester_notes) <= 4000
  ),
  constraint access_requests_reviewer_notes_length_check check (
    reviewer_notes is null or char_length(reviewer_notes) <= 4000
  )
);

create index if not exists access_requests_user_status_idx
  on public.access_requests(user_id, status, created_at desc);
create index if not exists access_requests_review_queue_idx
  on public.access_requests(status, submitted_at)
  where status in ('submitted', 'under_review', 'information_required');
create index if not exists access_requests_requested_person_idx
  on public.access_requests(requested_person_id)
  where requested_person_id is not null;

alter table public.access_requests enable row level security;

drop policy if exists access_requests_select_own on public.access_requests;
create policy access_requests_select_own
  on public.access_requests
  for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.access_requests from public, anon, authenticated;
grant select on table public.access_requests to authenticated;

create or replace function app_private.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_full_name text;
  v_registration_source text;
begin
  v_full_name := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'name'), ''),
    nullif(btrim(new.email), ''),
    'Usuario SINEP'
  );

  v_registration_source := case
    when new.raw_user_meta_data->>'registration_source' = 'self_registration'
      then 'self_registration'
    when new.raw_user_meta_data->>'registration_source' = 'administrative_provisioning'
      then 'administrative_provisioning'
    else 'invitation'
  end;

  insert into public.profiles (
    id,
    email,
    full_name,
    status,
    registration_source,
    preferred_locale,
    timezone
  )
  values (
    new.id,
    coalesce(new.email, ''),
    v_full_name,
    'pending_invitation',
    v_registration_source,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'preferred_locale'), ''), 'es-419'),
    coalesce(nullif(btrim(new.raw_user_meta_data->>'timezone'), ''), 'America/Santo_Domingo')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
    registration_source = public.profiles.registration_source,
    updated_at = now();

  return new;
end;
$function$;

create or replace function app_private.get_my_account_context()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
stable
as $function$
declare
  v_user_id uuid := auth.uid();
  v_context jsonb;
begin
  if v_user_id is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'user_id', p.id,
      'email', p.email,
      'full_name', p.full_name,
      'phone', p.phone,
      'status', p.status,
      'person_id', p.person_id,
      'registration_source', p.registration_source,
      'preferred_locale', p.preferred_locale,
      'timezone', p.timezone,
      'avatar_url', p.avatar_url,
      'terms_accepted_at', p.terms_accepted_at,
      'terms_version', p.terms_version,
      'privacy_accepted_at', p.privacy_accepted_at,
      'privacy_version', p.privacy_version,
      'onboarding_step', p.onboarding_step,
      'onboarding_completed_at', p.onboarding_completed_at
    ),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'assignment_id', ura.id,
        'role_key', r.key,
        'role_name', r.name,
        'scope_type', ura.scope_type,
        'scope_entity_id', ura.scope_entity_id
      ) order by r.name)
      from public.user_role_assignments ura
      join public.roles r on r.id = ura.role_id
      where ura.user_id = p.id
        and ura.status = 'active'
        and (ura.starts_at is null or ura.starts_at <= now())
        and (ura.ends_at is null or ura.ends_at >= now())
    ), '[]'::jsonb),
    'access_requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ar.id,
        'request_type', ar.request_type,
        'status', ar.status,
        'requested_person_id', ar.requested_person_id,
        'requested_country_entity_id', ar.requested_country_entity_id,
        'requested_role_id', ar.requested_role_id,
        'requested_scope_type', ar.requested_scope_type,
        'requested_scope_id', ar.requested_scope_id,
        'justification', ar.justification,
        'requester_notes', ar.requester_notes,
        'reviewer_notes', ar.reviewer_notes,
        'submitted_at', ar.submitted_at,
        'reviewed_at', ar.reviewed_at,
        'cancelled_at', ar.cancelled_at,
        'created_at', ar.created_at,
        'updated_at', ar.updated_at
      ) order by ar.created_at desc)
      from public.access_requests ar
      where ar.user_id = p.id
    ), '[]'::jsonb)
  )
  into v_context
  from public.profiles p
  where p.id = v_user_id;

  if v_context is null then
    raise exception 'Perfil de acceso no encontrado' using errcode = '22023';
  end if;

  return v_context;
end;
$function$;

create or replace function app_private.save_my_account_profile(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_full_name text := nullif(btrim(payload->>'full_name'), '');
  v_phone text := nullif(btrim(payload->>'phone'), '');
  v_locale text := coalesce(nullif(btrim(payload->>'preferred_locale'), ''), 'es-419');
  v_timezone text := coalesce(nullif(btrim(payload->>'timezone'), ''), 'America/Santo_Domingo');
  v_avatar_url text := nullif(btrim(payload->>'avatar_url'), '');
  v_terms_version text := nullif(btrim(payload->>'terms_version'), '');
  v_privacy_version text := nullif(btrim(payload->>'privacy_version'), '');
begin
  if v_user_id is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  if v_full_name is null or char_length(v_full_name) > 180 then
    raise exception 'El nombre completo es obligatorio y no puede superar 180 caracteres' using errcode = '22023';
  end if;
  if v_phone is not null and char_length(v_phone) > 80 then
    raise exception 'El teléfono no puede superar 80 caracteres' using errcode = '22023';
  end if;
  if char_length(v_locale) not between 2 and 35 then
    raise exception 'La configuración regional no es válida' using errcode = '22023';
  end if;
  if char_length(v_timezone) not between 1 and 80 then
    raise exception 'La zona horaria no es válida' using errcode = '22023';
  end if;
  if v_avatar_url is not null and v_avatar_url !~ '^https://'
  then
    raise exception 'La fotografía debe utilizar una URL HTTPS' using errcode = '22023';
  end if;

  update public.profiles
  set full_name = v_full_name,
      phone = v_phone,
      preferred_locale = v_locale,
      timezone = v_timezone,
      avatar_url = v_avatar_url,
      terms_accepted_at = case
        when v_terms_version is not null and terms_version is distinct from v_terms_version then now()
        else terms_accepted_at
      end,
      terms_version = coalesce(v_terms_version, terms_version),
      privacy_accepted_at = case
        when v_privacy_version is not null and privacy_version is distinct from v_privacy_version then now()
        else privacy_accepted_at
      end,
      privacy_version = coalesce(v_privacy_version, privacy_version),
      onboarding_step = case when onboarding_step = 'profile' then 'access' else onboarding_step end,
      onboarding_updated_at = now(),
      updated_at = now()
  where id = v_user_id;

  if not found then
    raise exception 'Perfil de acceso no encontrado' using errcode = '22023';
  end if;

  return app_private.get_my_account_context();
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
  v_request_type text := nullif(btrim(payload->>'request_type'), '');
  v_request_id uuid := nullif(payload->>'request_id', '')::uuid;
  v_justification text := nullif(btrim(payload->>'justification'), '');
  v_requester_notes text := nullif(btrim(payload->>'requester_notes'), '');
  v_row public.access_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  if v_request_type not in ('initial_access', 'person_link', 'scope_change', 'role_change', 'account_closure') then
    raise exception 'Tipo de solicitud no permitido' using errcode = '22023';
  end if;
  if v_justification is null then
    raise exception 'Debes explicar el motivo de la solicitud' using errcode = '22023';
  end if;

  if v_request_id is null and exists (
    select 1
    from public.access_requests ar
    where ar.user_id = v_user_id
      and ar.request_type = v_request_type
      and ar.status in ('submitted', 'under_review', 'information_required')
  ) then
    raise exception 'Ya existe una solicitud abierta de este tipo' using errcode = '23505';
  end if;

  if v_request_id is null then
    insert into public.access_requests (
      user_id,
      request_type,
      status,
      requested_person_id,
      requested_country_entity_id,
      requested_role_id,
      requested_scope_type,
      requested_scope_id,
      justification,
      requester_notes,
      submitted_at
    ) values (
      v_user_id,
      v_request_type,
      'submitted',
      nullif(payload->>'requested_person_id', '')::uuid,
      nullif(payload->>'requested_country_entity_id', '')::uuid,
      nullif(payload->>'requested_role_id', '')::uuid,
      nullif(btrim(payload->>'requested_scope_type'), ''),
      nullif(payload->>'requested_scope_id', '')::uuid,
      v_justification,
      v_requester_notes,
      now()
    ) returning * into v_row;
  else
    update public.access_requests
    set request_type = v_request_type,
        status = 'submitted',
        requested_person_id = nullif(payload->>'requested_person_id', '')::uuid,
        requested_country_entity_id = nullif(payload->>'requested_country_entity_id', '')::uuid,
        requested_role_id = nullif(payload->>'requested_role_id', '')::uuid,
        requested_scope_type = nullif(btrim(payload->>'requested_scope_type'), ''),
        requested_scope_id = nullif(payload->>'requested_scope_id', '')::uuid,
        justification = v_justification,
        requester_notes = v_requester_notes,
        reviewer_notes = null,
        submitted_at = now(),
        reviewed_at = null,
        reviewed_by = null,
        updated_at = now()
    where id = v_request_id
      and user_id = v_user_id
      and status in ('draft', 'information_required')
    returning * into v_row;

    if not found then
      raise exception 'La solicitud no existe o ya no puede modificarse' using errcode = '22023';
    end if;
  end if;

  return to_jsonb(v_row);
end;
$function$;

create or replace function app_private.cancel_my_access_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_row public.access_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  update public.access_requests
  set status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
  where id = p_request_id
    and user_id = v_user_id
    and status in ('draft', 'submitted', 'information_required')
  returning * into v_row;

  if not found then
    raise exception 'La solicitud no existe o ya no puede cancelarse' using errcode = '22023';
  end if;

  return to_jsonb(v_row);
end;
$function$;

create or replace function app_private.admin_review_access_request(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_request_id uuid := nullif(payload->>'request_id', '')::uuid;
  v_decision text := nullif(btrim(payload->>'decision'), '');
  v_notes text := nullif(btrim(payload->>'reviewer_notes'), '');
  v_row public.access_requests%rowtype;
begin
  if v_actor_id is null or not app_private.current_user_has_permission('users.manage') then
    raise exception 'No autorizado para revisar solicitudes de acceso' using errcode = '42501';
  end if;
  if v_request_id is null then
    raise exception 'Debes seleccionar una solicitud' using errcode = '22023';
  end if;
  if v_decision not in ('under_review', 'information_required', 'approved', 'rejected') then
    raise exception 'Decisión no permitida' using errcode = '22023';
  end if;
  if v_decision in ('information_required', 'rejected') and v_notes is null then
    raise exception 'Debes indicar el motivo de la decisión' using errcode = '22023';
  end if;

  select * into v_row
  from public.access_requests
  where id = v_request_id
  for update;

  if not found or v_row.status not in ('submitted', 'under_review', 'information_required') then
    raise exception 'La solicitud no está disponible para revisión' using errcode = '22023';
  end if;
  if v_row.user_id = v_actor_id then
    raise exception 'No puedes revisar tu propia solicitud' using errcode = '42501';
  end if;

  update public.access_requests
  set status = v_decision,
      reviewer_notes = v_notes,
      reviewed_by = v_actor_id,
      reviewed_at = case when v_decision in ('approved', 'rejected') then now() else reviewed_at end,
      updated_at = now()
  where id = v_request_id
  returning * into v_row;

  if v_decision = 'approved'
     and v_row.request_type = 'person_link'
     and v_row.requested_person_id is not null then
    update public.profiles
    set person_id = v_row.requested_person_id,
        updated_at = now()
    where id = v_row.user_id
      and person_id is null;
  end if;

  return to_jsonb(v_row);
end;
$function$;

create or replace function public.get_my_account_context()
returns jsonb
language sql
security invoker
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
stable
as $function$
  select app_private.get_my_account_context();
$function$;

create or replace function public.save_my_account_profile(payload jsonb)
returns jsonb
language sql
security invoker
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
as $function$
  select app_private.save_my_account_profile(payload);
$function$;

create or replace function public.submit_my_access_request(payload jsonb)
returns jsonb
language sql
security invoker
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
as $function$
  select app_private.submit_my_access_request(payload);
$function$;

create or replace function public.cancel_my_access_request(p_request_id uuid)
returns jsonb
language sql
security invoker
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
as $function$
  select app_private.cancel_my_access_request(p_request_id);
$function$;

create or replace function public.admin_review_access_request(payload jsonb)
returns jsonb
language sql
security invoker
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
as $function$
  select app_private.admin_review_access_request(payload);
$function$;

revoke all on function app_private.get_my_account_context() from public, anon, authenticated;
revoke all on function app_private.save_my_account_profile(jsonb) from public, anon, authenticated;
revoke all on function app_private.submit_my_access_request(jsonb) from public, anon, authenticated;
revoke all on function app_private.cancel_my_access_request(uuid) from public, anon, authenticated;
revoke all on function app_private.admin_review_access_request(jsonb) from public, anon, authenticated;

revoke all on function public.get_my_account_context() from public, anon;
revoke all on function public.save_my_account_profile(jsonb) from public, anon;
revoke all on function public.submit_my_access_request(jsonb) from public, anon;
revoke all on function public.cancel_my_access_request(uuid) from public, anon;
revoke all on function public.admin_review_access_request(jsonb) from public, anon;

grant execute on function public.get_my_account_context() to authenticated, service_role;
grant execute on function public.save_my_account_profile(jsonb) to authenticated, service_role;
grant execute on function public.submit_my_access_request(jsonb) to authenticated, service_role;
grant execute on function public.cancel_my_access_request(uuid) to authenticated, service_role;
grant execute on function public.admin_review_access_request(jsonb) to authenticated, service_role;

comment on table public.access_requests is
  'User-owned requests for initial access, person linking, role or scope changes and account closure. Approval never grants roles automatically.';
