-- Resolve the authenticated administrator's root ecclesiastical jurisdiction.
-- Required by scoped import preparation when the caller does not send scope_entity_id.

begin;

create or replace function app_private.current_user_root_jurisdiction_id()
returns uuid
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  select coalesce(ura.diocese_id, ura.scope_entity_id)
  from public.user_role_assignments ura
  join public.roles role_row on role_row.id = ura.role_id
  where ura.user_id = auth.uid()
    and ura.status = 'active'
    and ura.starts_at <= current_date
    and (ura.ends_at is null or ura.ends_at >= current_date)
    and role_row.key not in ('super_admin', 'national_admin')
    and coalesce(ura.diocese_id, ura.scope_entity_id) is not null
  order by
    case
      when ura.scope_type in ('archdiocese', 'diocese') then 0
      when ura.diocese_id is not null then 1
      else 2
    end,
    ura.created_at desc,
    ura.id
  limit 1;
$$;

revoke all on function app_private.current_user_root_jurisdiction_id() from public, anon;
grant execute on function app_private.current_user_root_jurisdiction_id() to authenticated;

create or replace function public.current_user_root_jurisdiction_id()
returns uuid
language sql
stable
security invoker
set search_path = public, app_private, auth, pg_temp
as $$
  select app_private.current_user_root_jurisdiction_id();
$$;

revoke all on function public.current_user_root_jurisdiction_id() from public, anon;
grant execute on function public.current_user_root_jurisdiction_id() to authenticated;

comment on function public.current_user_root_jurisdiction_id() is
  'Returns the authenticated non-national administrator root ecclesiastical jurisdiction used for scoped administrative operations.';

commit;
