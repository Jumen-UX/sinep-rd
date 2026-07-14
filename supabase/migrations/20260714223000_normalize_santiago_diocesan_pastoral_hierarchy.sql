do $migration$
declare
  v_entity_id uuid;
  v_chart_id uuid;
  v_header_id uuid;
  v_header_key text := 'pastorales-diocesanas-arquidiocesis-metropolitana-de-santiago-de-los-caballeros';
  v_header_name text := 'Pastorales diocesanas — Arquidiócesis Metropolitana de Santiago de los Caballeros';
  v_child_count integer;
begin
  select ee.id into v_entity_id
  from public.ecclesiastical_entities ee
  where ee.slug = 'arquidiocesis-metropolitana-de-santiago-de-los-caballeros';

  if v_entity_id is null then
    raise exception 'No se encontró la Arquidiócesis Metropolitana de Santiago de los Caballeros.';
  end if;

  select oc.id into v_chart_id
  from public.organization_charts oc
  where oc.key = 'diocesan_pastoral'
    and oc.status = 'active';

  if v_chart_id is null then
    raise exception 'No se encontró el organigrama activo diocesan_pastoral.';
  end if;

  select ou.id into v_header_id
  from public.organization_units ou
  where ou.organization_chart_id = v_chart_id
    and ou.ecclesiastical_entity_id = v_entity_id
    and ou.key = v_header_key
  limit 1;

  if v_header_id is null then
    insert into public.organization_units (
      organization_chart_id,
      parent_unit_id,
      ecclesiastical_entity_id,
      pastoral_area_id,
      key,
      name,
      description,
      slug,
      sort_order,
      visibility,
      status,
      valid_from,
      valid_to,
      is_current
    ) values (
      v_chart_id,
      null,
      v_entity_id,
      null,
      v_header_key,
      v_header_name,
      'Unidad cabecera para agrupar las pastorales diocesanas de la jurisdicción.',
      v_header_key,
      0,
      'internal',
      'draft',
      current_date,
      null,
      true
    )
    returning id into v_header_id;
  end if;

  update public.organization_units ou
  set parent_unit_id = v_header_id,
      updated_at = now()
  where ou.organization_chart_id = v_chart_id
    and ou.ecclesiastical_entity_id = v_entity_id
    and ou.id <> v_header_id
    and ou.pastoral_area_id is not null
    and ou.status = 'draft'
    and ou.visibility = 'internal'
    and ou.is_current = true
    and ou.parent_unit_id is distinct from v_header_id;

  select count(*) into v_child_count
  from public.organization_units ou
  where ou.parent_unit_id = v_header_id
    and ou.organization_chart_id = v_chart_id
    and ou.ecclesiastical_entity_id = v_entity_id
    and ou.pastoral_area_id is not null
    and ou.is_current = true;

  if v_child_count <> 15 then
    raise exception 'La normalización piloto esperaba 15 pastorales hijas y encontró %.', v_child_count;
  end if;
end;
$migration$;
