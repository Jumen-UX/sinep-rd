-- Controlled growth model: administrators can create or update official office configurations.
-- Applied to project hrvgpceqaxujlttpimdz on 2026-07-06.

create or replace function public.admin_save_office_configuration(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_display_name text := nullif(btrim(payload->>'display_name'), '');
  v_key text := nullif(btrim(payload->>'key'), '');
  v_category_key text := coalesce(nullif(btrim(payload->>'category_key'), ''), 'pastoral');
  v_category_name text := coalesce(nullif(btrim(payload->>'category_name'), ''), initcap(replace(v_category_key, '_', ' ')));
  v_scope_key text := coalesce(nullif(btrim(payload->>'scope_key'), ''), 'diocesan');
  v_scope_name text := coalesce(nullif(btrim(payload->>'scope_name'), ''), initcap(replace(v_scope_key, '_', ' ')));
  v_base_role_key text := nullif(btrim(payload->>'base_role_key'), '');
  v_base_role_name text := coalesce(nullif(btrim(payload->>'base_role_name'), ''), v_display_name);
  v_chart_key text := nullif(btrim(payload->>'organization_chart_key'), '');
  v_chart_name text := nullif(btrim(payload->>'organization_chart_name'), '');
  v_category_id uuid;
  v_scope_id uuid;
  v_base_role_id uuid;
  v_chart_id uuid;
  v_configuration_id uuid;
  v_allowed_person_types text[];
  v_description text := nullif(btrim(payload->>'description'), '');
  v_requires_clergy boolean := coalesce((payload->>'requires_clergy')::boolean, false);
  v_default_term_months integer := nullif(payload->>'default_term_months', '')::integer;
  v_continues_until_replaced boolean := coalesce((payload->>'continues_until_replaced')::boolean, true);
  v_sort_order integer := coalesce(nullif(payload->>'sort_order', '')::integer, 100);
begin
  if v_user_id is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para crear cargos oficiales' using errcode = '42501';
  end if;

  if v_display_name is null then
    raise exception 'El nombre visible del cargo es obligatorio' using errcode = '22023';
  end if;

  if v_base_role_key is null then
    v_base_role_key := lower(regexp_replace(translate(v_base_role_name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'), '[^a-zA-Z0-9]+', '_', 'g'));
    v_base_role_key := trim(both '_' from v_base_role_key);
  end if;

  if v_key is null then
    v_key := lower(regexp_replace(translate(v_display_name || '_' || v_scope_key, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'), '[^a-zA-Z0-9]+', '_', 'g'));
    v_key := trim(both '_' from v_key);
  end if;

  if payload ? 'allowed_person_types' and jsonb_typeof(payload->'allowed_person_types') = 'array' then
    select array_agg(value::text)
    into v_allowed_person_types
    from jsonb_array_elements_text(payload->'allowed_person_types') as value;
  else
    v_allowed_person_types := array['bishop','priest','deacon','religious','layperson']::text[];
  end if;

  insert into office_categories (key, name, description, sort_order, status)
  values (v_category_key, v_category_name, nullif(btrim(payload->>'category_description'), ''), v_sort_order, 'active')
  on conflict (key) do update set
    name = excluded.name,
    description = coalesce(excluded.description, office_categories.description),
    status = 'active',
    updated_at = now()
  returning id into v_category_id;

  insert into office_scopes (key, name, adjective_masculine, adjective_feminine, description, sort_order, status)
  values (v_scope_key, v_scope_name, nullif(btrim(payload->>'scope_adjective_masculine'), ''), nullif(btrim(payload->>'scope_adjective_feminine'), ''), nullif(btrim(payload->>'scope_description'), ''), v_sort_order, 'active')
  on conflict (key) do update set
    name = excluded.name,
    adjective_masculine = coalesce(excluded.adjective_masculine, office_scopes.adjective_masculine),
    adjective_feminine = coalesce(excluded.adjective_feminine, office_scopes.adjective_feminine),
    description = coalesce(excluded.description, office_scopes.description),
    status = 'active',
    updated_at = now()
  returning id into v_scope_id;

  insert into office_base_roles (key, name, feminine_name, plural_name, description, sort_order, status)
  values (v_base_role_key, v_base_role_name, nullif(btrim(payload->>'feminine_name'), ''), nullif(btrim(payload->>'plural_name'), ''), v_description, v_sort_order, 'active')
  on conflict (key) do update set
    name = excluded.name,
    feminine_name = coalesce(excluded.feminine_name, office_base_roles.feminine_name),
    plural_name = coalesce(excluded.plural_name, office_base_roles.plural_name),
    description = coalesce(excluded.description, office_base_roles.description),
    status = 'active',
    updated_at = now()
  returning id into v_base_role_id;

  if v_chart_key is not null or v_chart_name is not null then
    v_chart_key := coalesce(v_chart_key, lower(regexp_replace(translate(v_chart_name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'), '[^a-zA-Z0-9]+', '_', 'g')));
    v_chart_key := trim(both '_' from v_chart_key);
    v_chart_name := coalesce(v_chart_name, initcap(replace(v_chart_key, '_', ' ')));

    insert into organization_charts (key, name, description, sort_order, visibility, status)
    values (v_chart_key, v_chart_name, nullif(btrim(payload->>'organization_chart_description'), ''), v_sort_order, 'public', 'active')
    on conflict (key) do update set
      name = excluded.name,
      description = coalesce(excluded.description, organization_charts.description),
      visibility = 'public',
      status = 'active',
      updated_at = now()
    returning id into v_chart_id;
  end if;

  insert into office_configurations (base_role_id, scope_id, category_id, organization_chart_id, key, display_name, description, requires_clergy, allowed_person_types, is_elective, is_renewable, default_term_months, continues_until_replaced, sort_order, visibility, status)
  values (v_base_role_id, v_scope_id, v_category_id, v_chart_id, v_key, v_display_name, v_description, v_requires_clergy, v_allowed_person_types, coalesce((payload->>'is_elective')::boolean, false), coalesce((payload->>'is_renewable')::boolean, true), v_default_term_months, v_continues_until_replaced, v_sort_order, 'public', 'active')
  on conflict (key) do update set
    base_role_id = excluded.base_role_id,
    scope_id = excluded.scope_id,
    category_id = excluded.category_id,
    organization_chart_id = excluded.organization_chart_id,
    display_name = excluded.display_name,
    description = excluded.description,
    requires_clergy = excluded.requires_clergy,
    allowed_person_types = excluded.allowed_person_types,
    is_elective = excluded.is_elective,
    is_renewable = excluded.is_renewable,
    default_term_months = excluded.default_term_months,
    continues_until_replaced = excluded.continues_until_replaced,
    sort_order = excluded.sort_order,
    visibility = 'public',
    status = 'active',
    updated_at = now()
  returning id into v_configuration_id;

  insert into audit_logs (user_id, action, target_table, target_id, new_data)
  values (v_user_id, 'admin_save_office_configuration', 'office_configurations', v_configuration_id, payload);

  return jsonb_build_object('office_configuration_id', v_configuration_id, 'key', v_key, 'display_name', v_display_name);
end;
$$;

grant execute on function public.admin_save_office_configuration(jsonb) to authenticated;
