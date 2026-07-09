-- Keep public admin RPC endpoints aligned with the hardened internal implementations.
-- The public functions remain the stable API surface for Supabase/PostgREST calls.

create schema if not exists internal;

revoke all on schema internal from public;
revoke all on schema internal from anon;
revoke all on schema internal from authenticated;

revoke execute on all functions in schema internal from public;
revoke execute on all functions in schema internal from anon;
revoke execute on all functions in schema internal from authenticated;

create or replace function public.admin_save_position_assignment(payload jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_save_position_assignment(payload);
$$;

create or replace function public.admin_save_priest(payload jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_save_priest(payload);
$$;

create or replace function public.admin_save_jurisdiction(payload jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_save_jurisdiction(payload);
$$;

create or replace function public.admin_save_ecclesiastical_entity(payload jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal.admin_save_ecclesiastical_entity(payload);
$$;

revoke execute on function public.admin_save_position_assignment(jsonb) from public;
revoke execute on function public.admin_save_priest(jsonb) from public;
revoke execute on function public.admin_save_jurisdiction(jsonb) from public;
revoke execute on function public.admin_save_ecclesiastical_entity(jsonb) from public;

revoke execute on function public.admin_save_position_assignment(jsonb) from anon;
revoke execute on function public.admin_save_priest(jsonb) from anon;
revoke execute on function public.admin_save_jurisdiction(jsonb) from anon;
revoke execute on function public.admin_save_ecclesiastical_entity(jsonb) from anon;

grant execute on function public.admin_save_position_assignment(jsonb) to authenticated;
grant execute on function public.admin_save_priest(jsonb) to authenticated;
grant execute on function public.admin_save_jurisdiction(jsonb) to authenticated;
grant execute on function public.admin_save_ecclesiastical_entity(jsonb) to authenticated;

comment on function public.admin_save_position_assignment(jsonb) is 'Stable public admin RPC wrapper for internal.admin_save_position_assignment.';
comment on function public.admin_save_priest(jsonb) is 'Stable public admin RPC wrapper for internal.admin_save_priest.';
comment on function public.admin_save_jurisdiction(jsonb) is 'Stable public admin RPC wrapper for internal.admin_save_jurisdiction.';
comment on function public.admin_save_ecclesiastical_entity(jsonb) is 'Stable public admin RPC wrapper for internal.admin_save_ecclesiastical_entity.';
