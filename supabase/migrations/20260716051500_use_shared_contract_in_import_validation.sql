do $migration$
declare
  v_definition text;
  v_original_required text := $required$
  v_required_fields := case v_batch.import_type
    when 'personas' then array['tipo_persona', 'primer_nombre', 'primer_apellido']
    when 'parroquias' then array['pais_iso2', 'diocesis', 'tipo_entidad', 'nombre']
    when 'asignaciones' then array['persona', 'cargo', 'entidad', 'fecha_inicio']
    when 'eventos' then array['tipo_evento', 'fecha_efectiva', 'entidad', 'descripcion']
    else array[]::text[]
  end;
$required$;
  v_shared_required text := $required$
  select coalesce(array_agg(required_field order by ordinality), '{}'::text[])
    into v_required_fields
  from jsonb_array_elements_text(
    app_private.import_domain_staging_contract(v_batch.import_type) -> 'required_fields'
  ) with ordinality as required(required_field, ordinality);
$required$;
  v_original_relations text := $relations$
    for v_relation_field, v_relation_kind in
      select relation_field, relation_kind
      from (
        values
          ('personas', 'entidad_actual', 'entity'),
          ('parroquias', 'diocesis', 'entity'),
          ('parroquias', 'nivel_padre', 'entity'),
          ('asignaciones', 'persona', 'person'),
          ('asignaciones', 'cargo', 'office'),
          ('asignaciones', 'entidad', 'entity'),
          ('eventos', 'entidad', 'entity')
      ) relation(import_type, relation_field, relation_kind)
      where relation.import_type = v_batch.import_type
    loop
$relations$;
  v_shared_relations text := $relations$
    for v_relation_field, v_relation_kind in
      select relation.key, relation.value
      from jsonb_each_text(
        app_private.import_domain_staging_contract(v_batch.import_type) -> 'relation_fields'
      ) relation
      order by relation.key
    loop
$relations$;
begin
  select pg_get_functiondef('app_private.validate_import_batch(uuid)'::regprocedure)
    into v_definition;

  if position(v_original_required in v_definition) = 0 then
    raise exception 'No se encontró el bloque heredado de campos requeridos.';
  end if;

  if position(v_original_relations in v_definition) = 0 then
    raise exception 'No se encontró el bloque heredado de relaciones.';
  end if;

  v_definition := replace(v_definition, v_original_required, v_shared_required);
  v_definition := replace(v_definition, v_original_relations, v_shared_relations);
  execute v_definition;
end;
$migration$;
