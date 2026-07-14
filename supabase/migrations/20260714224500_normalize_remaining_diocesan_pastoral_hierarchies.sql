do $migration$
declare
  v_chart_id uuid;
  v_scope record;
  v_header_id uuid;
  v_normalized_scopes integer := 0;
  v_total_children integer := 0;
begin
  select oc.id into v_chart_id
  from public.organization_charts oc
  where oc.key = 'diocesan_pastoral'
    and oc.status = 'active';

  if v_chart_id is null then
    raise exception 'No se encontró el organigrama activo diocesan_pastoral.';
  end if;

  for v_scope in
    select
      ee.id as entity_id,
      ee.slug as entity_slug,
      ee.name as entity_name,
      count(*) filter (where ou.parent_unit_id is null and ou.pastoral_area_id is not null) as root_pastoral_count,
      count(*) filter (where ou.parent_unit_id is null and ou.pastoral_area_id is null) as header_count
    from public.organization_units ou
    join public.ecclesiastical_entities ee on ee.id = ou.ecclesiastical_entity_id
    where ou.organization_chart_id = v_chart_id
      and ou.status = 'draft'
      and ou.visibility = 'internal'
      and ou.is_current = true
    group by ee.id, ee.slug, ee.name
    having count(*) filter (where ou.parent_unit_id is null and ou.pastoral_area_id is not null) = 15
       and count(*) filter (where ou.parent_unit_id is null and ou.pastoral_area_id is null) = 0
    order by ee.name
  loop
    v_header_id := null;

    select ou.id into v_header_id
    from public.organization_units ou
    where ou.organization_chart_id = v_chart_id
      and ou.ecclesiastical_entity_id = v_scope.entity_id
      and ou.key = 'pastorales-diocesanas-' || v_scope.entity_slug
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
        v_scope.entity_id,
        null,
        'pastorales-diocesanas-' || v_scope.entity_slug,
        'Pastorales diocesanas — ' || v_scope.entity_name,
        'Unidad cabecera para agrupar las pastorales diocesanas de la jurisdicción.',
        'pastorales-diocesanas-' || v_scope.entity_slug,
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
      and ou.ecclesiastical_entity_id = v_scope.entity_id
      and ou.id <> v_header_id
      and ou.parent_unit_id is null
      and ou.pastoral_area_id is not null
      and ou.status = 'draft'
      and ou.visibility = 'internal'
      and ou.is_current = true;

    if (
      select count(*)
      from public.organization_units ou
      where ou.parent_unit_id = v_header_id
        and ou.organization_chart_id = v_chart_id
        and ou.ecclesiastical_entity_id = v_scope.entity_id
        and ou.pastoral_area_id is not null
        and ou.is_current = true
    ) <> 15 then
      raise exception 'La jurisdicción % no quedó con 15 pastorales hijas.', v_scope.entity_name;
    end if;

    v_normalized_scopes := v_normalized_scopes + 1;
    v_total_children := v_total_children + 15;
  end loop;

  if v_normalized_scopes <> 10 then
    raise exception 'Se esperaban 10 jurisdicciones por normalizar y se procesaron %.', v_normalized_scopes;
  end if;

  if v_total_children <> 150 then
    raise exception 'Se esperaban 150 unidades hijas normalizadas y se procesaron %.', v_total_children;
  end if;
end;
$migration$;
