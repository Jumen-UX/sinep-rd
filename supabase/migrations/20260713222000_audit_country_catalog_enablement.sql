create or replace function public.enable_country_from_catalog(
  p_iso2 text,
  p_flag_image_url text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_catalog public.country_catalog%rowtype;
  v_country_id uuid;
  v_old jsonb;
  v_new jsonb;
begin
  if v_actor_id is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para habilitar países' using errcode = '42501';
  end if;

  select *
    into v_catalog
  from public.country_catalog
  where iso2 = upper(trim(p_iso2))::char(2);

  if not found then
    raise exception 'País no encontrado en el catálogo ISO: %', p_iso2 using errcode = '22023';
  end if;

  select to_jsonb(c)
    into v_old
  from public.countries c
  where c.iso2 = v_catalog.iso2;

  insert into public.countries (
    iso2, iso3, name, official_name, flag_emoji, flag_image_url,
    flag_alt, status, visibility
  )
  values (
    v_catalog.iso2,
    v_catalog.iso3,
    coalesce(v_catalog.name_es, v_catalog.name_en),
    coalesce(v_catalog.official_name_en, v_catalog.common_name_en, v_catalog.name_en),
    v_catalog.flag_emoji,
    nullif(btrim(p_flag_image_url), ''),
    coalesce(v_catalog.flag_alt, 'Bandera de ' || coalesce(v_catalog.name_es, v_catalog.name_en)),
    'active',
    'public'
  )
  on conflict (iso2) do update set
    iso3 = excluded.iso3,
    name = excluded.name,
    official_name = excluded.official_name,
    flag_emoji = excluded.flag_emoji,
    flag_image_url = coalesce(excluded.flag_image_url, public.countries.flag_image_url),
    flag_alt = excluded.flag_alt,
    status = 'active',
    visibility = 'public',
    updated_at = now()
  returning id into v_country_id;

  select to_jsonb(c)
    into v_new
  from public.countries c
  where c.id = v_country_id;

  insert into public.audit_logs (
    user_id, action, target_table, target_id, old_data, new_data,
    scope_type, permission_key, outcome
  ) values (
    v_actor_id,
    case when v_old is null then 'enable_country_from_catalog' else 'refresh_country_from_catalog' end,
    'countries',
    v_country_id,
    v_old,
    v_new,
    'national',
    'entities.create_proposal',
    'success'
  );

  return v_country_id;
end;
$function$;

revoke all on function public.enable_country_from_catalog(text, text) from public, anon;
grant execute on function public.enable_country_from_catalog(text, text) to authenticated, service_role;
