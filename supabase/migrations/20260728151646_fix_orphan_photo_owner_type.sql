begin;

create or replace function app_private.admin_list_orphan_person_photos(
  p_older_than interval default interval '1 hour',
  p_limit integer default 100
)
returns table(photo_path text, created_at timestamptz, owner_id uuid, size_bytes bigint)
language plpgsql
stable
security definer
set search_path = public, storage, app_private, auth, pg_temp
as $$
begin
  if auth.uid() is null
     or not app_private.current_user_has_role(array['super_admin'])
     or not app_private.current_user_has_permission('people.update_proposal') then
    raise exception 'Solo un superadministrador puede revisar fotografías huérfanas.' using errcode = '42501';
  end if;

  return query
  select
    object_row.name as photo_path,
    object_row.created_at,
    case
      when coalesce(object_row.owner_id, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then object_row.owner_id::uuid
      else null::uuid
    end as owner_id,
    case
      when coalesce(object_row.metadata->>'size', '') ~ '^[0-9]+$'
      then (object_row.metadata->>'size')::bigint
      else null
    end as size_bytes
  from storage.objects object_row
  where object_row.bucket_id = 'person-photos'
    and object_row.created_at <= now() - greatest(coalesce(p_older_than, interval '1 hour'), interval '5 minutes')
    and not exists (
      select 1
      from public.persons person_row
      where person_row.photo_path = object_row.name
    )
  order by object_row.created_at
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

revoke all on function app_private.admin_list_orphan_person_photos(interval, integer)
from public, anon, authenticated;

comment on function app_private.admin_list_orphan_person_photos(interval, integer) is
  'Super-admin-only orphan inventory. Storage owner_id is text and is returned as uuid only when structurally valid.';

commit;
