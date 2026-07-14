create or replace function public.get_structure_level_office_options(p_level_id uuid)
returns jsonb
language sql
stable
set search_path to 'public', 'app_private', 'pg_temp'
as $function$
  with level_context as (
    select sl.id, sl.level_key, sl.template_id
    from public.structure_levels sl
    where sl.id = p_level_id
  ),
  allowed_charts as (
    select distinct oc.organization_chart_id
    from level_context lc
    join public.structure_levels peer on peer.level_key = lc.level_key
    join public.structure_level_office_configurations m
      on m.level_id = peer.id
     and m.status = 'active'
    join public.office_configurations oc
      on oc.id = m.office_configuration_id
     and oc.status = 'active'
    where oc.organization_chart_id is not null
  )
  select case
    when app_private.structure_template_in_scope(lc.template_id) then
      jsonb_build_object(
        'configured', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', oc.id,
              'key', oc.key,
              'display_name', oc.display_name,
              'is_default', m.is_default,
              'sort_order', m.sort_order
            )
            order by m.sort_order, oc.display_name
          )
          from public.structure_level_office_configurations m
          join public.office_configurations oc
            on oc.id = m.office_configuration_id
          where m.level_id = lc.id
            and m.status = 'active'
            and oc.status = 'active'
        ), '[]'::jsonb),
        'available', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', oc.id,
              'key', oc.key,
              'display_name', oc.display_name,
              'description', oc.description,
              'requires_clergy', oc.requires_clergy,
              'organization_chart_id', oc.organization_chart_id
            )
            order by oc.sort_order, oc.display_name
          )
          from public.office_configurations oc
          where oc.status = 'active'
            and oc.organization_chart_id in (select organization_chart_id from allowed_charts)
        ), '[]'::jsonb),
        'has_explicit_scope', exists(select 1 from allowed_charts)
      )
    else null
  end
  from level_context lc;
$function$;

comment on function public.get_structure_level_office_options(uuid) is
  'Devuelve cargos configurados y opciones limitadas a las familias de organigrama ya asociadas al mismo tipo de nivel. Nunca recurre silenciosamente a todos los cargos activos.';
