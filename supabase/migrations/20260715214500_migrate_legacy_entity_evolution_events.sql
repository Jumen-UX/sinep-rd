-- Migra hechos históricos heredados al registro canónico sin aprobarlos ni aplicarlos.
-- La referencia al ID heredado en notes_json hace la operación idempotente.

do $$
declare
  legacy_event public.entity_evolution_events%rowtype;
  canonical_event_id uuid;
  canonical_type_key text;
  canonical_type_id uuid;
  canonical_evidence_status text;
begin
  for legacy_event in
    select *
    from public.entity_evolution_events
    where status = 'active'
    order by created_at, id
  loop
    if exists (
      select 1
      from public.canonical_events ce
      where ce.notes_json ->> 'legacy_entity_evolution_event_id' = legacy_event.id::text
    ) then
      continue;
    end if;

    canonical_type_key := case legacy_event.event_type
      when 'erection_by_dismemberment' then 'erection'
      when 'territory_loss' then 'boundary_change'
      else legacy_event.event_type
    end;

    select cet.id
    into canonical_type_id
    from public.canonical_event_types cet
    where cet.key = canonical_type_key
      and cet.is_active = true;

    if canonical_type_id is null then
      raise exception 'No existe tipo canónico activo para el evento heredado % (%)', legacy_event.id, legacy_event.event_type;
    end if;

    canonical_evidence_status := case
      when nullif(btrim(legacy_event.source_name), '') is not null then 'fuente_secundaria'
      else 'pendiente_documento'
    end;

    insert into public.canonical_events (
      event_type_id,
      title,
      description,
      event_date,
      effective_date,
      status,
      load_mode,
      evidence_status,
      source_name_text,
      source_url_text,
      notes_json,
      created_at,
      updated_at
    ) values (
      canonical_type_id,
      legacy_event.title,
      legacy_event.description,
      legacy_event.event_date,
      legacy_event.event_date,
      'pending_review',
      'carga_historica',
      canonical_evidence_status,
      legacy_event.source_name,
      legacy_event.source_url,
      jsonb_strip_nulls(jsonb_build_object(
        'legacy_source_table', 'entity_evolution_events',
        'legacy_entity_evolution_event_id', legacy_event.id,
        'legacy_event_type', legacy_event.event_type,
        'legacy_verification_status', legacy_event.verification_status,
        'legacy_source_checked_at', legacy_event.source_checked_at,
        'legacy_visibility', legacy_event.visibility,
        'canonical_effect', legacy_event.canonical_effect,
        'territory_summary', legacy_event.territory_summary,
        'notes_public', legacy_event.notes_public,
        'normalized_event_type', canonical_type_key,
        'migration_review_required', true
      )),
      legacy_event.created_at,
      legacy_event.updated_at
    )
    returning id into canonical_event_id;

    insert into public.canonical_event_participants (event_id, entity_id, role)
    values (
      canonical_event_id,
      legacy_event.entity_id,
      case
        when canonical_type_key = 'erection' then 'created_entity'
        when canonical_type_key = 'suppression' then 'suppressed_entity'
        else 'affected_jurisdiction'
      end
    );

    if legacy_event.from_entity_id is not null and legacy_event.from_entity_id <> legacy_event.entity_id then
      insert into public.canonical_event_participants (event_id, entity_id, role)
      values (canonical_event_id, legacy_event.from_entity_id, 'origin_entity');
    end if;

    if legacy_event.to_entity_id is not null
       and legacy_event.to_entity_id <> legacy_event.entity_id
       and legacy_event.to_entity_id is distinct from legacy_event.from_entity_id then
      insert into public.canonical_event_participants (event_id, entity_id, role)
      values (canonical_event_id, legacy_event.to_entity_id, 'destination_entity');
    end if;

    if legacy_event.related_entity_id is not null
       and legacy_event.related_entity_id <> legacy_event.entity_id
       and legacy_event.related_entity_id is distinct from legacy_event.from_entity_id
       and legacy_event.related_entity_id is distinct from legacy_event.to_entity_id then
      insert into public.canonical_event_participants (event_id, entity_id, role)
      values (canonical_event_id, legacy_event.related_entity_id, 'source_entity');
    end if;
  end loop;
end;
$$;
