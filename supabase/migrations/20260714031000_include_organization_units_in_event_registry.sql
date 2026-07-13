drop function public.get_event_registry_stream(integer,integer,text,uuid,integer);

create function public.get_event_registry_stream(
  p_year integer default null,
  p_month integer default null,
  p_event_type text default null,
  p_entity_id uuid default null,
  p_limit integer default 120
)
returns table(
  source_kind text,
  event_id uuid,
  event_date date,
  event_year integer,
  event_month integer,
  event_day integer,
  title text,
  event_type_key text,
  event_type_name text,
  related_entity_id uuid,
  related_entity_name text,
  related_entity_type_key text,
  source_name text,
  source_url text,
  evidence_status text,
  load_mode text,
  workflow_status text,
  related_target_kind text,
  related_organization_unit_id uuid,
  related_organization_unit_name text
)
language sql
stable
set search_path to public
as $$
  with unified_events as (
    select
      'historical_event'::text source_kind,
      eee.id event_id,
      eee.event_date,
      extract(year from eee.event_date)::int event_year,
      extract(month from eee.event_date)::int event_month,
      extract(day from eee.event_date)::int event_day,
      eee.title,
      eee.event_type event_type_key,
      case eee.event_type
        when 'erection' then 'Erección'
        when 'erection_by_dismemberment' then 'Erección por desmembramiento'
        when 'dismemberment' then 'Desmembramiento'
        when 'territory_loss' then 'Pérdida territorial'
        when 'elevation' then 'Elevación'
        when 'name_change' then 'Cambio de nombre'
        when 'suppression' then 'Supresión'
        when 'division' then 'División'
        when 'union' then 'Unión / fusión'
        else initcap(replace(eee.event_type,'_',' '))
      end event_type_name,
      eee.entity_id related_entity_id,
      ent.name related_entity_name,
      et.key related_entity_type_key,
      eee.source_name,
      eee.source_url,
      eee.verification_status evidence_status,
      'carga_historica'::text load_mode,
      eee.status workflow_status,
      'entity'::text related_target_kind,
      null::uuid related_organization_unit_id,
      null::text related_organization_unit_name,
      eee.entity_id scope_entity_id
    from public.entity_evolution_events eee
    join public.ecclesiastical_entities ent on ent.id=eee.entity_id
    join public.entity_types et on et.id=ent.entity_type_id
    where eee.visibility='public' and eee.status='active'

    union all

    select
      'canonical_event'::text,
      ce.id,
      coalesce(ce.effective_date,ce.event_date),
      extract(year from coalesce(ce.effective_date,ce.event_date))::int,
      extract(month from coalesce(ce.effective_date,ce.event_date))::int,
      extract(day from coalesce(ce.effective_date,ce.event_date))::int,
      ce.title,
      cet.key,
      cet.name,
      participant.entity_id,
      coalesce(
        participant.entity_name,
        participant.organization_unit_name,
        case when cet.applies_to='organization_unit' then ce.notes_json->'raw_payload'->>'name' end
      ),
      coalesce(
        participant.entity_type_key,
        case when cet.applies_to='organization_unit' then 'organization_unit' end
      ),
      ce.source_name_text,
      ce.source_url_text,
      ce.evidence_status,
      ce.load_mode,
      ce.status,
      case when cet.applies_to='organization_unit' then 'organization_unit' else 'entity' end,
      participant.organization_unit_id,
      coalesce(
        participant.organization_unit_name,
        case when cet.applies_to='organization_unit' then ce.notes_json->'raw_payload'->>'name' end
      ),
      coalesce(participant.entity_id,participant.organization_scope_entity_id,ce.authority_entity_id)
    from public.canonical_events ce
    join public.canonical_event_types cet on cet.id=ce.event_type_id
    left join lateral (
      select
        cep.entity_id,
        ent.name entity_name,
        et.key entity_type_key,
        cep.organization_unit_id,
        ou.name organization_unit_name,
        ou.ecclesiastical_entity_id organization_scope_entity_id
      from public.canonical_event_participants cep
      left join public.ecclesiastical_entities ent on ent.id=cep.entity_id
      left join public.entity_types et on et.id=ent.entity_type_id
      left join public.organization_units ou on ou.id=cep.organization_unit_id
      where cep.event_id=ce.id
      order by case cep.role
        when 'created_entity' then 1
        when 'created_unit' then 1
        when 'affected_jurisdiction' then 2
        when 'affected_unit' then 2
        when 'mother_jurisdiction' then 3
        else 9
      end,cep.created_at
      limit 1
    ) participant on true
    where ce.status in ('draft','pending_review','approved','applied')

    union all

    select
      'calendar_occurrence'::text,
      eo.id,
      eo.occurrence_date,
      extract(year from eo.occurrence_date)::int,
      extract(month from eo.occurrence_date)::int,
      extract(day from eo.occurrence_date)::int,
      eo.title,
      evt.key,
      evt.name,
      eo.related_entity_id,
      ent.name,
      et.key,
      eo.source_table,
      null::text,
      case when eo.source_id is null then 'generado_sin_fuente_directa' else 'generado_desde_dato_base' end,
      'evento_calendario'::text,
      eo.status,
      'entity'::text,
      null::uuid,
      null::text,
      eo.related_entity_id
    from public.event_occurrences eo
    join public.event_types evt on evt.id=eo.event_type_id
    left join public.ecclesiastical_entities ent on ent.id=eo.related_entity_id
    left join public.entity_types et on et.id=ent.entity_type_id
    where eo.visibility='public' and eo.status='active'
  )
  select
    ue.source_kind,
    ue.event_id,
    ue.event_date,
    ue.event_year,
    ue.event_month,
    ue.event_day,
    ue.title,
    ue.event_type_key,
    ue.event_type_name,
    ue.related_entity_id,
    ue.related_entity_name,
    ue.related_entity_type_key,
    ue.source_name,
    ue.source_url,
    ue.evidence_status,
    ue.load_mode,
    ue.workflow_status,
    ue.related_target_kind,
    ue.related_organization_unit_id,
    ue.related_organization_unit_name
  from unified_events ue
  where (p_year is null or ue.event_year=p_year)
    and (p_month is null or ue.event_month=p_month)
    and (p_event_type is null or ue.event_type_key=p_event_type)
    and (p_entity_id is null or ue.scope_entity_id=p_entity_id)
  order by ue.event_date desc nulls last,ue.title
  limit greatest(1,least(coalesce(p_limit,120),300));
$$;

revoke all on function public.get_event_registry_stream(integer,integer,text,uuid,integer) from public;
grant execute on function public.get_event_registry_stream(integer,integer,text,uuid,integer)
to anon,authenticated,service_role;
