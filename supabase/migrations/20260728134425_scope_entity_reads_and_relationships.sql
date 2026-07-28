begin;

create or replace function app_private.current_user_can_read_entity(p_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  select exists (
    select 1
    from public.ecclesiastical_entities entity_row
    where entity_row.id = p_entity_id
      and (
        (entity_row.status = 'active' and entity_row.visibility = 'public')
        or (
          auth.uid() is not null
          and app_private.current_user_can_manage_entity('entities.view', entity_row.id)
        )
      )
  );
$$;

create or replace function app_private.current_user_can_read_entity_relationship(p_relationship_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  select exists (
    select 1
    from public.entity_relationships relationship_row
    where relationship_row.id = p_relationship_id
      and (
        (
          relationship_row.status = 'active'
          and exists (
            select 1
            from public.ecclesiastical_entities parent_row
            where parent_row.id = relationship_row.parent_entity_id
              and parent_row.status = 'active'
              and parent_row.visibility = 'public'
          )
          and exists (
            select 1
            from public.ecclesiastical_entities child_row
            where child_row.id = relationship_row.child_entity_id
              and child_row.status = 'active'
              and child_row.visibility = 'public'
          )
        )
        or (
          auth.uid() is not null
          and app_private.current_user_can_read_entity(relationship_row.parent_entity_id)
          and app_private.current_user_can_read_entity(relationship_row.child_entity_id)
          and (
            app_private.current_user_can_manage_entity('entities.view', relationship_row.parent_entity_id)
            or app_private.current_user_can_manage_entity('entities.view', relationship_row.child_entity_id)
          )
        )
      )
  );
$$;

create or replace function app_private.current_user_can_read_entity_descendants(p_entity_id uuid)
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
      and app_private.current_user_can_manage_entity('entities.view', p_entity_id)
    );
$$;

revoke all on function app_private.current_user_can_read_entity(uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_can_read_entity_relationship(uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_can_read_entity_descendants(uuid) from public, anon, authenticated;

grant execute on function app_private.current_user_can_read_entity(uuid) to anon, authenticated;
grant execute on function app_private.current_user_can_read_entity_relationship(uuid) to anon, authenticated;
grant execute on function app_private.current_user_can_read_entity_descendants(uuid) to authenticated;

drop policy if exists phase0_ecclesiastical_entities_select_c2a6838 on public.ecclesiastical_entities;
create policy ecclesiastical_entities_select_scoped
on public.ecclesiastical_entities
for select
to public
using (app_private.current_user_can_read_entity(id));

drop policy if exists entity_relationships_select_authenticated_visible on public.entity_relationships;
drop policy if exists entity_relationships_select_anon_active on public.entity_relationships;
create policy entity_relationships_select_scoped
on public.entity_relationships
for select
to public
using (app_private.current_user_can_read_entity_relationship(id));

drop policy if exists phase0_entity_relationships_insert_2049d8d on public.entity_relationships;
drop policy if exists phase0_entity_relationships_update_98ba67f on public.entity_relationships;
drop policy if exists phase0_entity_relationships_remove_d812ba9 on public.entity_relationships;

revoke insert, update, delete on table public.entity_relationships from authenticated;

comment on function app_private.current_user_can_read_entity(uuid) is
  'Public active entities remain visible; non-public or inactive entities require entities.view within canonical territorial scope.';

comment on function app_private.current_user_can_read_entity_relationship(uuid) is
  'Public active relationships remain visible only when both endpoints are public. Administrative relationship reads require scoped access to an endpoint and visibility of both endpoints.';

comment on policy ecclesiastical_entities_select_scoped on public.ecclesiastical_entities is
  'Separates public entity visibility from country-scoped administrative visibility.';

commit;
