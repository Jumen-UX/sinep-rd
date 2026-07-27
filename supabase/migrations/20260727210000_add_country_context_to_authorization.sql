begin;

alter table public.user_role_assignments
  add column if not exists country_iso2 char(2);

alter table public.audit_logs
  add column if not exists country_iso2 char(2);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_role_assignments_country_iso2_fkey'
      and conrelid = 'public.user_role_assignments'::regclass
  ) then
    alter table public.user_role_assignments
      add constraint user_role_assignments_country_iso2_fkey
      foreign key (country_iso2)
      references public.country_catalog(iso2)
      on update cascade
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'audit_logs_country_iso2_fkey'
      and conrelid = 'public.audit_logs'::regclass
  ) then
    alter table public.audit_logs
      add constraint audit_logs_country_iso2_fkey
      foreign key (country_iso2)
      references public.country_catalog(iso2)
      on update cascade
      on delete restrict;
  end if;
end;
$$;

create index if not exists user_role_assignments_country_active_idx
  on public.user_role_assignments(country_iso2, user_id)
  where status = 'active';

create index if not exists audit_logs_country_created_idx
  on public.audit_logs(country_iso2, created_at desc)
  where country_iso2 is not null;

create or replace function app_private.resolve_entity_country_iso2(p_entity_id uuid)
returns char(2)
language sql
stable
security definer
set search_path = public, app_private, pg_temp
as $$
  with recursive entity_lineage as (
    select
      entity_row.id,
      entity_row.country_iso2,
      array[entity_row.id]::uuid[] as visited,
      0 as depth
    from public.ecclesiastical_entities entity_row
    where entity_row.id = p_entity_id

    union all

    select
      parent_row.id,
      parent_row.country_iso2,
      child.visited || parent_row.id,
      child.depth + 1
    from entity_lineage child
    join public.entity_relationships relation_row
      on relation_row.child_entity_id = child.id
     and relation_row.is_current = true
     and relation_row.status = 'active'
    join public.ecclesiastical_entities parent_row
      on parent_row.id = relation_row.parent_entity_id
    where child.depth < 20
      and not parent_row.id = any(child.visited)
  )
  select lineage.country_iso2
  from entity_lineage lineage
  where lineage.country_iso2 is not null
  order by lineage.depth
  limit 1;
$$;

create or replace function app_private.resolve_scope_country_iso2(
  p_scope_type text,
  p_scope_entity_id uuid default null,
  p_diocese_id uuid default null,
  p_pastoral_area_id uuid default null,
  p_organization_unit_id uuid default null
)
returns char(2)
language plpgsql
stable
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  v_scope_type text := nullif(btrim(p_scope_type), '');
  v_country_iso2 char(2);
begin
  if v_scope_type = 'global' then
    return null;
  end if;

  if p_scope_entity_id is not null then
    v_country_iso2 := app_private.resolve_entity_country_iso2(p_scope_entity_id);

    if v_country_iso2 is null then
      select coalesce(
        app_private.resolve_entity_country_iso2(node_row.linked_ecclesiastical_entity_id),
        app_private.resolve_entity_country_iso2(node_row.diocese_id)
      )
      into v_country_iso2
      from public.structure_nodes node_row
      where node_row.id = p_scope_entity_id
      limit 1;
    end if;
  end if;

  if v_country_iso2 is null and p_diocese_id is not null then
    v_country_iso2 := app_private.resolve_entity_country_iso2(p_diocese_id);
  end if;

  if v_country_iso2 is null and p_organization_unit_id is not null then
    select app_private.resolve_entity_country_iso2(unit_row.ecclesiastical_entity_id)
    into v_country_iso2
    from public.organization_units unit_row
    where unit_row.id = p_organization_unit_id
    limit 1;
  end if;

  return v_country_iso2;
end;
$$;

create or replace function app_private.current_user_country_iso2s()
returns table(country_iso2 char(2))
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  select distinct assignment.country_iso2
  from public.user_role_assignments assignment
  join public.profiles profile_row on profile_row.id = assignment.user_id
  where assignment.user_id = auth.uid()
    and profile_row.status = 'active'
    and assignment.status = 'active'
    and assignment.starts_at <= current_date
    and (assignment.ends_at is null or assignment.ends_at >= current_date)
    and assignment.country_iso2 is not null;
$$;

create or replace function app_private.current_user_can_access_country(p_country_iso2 char(2))
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
        from public.profiles profile_row
        where profile_row.id = auth.uid()
          and profile_row.status = 'active'
      )
      and (
        app_private.current_user_has_role(array['super_admin'])
        or exists (
          select 1
          from app_private.current_user_country_iso2s() country_row
          where country_row.country_iso2 = p_country_iso2
        )
      )
    );
$$;

do $$
declare
  v_default_country_entity_id uuid;
begin
  select entity_row.id
  into v_default_country_entity_id
  from public.ecclesiastical_entities entity_row
  join public.entity_types type_row on type_row.id = entity_row.entity_type_id
  where type_row.key = 'country'
    and entity_row.country_iso2 = 'DO'
    and entity_row.status = 'active'
  order by entity_row.updated_at desc, entity_row.id
  limit 1;

  if v_default_country_entity_id is null then
    raise exception 'No existe una entidad país activa para República Dominicana (DO).';
  end if;

  update public.user_role_assignments assignment
  set
    country_iso2 = coalesce(
      assignment.country_iso2,
      app_private.resolve_scope_country_iso2(
        assignment.scope_type,
        assignment.scope_entity_id,
        assignment.diocese_id,
        assignment.pastoral_area_id,
        assignment.organization_unit_id
      )
    )
  where assignment.country_iso2 is null;

  update public.user_role_assignments assignment
  set
    country_iso2 = 'DO',
    scope_entity_id = coalesce(assignment.scope_entity_id, v_default_country_entity_id)
  from public.roles role_row
  where assignment.role_id = role_row.id
    and assignment.scope_type = 'national'
    and role_row.key <> 'super_admin'
    and assignment.country_iso2 is null;

  update public.user_role_assignments assignment
  set country_iso2 = null
  from public.roles role_row
  where assignment.role_id = role_row.id
    and role_row.key = 'super_admin';
end;
$$;

update public.audit_logs audit_row
set country_iso2 = app_private.resolve_scope_country_iso2(
  audit_row.scope_type,
  audit_row.scope_entity_id,
  audit_row.diocese_id,
  audit_row.pastoral_area_id,
  audit_row.organization_unit_id
)
where audit_row.country_iso2 is null;

create or replace function app_private.derive_role_assignment_country_context()
returns trigger
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  v_role_key text;
  v_derived_country_iso2 char(2);
begin
  select role_row.key
  into v_role_key
  from public.roles role_row
  where role_row.id = new.role_id;

  if v_role_key is null then
    raise exception 'Rol administrativo no encontrado.' using errcode = '23503';
  end if;

  if v_role_key = 'super_admin' then
    new.country_iso2 := null;
    return new;
  end if;

  v_derived_country_iso2 := app_private.resolve_scope_country_iso2(
    new.scope_type,
    new.scope_entity_id,
    new.diocese_id,
    new.pastoral_area_id,
    new.organization_unit_id
  );

  if new.country_iso2 is not null
     and v_derived_country_iso2 is not null
     and new.country_iso2 <> v_derived_country_iso2 then
    raise exception 'El país del alcance no coincide con la entidad seleccionada.' using errcode = '23514';
  end if;

  new.country_iso2 := coalesce(v_derived_country_iso2, new.country_iso2);
  return new;
end;
$$;

drop trigger if exists derive_role_assignment_country_context
  on public.user_role_assignments;

create trigger derive_role_assignment_country_context
before insert or update of role_id, scope_type, scope_entity_id, diocese_id, pastoral_area_id, organization_unit_id, country_iso2
on public.user_role_assignments
for each row
execute function app_private.derive_role_assignment_country_context();

create or replace function app_private.derive_audit_country_context()
returns trigger
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  v_derived_country_iso2 char(2);
begin
  v_derived_country_iso2 := app_private.resolve_scope_country_iso2(
    new.scope_type,
    new.scope_entity_id,
    new.diocese_id,
    new.pastoral_area_id,
    new.organization_unit_id
  );

  if new.country_iso2 is not null
     and v_derived_country_iso2 is not null
     and new.country_iso2 <> v_derived_country_iso2 then
    raise exception 'El país del evento de auditoría no coincide con su alcance.' using errcode = '23514';
  end if;

  new.country_iso2 := coalesce(v_derived_country_iso2, new.country_iso2);
  return new;
end;
$$;

drop trigger if exists derive_audit_country_context
  on public.audit_logs;

create trigger derive_audit_country_context
before insert or update of scope_type, scope_entity_id, diocese_id, pastoral_area_id, organization_unit_id, country_iso2
on public.audit_logs
for each row
execute function app_private.derive_audit_country_context();

revoke all on function app_private.resolve_entity_country_iso2(uuid) from public, anon, authenticated;
revoke all on function app_private.resolve_scope_country_iso2(text, uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_country_iso2s() from public, anon, authenticated;
revoke all on function app_private.current_user_can_access_country(char) from public, anon, authenticated;
revoke all on function app_private.derive_role_assignment_country_context() from public, anon, authenticated;
revoke all on function app_private.derive_audit_country_context() from public, anon, authenticated;

do $$
begin
  if exists (
    select 1
    from public.user_role_assignments assignment
    join public.roles role_row on role_row.id = assignment.role_id
    where assignment.status = 'active'
      and assignment.scope_type = 'national'
      and role_row.key <> 'super_admin'
      and assignment.country_iso2 is null
  ) then
    raise exception 'Existen asignaciones nacionales activas sin contexto de país.';
  end if;
end;
$$;

comment on column public.user_role_assignments.country_iso2 is
  'Canonical country context for an administrative role assignment. Phase 1 is additive; legacy scope_type values remain temporarily supported.';

comment on column public.audit_logs.country_iso2 is
  'Country context derived from the audited scope whenever it can be resolved.';

comment on function app_private.current_user_can_access_country(char) is
  'Returns whether the current active user has an assignment in the requested country or is a super administrator.';

commit;
