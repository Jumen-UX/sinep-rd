begin;

create or replace function app_private.current_user_can_access_country(p_country_iso2 char(2))
returns boolean
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  select
    coalesce(current_setting('request.jwt.claim.role', true) = 'service_role', false)
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

create or replace function app_private.current_user_can_manage_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  select
    coalesce(current_setting('request.jwt.claim.role', true) = 'service_role', false)
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

create or replace function app_private.current_user_can_read_entity_descendants(p_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  select
    coalesce(current_setting('request.jwt.claim.role', true) = 'service_role', false)
    or (
      auth.uid() is not null
      and app_private.current_user_can_manage_entity('entities.view', p_entity_id)
    );
$$;

revoke all on function app_private.current_user_can_access_country(char(2)) from public, anon, authenticated;
revoke all on function app_private.current_user_can_manage_user(uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_can_read_entity_descendants(uuid) from public, anon, authenticated;

grant execute on function app_private.current_user_can_read_entity_descendants(uuid) to authenticated;

comment on function app_private.current_user_can_access_country(char(2)) is
  'Returns a strict boolean. Missing service-role claims evaluate to false rather than SQL null.';

comment on function app_private.current_user_can_manage_user(uuid) is
  'Returns a strict boolean for service-role or shared-country user management authorization.';

commit;
