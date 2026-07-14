begin;

-- Los cargos de cardinalidad múltiple no deben cerrar automáticamente a otro
-- titular solo porque el consumidor envíe close_previous_current=true. En esos
-- casos la sustitución requiere un predecessor_assignment_id explícito.
do $$
declare
  v_definition text;
  v_old text := 'elsif v_is_current and v_close_previous and v_person_id is not null then';
  v_new text := 'elsif v_is_current and v_close_previous and v_person_id is not null and v_holder_cardinality = ''single'' then';
begin
  select pg_get_functiondef('internal.admin_save_position_assignment(jsonb)'::regprocedure)
  into v_definition;

  if position(v_new in v_definition) = 0 then
    if position(v_old in v_definition) = 0 then
      raise exception 'No se encontró el bloque esperado de cierre automático en internal.admin_save_position_assignment';
    end if;

    execute replace(v_definition, v_old, v_new);
  end if;
end;
$$;

-- Evita dos nombramientos actuales idénticos para la misma persona, cargo y
-- ámbito, sin impedir que varias personas ocupen legítimamente un cargo múltiple.
create unique index if not exists position_assignments_current_person_scope_uidx
on public.position_assignments (
  person_id,
  office_configuration_id,
  coalesce(organization_chart_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(organization_unit_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(ecclesiastical_entity_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
where is_current = true
  and record_status = 'active'
  and person_id is not null;

-- Si algún sucesor registró como predecesor uno de los nombramientos que se va
-- a restaurar, se elimina primero ese enlace individual falso.
update public.position_assignments successor
set predecessor_assignment_id = null,
    updated_at = now()
from public.position_assignments previous
join public.office_configurations office
  on office.id = previous.office_configuration_id
where successor.id = previous.successor_assignment_id
  and successor.predecessor_assignment_id = previous.id
  and office.holder_cardinality = 'multiple'
  and previous.assignment_status = 'replaced'
  and previous.is_current = false
  and previous.actual_end_date = previous.start_date
  and previous.successor_assignment_id is not null
  and previous.notes_internal ilike '%Directorio de Parroquias%Arquidiócesis de Santo Domingo%Enero 2026%';

-- El directorio de enero de 2026 describía varios vicarios coexistentes. Estos
-- registros fueron cerrados como sucesiones por una versión anterior del
-- importador; se restauran como nombramientos actuales sin enlaces falsos.
update public.position_assignments previous
set is_current = true,
    assignment_status = 'active',
    actual_end_date = null,
    successor_assignment_id = null,
    replaced_by_assignment_id = null,
    notes_internal = concat_ws(
      E'\n',
      previous.notes_internal,
      'Nombramiento restaurado como titular coexistente: el cargo admite múltiples ocupantes y el directorio fuente los registra en la misma fecha.'
    ),
    updated_at = now()
from public.office_configurations office
where office.id = previous.office_configuration_id
  and office.holder_cardinality = 'multiple'
  and previous.assignment_status = 'replaced'
  and previous.is_current = false
  and previous.actual_end_date = previous.start_date
  and previous.successor_assignment_id is not null
  and previous.notes_internal ilike '%Directorio de Parroquias%Arquidiócesis de Santo Domingo%Enero 2026%';

commit;
