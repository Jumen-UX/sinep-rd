begin;

create or replace function public.admin_count_missing_clergy_profiles()
returns bigint
language sql
stable
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
  select internal.admin_count_missing_clergy_profiles()
$$;

create or replace function public.admin_list_orphan_person_photos(
  p_older_than interval default interval '1 hour',
  p_limit integer default 100
)
returns table(photo_path text, created_at timestamptz, owner_id uuid, size_bytes bigint)
language sql
stable
security definer
set search_path = public, storage, app_private, auth, pg_temp
as $$
  select *
  from app_private.admin_list_orphan_person_photos(p_older_than, p_limit)
$$;

revoke all on function public.admin_count_missing_clergy_profiles() from public, anon, authenticated;
revoke all on function public.admin_list_orphan_person_photos(interval, integer) from public, anon, authenticated;
grant execute on function public.admin_count_missing_clergy_profiles() to authenticated;
grant execute on function public.admin_list_orphan_person_photos(interval, integer) to authenticated;

comment on function public.admin_count_missing_clergy_profiles() is
  'Sealed authenticated facade; the private diagnostic filters each person through country-scoped authorization.';
comment on function public.admin_list_orphan_person_photos(interval, integer) is
  'Sealed authenticated facade; orphan photo inventory remains super_admin-only.';

commit;
