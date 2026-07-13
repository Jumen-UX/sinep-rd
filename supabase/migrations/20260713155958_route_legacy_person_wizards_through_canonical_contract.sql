create or replace function public.admin_save_bishop(payload jsonb)
returns jsonb
language sql
set search_path = 'public', 'pg_temp'
as $$
  select public.admin_save_canonical_person(
    payload || jsonb_build_object(
      'flow', 'bishop',
      'selected_person_id', payload->'selected_clergy_id',
      'mode', coalesce(
        nullif(payload->>'mode', ''),
        case when nullif(payload->>'selected_clergy_id', '') is null then 'new' else 'existing' end
      )
    )
  );
$$;

create or replace function public.admin_save_deacon(payload jsonb)
returns jsonb
language sql
set search_path = 'public', 'pg_temp'
as $$
  select public.admin_save_canonical_person(
    payload || jsonb_build_object(
      'flow', 'deacon',
      'selected_person_id', payload->'selected_person_id',
      'mode', coalesce(
        payload->'mode',
        case when payload ? 'selected_person_id' then '"existing"'::jsonb else '"new"'::jsonb end
      )
    )
  );
$$;

create or replace function public.admin_save_priest(payload jsonb)
returns jsonb
language sql
set search_path = 'public', 'pg_temp'
as $$
  select public.admin_save_canonical_person(
    payload || jsonb_build_object(
      'flow', 'priest',
      'selected_person_id', payload->'existing_deacon_person_id',
      'mode', case when nullif(payload->>'existing_deacon_person_id', '') is null then 'new' else 'existing' end
    )
  );
$$;

create or replace function public.admin_save_layperson(payload jsonb)
returns jsonb
language sql
set search_path = 'public', 'pg_temp'
as $$
  select public.admin_save_canonical_person(
    payload || jsonb_build_object(
      'flow', 'layperson',
      'selected_person_id', payload->'selected_person_id',
      'mode', case when nullif(payload->>'selected_person_id', '') is null then 'new' else 'existing' end
    )
  );
$$;

create or replace function public.admin_save_religious(payload jsonb)
returns jsonb
language sql
set search_path = 'public', 'pg_temp'
as $$
  select public.admin_save_canonical_person(
    payload || jsonb_build_object(
      'flow', 'religious',
      'selected_person_id', payload->'selected_person_id',
      'mode', case when nullif(payload->>'selected_person_id', '') is null then 'new' else 'existing' end
    )
  );
$$;

revoke all on function internal.admin_save_bishop_with_dimensions(jsonb) from public, anon, authenticated;
revoke all on function internal.admin_save_deacon(jsonb) from public, anon, authenticated;
revoke all on function internal.admin_save_priest(jsonb) from public, anon, authenticated;
revoke all on function internal.admin_save_layperson(jsonb) from public, anon, authenticated;
revoke all on function internal.admin_save_religious(jsonb) from public, anon, authenticated;

grant execute on function public.admin_save_bishop(jsonb) to authenticated, service_role;
grant execute on function public.admin_save_deacon(jsonb) to authenticated, service_role;
grant execute on function public.admin_save_priest(jsonb) to authenticated, service_role;
grant execute on function public.admin_save_layperson(jsonb) to authenticated, service_role;
grant execute on function public.admin_save_religious(jsonb) to authenticated, service_role;
