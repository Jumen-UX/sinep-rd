-- Priority 0: allow controlled cleanup of person photos and expose a safe
-- orphan reader for the administrative cleanup endpoint.

begin;

drop policy if exists person_photos_admin_insert on storage.objects;
drop policy if exists person_photos_admin_update on storage.objects;
drop policy if exists person_photos_admin_delete on storage.objects;

create policy person_photos_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'person-photos'
  and (
    public.current_user_has_permission('people.create_proposal')
    or public.current_user_has_permission('people.update_proposal')
    or public.current_user_is_super_or_national()
  )
);

create policy person_photos_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'person-photos'
  and (
    public.current_user_has_permission('people.create_proposal')
    or public.current_user_has_permission('people.update_proposal')
    or public.current_user_is_super_or_national()
  )
)
with check (
  bucket_id = 'person-photos'
  and (
    public.current_user_has_permission('people.create_proposal')
    or public.current_user_has_permission('people.update_proposal')
    or public.current_user_is_super_or_national()
  )
);

create policy person_photos_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'person-photos'
  and (
    public.current_user_has_permission('people.create_proposal')
    or public.current_user_has_permission('people.update_proposal')
    or public.current_user_is_super_or_national()
  )
);

create or replace function app_private.admin_list_orphan_person_photos(
  p_older_than interval default interval '1 hour',
  p_limit integer default 100
)
returns table (
  photo_path text,
  created_at timestamptz,
  owner_id uuid,
  size_bytes bigint
)
language plpgsql
stable
security definer
set search_path = public, storage, app_private, auth, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  if not public.current_user_has_permission('people.update_proposal')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para revisar fotografías huérfanas' using errcode = '42501';
  end if;

  return query
  select
    o.name as photo_path,
    o.created_at,
    o.owner_id,
    case
      when coalesce(o.metadata->>'size', '') ~ '^[0-9]+$'
      then (o.metadata->>'size')::bigint
      else null
    end as size_bytes
  from storage.objects o
  where o.bucket_id = 'person-photos'
    and o.created_at <= now() - greatest(coalesce(p_older_than, interval '1 hour'), interval '5 minutes')
    and not exists (
      select 1
      from public.persons p
      where p.photo_path = o.name
    )
  order by o.created_at
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

revoke all on function app_private.admin_list_orphan_person_photos(interval, integer) from public, anon, authenticated;
grant execute on function app_private.admin_list_orphan_person_photos(interval, integer) to authenticated;

create or replace function public.admin_list_orphan_person_photos(
  p_older_than interval default interval '1 hour',
  p_limit integer default 100
)
returns table (
  photo_path text,
  created_at timestamptz,
  owner_id uuid,
  size_bytes bigint
)
language sql
stable
set search_path = public, app_private, pg_temp
as $$
  select *
  from app_private.admin_list_orphan_person_photos(p_older_than, p_limit);
$$;

revoke all on function public.admin_list_orphan_person_photos(interval, integer) from public, anon;
grant execute on function public.admin_list_orphan_person_photos(interval, integer) to authenticated;

commit;
