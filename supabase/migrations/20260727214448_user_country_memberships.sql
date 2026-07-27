begin;

create table if not exists app_private.user_country_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  country_iso2 char(2) not null references public.country_catalog(iso2) on update cascade on delete restrict,
  country_entity_id uuid not null references public.ecclesiastical_entities(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'inactive')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  ended_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_country_memberships_user_country_key unique (user_id, country_iso2),
  constraint user_country_memberships_status_dates_check check (
    (status = 'active' and ended_at is null)
    or (status = 'inactive' and ended_at is not null)
  )
);

create table if not exists app_private.user_country_membership_sources (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references app_private.user_country_memberships(id) on delete cascade,
  source_type text not null check (source_type in ('invitation', 'role_assignment', 'backfill', 'manual')),
  role_assignment_id uuid references public.user_role_assignments(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint user_country_membership_sources_role_check check (
    (source_type = 'role_assignment' and role_assignment_id is not null)
    or (source_type <> 'role_assignment' and role_assignment_id is null)
  ),
  constraint user_country_membership_sources_status_dates_check check (
    (status = 'active' and ended_at is null)
    or (status = 'inactive' and ended_at is not null)
  ),
  constraint user_country_membership_sources_identity_key
    unique nulls not distinct (membership_id, source_type, role_assignment_id)
);

create index if not exists user_country_memberships_country_active_idx
  on app_private.user_country_memberships(country_iso2, user_id)
  where status = 'active';

create index if not exists user_country_membership_sources_assignment_idx
  on app_private.user_country_membership_sources(role_assignment_id)
  where role_assignment_id is not null;

alter table app_private.user_country_memberships enable row level security;
alter table app_private.user_country_membership_sources enable row level security;

revoke all on table app_private.user_country_memberships from public, anon, authenticated;
revoke all on table app_private.user_country_membership_sources from public, anon, authenticated;

create or replace function app_private.validate_user_country_membership_row()
returns trigger
language plpgsql
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_country_iso2 char(2);
begin
  select entity_row.country_iso2
  into v_country_iso2
  from public.ecclesiastical_entities entity_row
  join public.entity_types type_row
    on type_row.id = entity_row.entity_type_id
   and type_row.key = 'country'
  where entity_row.id = new.country_entity_id
    and entity_row.status = 'active'
  limit 1;

  if v_country_iso2 is null then
    raise exception 'La membresía requiere una entidad país activa.' using errcode = '23514';
  end if;

  if upper(new.country_iso2::text)::char(2) <> v_country_iso2 then
    raise exception 'El código de país de la membresía no coincide con la entidad país.' using errcode = '23514';
  end if;

  new.country_iso2 := v_country_iso2;
  new.updated_at := now();

  if new.status = 'active' then
    new.ended_at := null;
    new.ended_by := null;
  elsif new.ended_at is null then
    new.ended_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists validate_user_country_membership_row
  on app_private.user_country_memberships;

create trigger validate_user_country_membership_row
before insert or update
on app_private.user_country_memberships
for each row
execute function app_private.validate_user_country_membership_row();

create or replace function app_private.refresh_user_country_membership(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_has_active_source boolean;
begin
  select exists (
    select 1
    from app_private.user_country_membership_sources source_row
    where source_row.membership_id = p_membership_id
      and source_row.status = 'active'
  )
  into v_has_active_source;

  update app_private.user_country_memberships membership_row
  set
    status = case when v_has_active_source then 'active' else 'inactive' end,
    ended_at = case when v_has_active_source then null else coalesce(membership_row.ended_at, now()) end,
    ended_by = case when v_has_active_source then null else coalesce(membership_row.ended_by, auth.uid()) end,
    updated_at = now()
  where membership_row.id = p_membership_id;
end;
$$;

create or replace function app_private.refresh_user_country_membership_from_source()
returns trigger
language plpgsql
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_membership_id uuid;
begin
  v_membership_id := case when tg_op = 'DELETE' then old.membership_id else new.membership_id end;
  perform app_private.refresh_user_country_membership(v_membership_id);
  return null;
end;
$$;

drop trigger if exists refresh_user_country_membership_from_source
  on app_private.user_country_membership_sources;

create trigger refresh_user_country_membership_from_source
after insert or update or delete
on app_private.user_country_membership_sources
for each row
execute function app_private.refresh_user_country_membership_from_source();

create or replace function app_private.ensure_user_country_membership(
  p_user_id uuid,
  p_country_entity_id uuid,
  p_source_type text,
  p_role_assignment_id uuid default null,
  p_actor_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_country_iso2 char(2);
  v_membership_id uuid;
  v_actor_id uuid := coalesce(p_actor_id, auth.uid());
begin
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Usuario de membresía no encontrado.' using errcode = '22023';
  end if;

  if p_source_type not in ('invitation', 'role_assignment', 'backfill', 'manual') then
    raise exception 'Origen de membresía no permitido.' using errcode = '22023';
  end if;

  if (p_source_type = 'role_assignment') <> (p_role_assignment_id is not null) then
    raise exception 'El origen role_assignment requiere una asignación y los demás orígenes no la aceptan.' using errcode = '22023';
  end if;

  select entity_row.country_iso2
  into v_country_iso2
  from public.ecclesiastical_entities entity_row
  join public.entity_types type_row
    on type_row.id = entity_row.entity_type_id
   and type_row.key = 'country'
  where entity_row.id = p_country_entity_id
    and entity_row.status = 'active'
  limit 1;

  if v_country_iso2 is null then
    raise exception 'La entidad seleccionada no es un país activo.' using errcode = '22023';
  end if;

  insert into app_private.user_country_memberships (
    user_id,
    country_iso2,
    country_entity_id,
    status,
    started_at,
    created_by
  ) values (
    p_user_id,
    v_country_iso2,
    p_country_entity_id,
    'active',
    now(),
    v_actor_id
  )
  on conflict (user_id, country_iso2)
  do update set
    country_entity_id = excluded.country_entity_id,
    status = 'active',
    ended_at = null,
    ended_by = null,
    updated_at = now()
  returning id into v_membership_id;

  insert into app_private.user_country_membership_sources (
    membership_id,
    source_type,
    role_assignment_id,
    status,
    created_by
  ) values (
    v_membership_id,
    p_source_type,
    p_role_assignment_id,
    'active',
    v_actor_id
  )
  on conflict on constraint user_country_membership_sources_identity_key
  do update set
    status = 'active',
    ended_at = null,
    updated_at = now(),
    created_by = coalesce(app_private.user_country_membership_sources.created_by, excluded.created_by);

  return v_membership_id;
end;
$$;

create or replace function app_private.current_user_can_manage_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  select
    current_setting('request.jwt.claim.role', true) = 'service_role'
    or (
      auth.uid() is not null
      and exists (
        select 1
        from public.profiles actor_profile
        where actor_profile.id = auth.uid()
          and actor_profile.status = 'active'
      )
      and (
        app_private.current_user_has_role(array['super_admin'])
        or (
          not exists (
            select 1
            from public.user_role_assignments target_assignment
            join public.roles target_role on target_role.id = target_assignment.role_id
            where target_assignment.user_id = p_user_id
              and target_role.key = 'super_admin'
              and target_assignment.status = 'active'
              and target_assignment.starts_at <= current_date
              and (target_assignment.ends_at is null or target_assignment.ends_at >= current_date)
          )
          and exists (
            select 1
            from app_private.user_country_memberships membership_row
            where membership_row.user_id = p_user_id
              and membership_row.status = 'active'
              and app_private.current_user_can_access_country(membership_row.country_iso2)
          )
        )
      )
    );
$$;

create or replace function app_private.sync_role_assignment_country_membership()
returns trigger
language plpgsql
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_country_entity_id uuid;
  v_actor_id uuid;
begin
  if tg_op = 'DELETE' then
    update app_private.user_country_membership_sources source_row
    set
      status = 'inactive',
      ended_at = coalesce(source_row.ended_at, now()),
      updated_at = now()
    where source_row.source_type = 'role_assignment'
      and source_row.role_assignment_id = old.id
      and source_row.status = 'active';

    return old;
  end if;

  if tg_op = 'UPDATE'
     and (
       old.user_id is distinct from new.user_id
       or old.country_iso2 is distinct from new.country_iso2
       or new.status <> 'active'
     ) then
    update app_private.user_country_membership_sources source_row
    set
      status = 'inactive',
      ended_at = coalesce(source_row.ended_at, now()),
      updated_at = now()
    where source_row.source_type = 'role_assignment'
      and source_row.role_assignment_id = old.id
      and source_row.status = 'active';
  end if;

  if new.status = 'active'
     and new.country_iso2 is not null then
    select entity_row.id
    into v_country_entity_id
    from public.ecclesiastical_entities entity_row
    join public.entity_types type_row
      on type_row.id = entity_row.entity_type_id
     and type_row.key = 'country'
    where entity_row.country_iso2 = new.country_iso2
      and entity_row.status = 'active'
    order by entity_row.updated_at desc, entity_row.id
    limit 1;

    if v_country_entity_id is null then
      raise exception 'No existe una entidad país activa para la asignación de rol.' using errcode = '23514';
    end if;

    v_actor_id := coalesce(auth.uid(), new.created_by);
    perform app_private.ensure_user_country_membership(
      new.user_id,
      v_country_entity_id,
      'role_assignment',
      new.id,
      v_actor_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists sync_role_assignment_country_membership
  on public.user_role_assignments;

create trigger sync_role_assignment_country_membership
after insert or update or delete
on public.user_role_assignments
for each row
execute function app_private.sync_role_assignment_country_membership();

do $$
declare
  v_default_country_entity_id uuid;
  v_assignment_country_entity_id uuid;
  assignment_row record;
  user_row record;
begin
  select entity_row.id
  into v_default_country_entity_id
  from public.ecclesiastical_entities entity_row
  join public.entity_types type_row
    on type_row.id = entity_row.entity_type_id
   and type_row.key = 'country'
  where entity_row.country_iso2 = 'DO'
    and entity_row.status = 'active'
  order by entity_row.updated_at desc, entity_row.id
  limit 1;

  if v_default_country_entity_id is null then
    raise exception 'No existe una entidad país activa para República Dominicana (DO).';
  end if;

  for assignment_row in
    select assignment.id, assignment.user_id, assignment.country_iso2, assignment.created_by
    from public.user_role_assignments assignment
    where assignment.status = 'active'
      and assignment.country_iso2 is not null
      and assignment.starts_at <= current_date
      and (assignment.ends_at is null or assignment.ends_at >= current_date)
  loop
    select entity_row.id
    into v_assignment_country_entity_id
    from public.ecclesiastical_entities entity_row
    join public.entity_types type_row
      on type_row.id = entity_row.entity_type_id
     and type_row.key = 'country'
    where entity_row.country_iso2 = assignment_row.country_iso2
      and entity_row.status = 'active'
    order by entity_row.updated_at desc, entity_row.id
    limit 1;

    perform app_private.ensure_user_country_membership(
      assignment_row.user_id,
      v_assignment_country_entity_id,
      'role_assignment',
      assignment_row.id,
      assignment_row.created_by
    );
  end loop;

  for user_row in
    select auth_user.id
    from auth.users auth_user
  loop
    perform app_private.ensure_user_country_membership(
      user_row.id,
      v_default_country_entity_id,
      'backfill',
      null,
      null
    );
  end loop;
end;
$$;

create or replace function app_private.validate_admin_country_scope(payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_country_entity_id uuid := nullif(payload->>'country_entity_id', '')::uuid;
  v_country_iso2 char(2);
  v_country_name text;
begin
  if v_actor_id is null or not (
    app_private.current_user_has_permission('users.manage')
    or app_private.current_user_has_permission('users.assign_roles')
    or app_private.current_user_is_super_or_national()
  ) then
    raise exception 'No autorizado para validar países administrativos.' using errcode = '42501';
  end if;

  if v_country_entity_id is null then
    raise exception 'Debes seleccionar el país administrativo.' using errcode = '22023';
  end if;

  select entity_row.country_iso2, entity_row.name
  into v_country_iso2, v_country_name
  from public.ecclesiastical_entities entity_row
  join public.entity_types type_row
    on type_row.id = entity_row.entity_type_id
   and type_row.key = 'country'
  where entity_row.id = v_country_entity_id
    and entity_row.status = 'active'
  limit 1;

  if v_country_iso2 is null then
    raise exception 'La entidad seleccionada no es un país activo.' using errcode = '22023';
  end if;

  if not app_private.current_user_has_role(array['super_admin'])
     and not app_private.current_user_can_access_country(v_country_iso2) then
    raise exception 'El país seleccionado no está disponible dentro de tu alcance.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'country_entity_id', v_country_entity_id,
    'country_iso2', v_country_iso2,
    'country_name', v_country_name
  );
end;
$$;

create or replace function app_private.admin_register_user_country_membership(payload jsonb)
returns jsonb
language plpgsql
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_user_id uuid := nullif(payload->>'user_id', '')::uuid;
  v_source_type text := coalesce(nullif(payload->>'source_type', ''), 'invitation');
  v_country jsonb;
  v_country_entity_id uuid;
  v_country_iso2 char(2);
  v_membership_id uuid;
begin
  if v_actor_id is null or not (
    app_private.current_user_has_permission('users.manage')
    or app_private.current_user_has_permission('users.assign_roles')
    or app_private.current_user_is_super_or_national()
  ) then
    raise exception 'No autorizado para registrar membresías administrativas.' using errcode = '42501';
  end if;

  if v_user_id is null or not exists (select 1 from auth.users where id = v_user_id) then
    raise exception 'Usuario no encontrado en Supabase Auth.' using errcode = '22023';
  end if;

  if v_source_type not in ('invitation', 'manual') then
    raise exception 'Origen de membresía administrativa no permitido.' using errcode = '22023';
  end if;

  if not app_private.current_user_has_role(array['super_admin'])
     and exists (
       select 1
       from public.user_role_assignments assignment
       join public.roles role_row on role_row.id = assignment.role_id
       where assignment.user_id = v_user_id
         and role_row.key = 'super_admin'
         and assignment.status = 'active'
         and assignment.starts_at <= current_date
         and (assignment.ends_at is null or assignment.ends_at >= current_date)
     ) then
    raise exception 'Solo un superadministrador puede gestionar membresías de otro superadministrador.' using errcode = '42501';
  end if;

  v_country := app_private.validate_admin_country_scope(payload);
  v_country_entity_id := (v_country->>'country_entity_id')::uuid;
  v_country_iso2 := (v_country->>'country_iso2')::char(2);

  v_membership_id := app_private.ensure_user_country_membership(
    v_user_id,
    v_country_entity_id,
    v_source_type,
    null,
    v_actor_id
  );

  insert into public.audit_logs (
    user_id,
    action,
    target_table,
    target_id,
    new_data,
    country_iso2
  ) values (
    v_actor_id,
    'admin_register_user_country_membership',
    'user_country_memberships',
    v_membership_id,
    jsonb_build_object(
      'target_user_id', v_user_id,
      'country_entity_id', v_country_entity_id,
      'country_iso2', v_country_iso2,
      'source_type', v_source_type
    ),
    v_country_iso2
  );

  return jsonb_build_object(
    'membership_id', v_membership_id,
    'user_id', v_user_id,
    'country_entity_id', v_country_entity_id,
    'country_iso2', v_country_iso2,
    'source_type', v_source_type
  );
end;
$$;

create or replace function app_private.rpc_definer__validate_admin_country_scope(payload jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  select app_private.validate_admin_country_scope(payload);
$$;

create or replace function app_private.rpc_definer__admin_register_user_country_membership(payload jsonb)
returns jsonb
language sql
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  select app_private.admin_register_user_country_membership(payload);
$$;

create or replace function public.validate_admin_country_scope(payload jsonb)
returns jsonb
language sql
stable
set search_path = pg_catalog, public, app_private, auth, pg_temp
as $$
  select app_private.rpc_definer__validate_admin_country_scope(payload);
$$;

create or replace function public.admin_register_user_country_membership(payload jsonb)
returns jsonb
language sql
set search_path = pg_catalog, public, app_private, auth, pg_temp
as $$
  select app_private.rpc_definer__admin_register_user_country_membership(payload);
$$;

create or replace function app_private.admin_list_users()
returns table(
  user_id uuid,
  email text,
  full_name text,
  phone text,
  profile_status text,
  auth_created_at timestamptz,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  active_roles jsonb,
  active_permissions jsonb
)
language plpgsql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_is_super boolean := app_private.current_user_has_role(array['super_admin']);
begin
  if auth.uid() is null or not (
    app_private.current_user_has_permission('users.view')
    or app_private.current_user_is_super_or_national()
  ) then
    raise exception 'No autorizado para ver usuarios' using errcode = '42501';
  end if;

  return query
  select
    auth_user.id,
    coalesce(profile_row.email, auth_user.email)::text,
    profile_row.full_name::text,
    profile_row.phone::text,
    coalesce(profile_row.status, 'pending')::text,
    auth_user.created_at,
    auth_user.email_confirmed_at,
    auth_user.last_sign_in_at,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'assignment_id', assignment.id,
          'role_id', role_row.id,
          'role_key', role_row.key,
          'role_name', role_row.name,
          'scope_type', assignment.scope_type,
          'scope_entity_id', assignment.scope_entity_id,
          'country_iso2', assignment.country_iso2,
          'diocese_id', assignment.diocese_id,
          'pastoral_area_id', assignment.pastoral_area_id,
          'organization_unit_id', assignment.organization_unit_id,
          'starts_at', assignment.starts_at,
          'ends_at', assignment.ends_at,
          'status', assignment.status
        )
        order by role_row.key, assignment.scope_type
      )
      from public.user_role_assignments assignment
      join public.roles role_row on role_row.id = assignment.role_id
      where assignment.user_id = auth_user.id
        and assignment.status = 'active'
        and assignment.starts_at <= current_date
        and (assignment.ends_at is null or assignment.ends_at >= current_date)
        and (
          v_is_super
          or (
            assignment.country_iso2 is not null
            and app_private.current_user_can_access_country(assignment.country_iso2)
          )
        )
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(distinct jsonb_build_object(
        'key', permission_row.key,
        'module', permission_row.module,
        'description', permission_row.description
      ))
      from public.user_role_assignments assignment
      join public.role_permissions role_permission on role_permission.role_id = assignment.role_id
      join public.permissions permission_row on permission_row.id = role_permission.permission_id
      where assignment.user_id = auth_user.id
        and assignment.status = 'active'
        and assignment.starts_at <= current_date
        and (assignment.ends_at is null or assignment.ends_at >= current_date)
        and (
          v_is_super
          or (
            assignment.country_iso2 is not null
            and app_private.current_user_can_access_country(assignment.country_iso2)
          )
        )
    ), '[]'::jsonb)
  from auth.users auth_user
  left join public.profiles profile_row on profile_row.id = auth_user.id
  where app_private.current_user_can_manage_user(auth_user.id)
  order by auth_user.created_at desc;
end;
$$;

create or replace function app_private.admin_list_user_onboarding_progress()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not (
    app_private.current_user_has_permission('users.manage')
    or app_private.current_user_is_super_or_national()
  ) then
    raise exception 'No autorizado para listar el avance de acceso' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', auth_user.id,
    'onboarding_step', coalesce(profile_row.onboarding_step, 'profile'),
    'onboarding_completed_at', profile_row.onboarding_completed_at,
    'access_state', case
      when profile_row.status in ('suspended', 'inactive') then 'blocked'
      when profile_row.onboarding_completed_at is null then 'onboarding'
      when not exists (
        select 1
        from public.user_role_assignments assignment
        where assignment.user_id = auth_user.id
          and assignment.status = 'active'
          and (assignment.starts_at is null or assignment.starts_at <= current_date)
          and (assignment.ends_at is null or assignment.ends_at >= current_date)
      ) then 'no_role'
      else 'ready'
    end
  ) order by auth_user.created_at desc), '[]'::jsonb)
  into v_result
  from auth.users auth_user
  left join public.profiles profile_row on profile_row.id = auth_user.id
  where app_private.current_user_can_manage_user(auth_user.id);

  return v_result;
end;
$$;

create or replace function app_private.admin_list_roles_with_permissions()
returns table(
  role_id uuid,
  role_key text,
  role_name text,
  description text,
  is_system_role boolean,
  active_assignments_count bigint,
  permissions jsonb
)
language plpgsql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_is_super boolean := app_private.current_user_has_role(array['super_admin']);
begin
  if auth.uid() is null or not (
    app_private.current_user_has_permission('security.view')
    or app_private.current_user_has_permission('users.view')
    or app_private.current_user_is_super_or_national()
  ) then
    raise exception 'No autorizado para ver roles y permisos' using errcode = '42501';
  end if;

  return query
  select
    role_row.id,
    role_row.key,
    role_row.name,
    role_row.description,
    role_row.is_system_role,
    count(distinct assignment.id) filter (
      where assignment.status = 'active'
        and assignment.starts_at <= current_date
        and (assignment.ends_at is null or assignment.ends_at >= current_date)
        and (
          v_is_super
          or (
            assignment.country_iso2 is not null
            and app_private.current_user_can_access_country(assignment.country_iso2)
          )
        )
    ),
    coalesce(jsonb_agg(
      distinct jsonb_build_object(
        'id', permission_row.id,
        'key', permission_row.key,
        'module', permission_row.module,
        'description', permission_row.description
      )
    ) filter (where permission_row.id is not null), '[]'::jsonb)
  from public.roles role_row
  left join public.role_permissions role_permission on role_permission.role_id = role_row.id
  left join public.permissions permission_row on permission_row.id = role_permission.permission_id
  left join public.user_role_assignments assignment on assignment.role_id = role_row.id
  where v_is_super or role_row.key <> 'super_admin'
  group by role_row.id, role_row.key, role_row.name, role_row.description, role_row.is_system_role
  order by role_row.key;
end;
$$;

create or replace function app_private.admin_update_user_profile_status(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_user_id uuid := nullif(payload->>'user_id', '')::uuid;
  v_requested_status text := coalesce(nullif(payload->>'status', ''), 'active');
  v_status text;
  v_old_profile public.profiles%rowtype;
  v_has_super_admin boolean;
  v_remaining_super_admins integer;
begin
  if v_actor_id is null or not (
    app_private.current_user_has_permission('users.manage')
    or app_private.current_user_is_super_or_national()
  ) then
    raise exception 'No autorizado para gestionar usuarios' using errcode = '42501';
  end if;

  if v_user_id is null then
    raise exception 'Debes seleccionar un usuario' using errcode = '22023';
  end if;

  if not app_private.current_user_can_manage_user(v_user_id) then
    raise exception 'El usuario seleccionado pertenece a otro país o está fuera de tu alcance.' using errcode = '42501';
  end if;

  v_status := case v_requested_status
    when 'pending' then 'pending_invitation'
    when 'disabled' then 'inactive'
    else v_requested_status
  end;

  if v_user_id = v_actor_id and v_status in ('suspended', 'inactive') then
    raise exception 'No puedes suspender o desactivar tu propio usuario' using errcode = '42501';
  end if;

  if v_status not in ('pending_invitation', 'active', 'suspended', 'inactive') then
    raise exception 'Estado de usuario no permitido' using errcode = '22023';
  end if;

  select * into v_old_profile
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    insert into public.profiles (id, email, full_name, status)
    select
      auth_user.id,
      coalesce(auth_user.email, ''),
      coalesce(
        nullif(btrim(auth_user.raw_user_meta_data->>'full_name'), ''),
        nullif(btrim(auth_user.email), ''),
        'Usuario SINEP'
      ),
      v_status
    from auth.users auth_user
    where auth_user.id = v_user_id
    returning * into v_old_profile;
  end if;

  if not found and not exists (select 1 from auth.users where id = v_user_id) then
    raise exception 'Usuario no encontrado en Supabase Auth' using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.user_role_assignments assignment
    join public.roles role_row on role_row.id = assignment.role_id
    where assignment.user_id = v_user_id
      and role_row.key = 'super_admin'
      and assignment.status = 'active'
      and assignment.starts_at <= current_date
      and (assignment.ends_at is null or assignment.ends_at >= current_date)
  ) into v_has_super_admin;

  if v_has_super_admin and not app_private.current_user_has_role(array['super_admin']) then
    raise exception 'Solo un superadministrador puede modificar otro superadministrador' using errcode = '42501';
  end if;

  if v_has_super_admin and v_status in ('suspended', 'inactive') then
    select count(*) into v_remaining_super_admins
    from public.user_role_assignments assignment
    join public.roles role_row on role_row.id = assignment.role_id
    join public.profiles profile_row on profile_row.id = assignment.user_id
    where role_row.key = 'super_admin'
      and assignment.user_id <> v_user_id
      and profile_row.status = 'active'
      and assignment.status = 'active'
      and assignment.starts_at <= current_date
      and (assignment.ends_at is null or assignment.ends_at >= current_date);

    if v_remaining_super_admins < 1 then
      raise exception 'No puedes desactivar el último superadministrador activo' using errcode = '42501';
    end if;
  end if;

  update public.profiles
  set status = v_status,
      updated_at = now()
  where id = v_user_id;

  insert into public.audit_logs (
    user_id,
    action,
    target_table,
    target_id,
    old_data,
    new_data
  ) values (
    v_actor_id,
    'admin_update_user_profile_status',
    'profiles',
    v_user_id,
    to_jsonb(v_old_profile),
    jsonb_build_object('status', v_status, 'requested_status', v_requested_status)
  );

  return jsonb_build_object('user_id', v_user_id, 'status', v_status);
end;
$$;

create or replace function app_private.admin_end_user_role(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_assignment_id uuid := nullif(payload->>'assignment_id', '')::uuid;
  v_end_date date := coalesce(nullif(payload->>'ends_at', '')::date, current_date);
  v_assignment public.user_role_assignments%rowtype;
  v_role_key text;
  v_remaining_super_admins integer;
  v_is_super boolean := app_private.current_user_has_role(array['super_admin']);
begin
  if v_actor_id is null or not (
    app_private.current_user_has_permission('users.assign_roles')
    or app_private.current_user_is_super_or_national()
  ) then
    raise exception 'No autorizado para cerrar roles' using errcode = '42501';
  end if;

  if v_assignment_id is null then
    raise exception 'Debes seleccionar la asignación de rol' using errcode = '22023';
  end if;

  select * into v_assignment
  from public.user_role_assignments
  where id = v_assignment_id
  for update;

  if not found then
    raise exception 'Asignación de rol no encontrada' using errcode = '22023';
  end if;

  select key into v_role_key
  from public.roles
  where id = v_assignment.role_id;

  if v_role_key = 'super_admin' and not v_is_super then
    raise exception 'Solo un superadministrador puede cerrar roles super_admin' using errcode = '42501';
  end if;

  if not v_is_super then
    if v_assignment.country_iso2 is null
       or not app_private.current_user_can_access_country(v_assignment.country_iso2)
       or not app_private.current_user_can_manage_user(v_assignment.user_id) then
      raise exception 'La asignación pertenece a otro país o está fuera de tu alcance.' using errcode = '42501';
    end if;
  end if;

  if v_role_key = 'super_admin' then
    select count(*) into v_remaining_super_admins
    from public.user_role_assignments assignment
    join public.roles role_row on role_row.id = assignment.role_id
    join public.profiles profile_row on profile_row.id = assignment.user_id
    where role_row.key = 'super_admin'
      and assignment.id <> v_assignment_id
      and profile_row.status = 'active'
      and assignment.status = 'active'
      and assignment.starts_at <= current_date
      and (assignment.ends_at is null or assignment.ends_at >= current_date);

    if v_remaining_super_admins < 1 then
      raise exception 'No puedes cerrar el último superadministrador activo' using errcode = '42501';
    end if;
  end if;

  update public.user_role_assignments
  set status = 'ended',
      ends_at = v_end_date,
      updated_at = now()
  where id = v_assignment_id;

  insert into public.audit_logs (
    user_id,
    action,
    target_table,
    target_id,
    old_data,
    new_data,
    country_iso2
  ) values (
    v_actor_id,
    'admin_end_user_role',
    'user_role_assignments',
    v_assignment_id,
    to_jsonb(v_assignment),
    jsonb_build_object('status', 'ended', 'ends_at', v_end_date),
    v_assignment.country_iso2
  );

  return jsonb_build_object(
    'assignment_id', v_assignment_id,
    'status', 'ended',
    'ends_at', v_end_date,
    'country_iso2', v_assignment.country_iso2
  );
end;
$$;

revoke all on function app_private.validate_user_country_membership_row() from public, anon, authenticated;
revoke all on function app_private.refresh_user_country_membership(uuid) from public, anon, authenticated;
revoke all on function app_private.refresh_user_country_membership_from_source() from public, anon, authenticated;
revoke all on function app_private.ensure_user_country_membership(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_can_manage_user(uuid) from public, anon, authenticated;
revoke all on function app_private.sync_role_assignment_country_membership() from public, anon, authenticated;
revoke all on function app_private.validate_admin_country_scope(jsonb) from public, anon, authenticated;
revoke all on function app_private.admin_register_user_country_membership(jsonb) from public, anon, authenticated;
revoke all on function app_private.rpc_definer__validate_admin_country_scope(jsonb) from public, anon, authenticated;
revoke all on function app_private.rpc_definer__admin_register_user_country_membership(jsonb) from public, anon, authenticated;

revoke all on function public.validate_admin_country_scope(jsonb) from public, anon;
revoke all on function public.admin_register_user_country_membership(jsonb) from public, anon;
grant execute on function public.validate_admin_country_scope(jsonb) to authenticated;
grant execute on function public.admin_register_user_country_membership(jsonb) to authenticated;

revoke all on function app_private.admin_update_user_profile_status(jsonb) from public, anon, authenticated;
revoke all on function app_private.admin_end_user_role(jsonb) from public, anon, authenticated;

comment on table app_private.user_country_memberships is
  'Administrative country membership for users, including pending users without active roles. Internal-only and not exposed through the Data API.';

comment on table app_private.user_country_membership_sources is
  'Evidence that keeps a user-country membership active, such as an invitation or role assignment.';

comment on function app_private.current_user_can_manage_user(uuid) is
  'Returns whether the current actor can administratively view or mutate a user based on overlapping active country membership; super_admin remains global.';

commit;
