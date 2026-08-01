-- Direct writes to these foundational catalogs bypass the proposal/RPC
-- contracts and turn the broad internal read helper into a write bypass.
-- Keep reads intact and force mutations through audited SECURITY DEFINER RPCs.
revoke insert, update, delete, truncate, references, trigger
  on public.canonical_event_types,
     public.canonical_relationship_types,
     public.canonical_relationships,
     public.canonical_territories,
     public.civil_geographies,
     public.ecclesial_traditions,
     public.ecclesiastical_groupings,
     public.ecclesiastical_jurisdictions,
     public.jurisdiction_types,
     public.person_death_records,
     public.person_private_validation,
     public.structure_event_types,
     public.structure_kinds,
     public.structure_level_office_configurations,
     public.sui_iuris_churches,
     public.territory_intersections
  from anon, authenticated;

-- Suggestions are intentionally created by public visitors. Only the public
-- INSERT contract survives; review mutations continue through admin RPCs.
revoke update, delete, truncate, references, trigger
  on public.public_change_suggestions
  from anon, authenticated;

drop policy if exists canonical_event_types_admin_delete on public.canonical_event_types;
drop policy if exists canonical_event_types_admin_insert on public.canonical_event_types;
drop policy if exists canonical_event_types_admin_update on public.canonical_event_types;

drop policy if exists canonical_relationship_types_admin_delete on public.canonical_relationship_types;
drop policy if exists canonical_relationship_types_admin_insert on public.canonical_relationship_types;
drop policy if exists canonical_relationship_types_admin_update on public.canonical_relationship_types;

drop policy if exists canonical_relationships_admin_delete on public.canonical_relationships;
drop policy if exists canonical_relationships_admin_insert on public.canonical_relationships;
drop policy if exists canonical_relationships_admin_update on public.canonical_relationships;

drop policy if exists canonical_territories_admin_delete on public.canonical_territories;
drop policy if exists canonical_territories_admin_insert on public.canonical_territories;
drop policy if exists canonical_territories_admin_update on public.canonical_territories;

drop policy if exists civil_geographies_admin_delete on public.civil_geographies;
drop policy if exists civil_geographies_admin_insert on public.civil_geographies;
drop policy if exists civil_geographies_admin_update on public.civil_geographies;

drop policy if exists ecclesial_traditions_admin_delete on public.ecclesial_traditions;
drop policy if exists ecclesial_traditions_admin_insert on public.ecclesial_traditions;
drop policy if exists ecclesial_traditions_admin_update on public.ecclesial_traditions;

drop policy if exists ecclesiastical_groupings_admin_delete on public.ecclesiastical_groupings;
drop policy if exists ecclesiastical_groupings_admin_insert on public.ecclesiastical_groupings;
drop policy if exists ecclesiastical_groupings_admin_update on public.ecclesiastical_groupings;

drop policy if exists ecclesiastical_jurisdictions_admin_delete on public.ecclesiastical_jurisdictions;
drop policy if exists ecclesiastical_jurisdictions_admin_insert on public.ecclesiastical_jurisdictions;
drop policy if exists ecclesiastical_jurisdictions_admin_update on public.ecclesiastical_jurisdictions;

drop policy if exists jurisdiction_types_admin_delete on public.jurisdiction_types;
drop policy if exists jurisdiction_types_admin_insert on public.jurisdiction_types;
drop policy if exists jurisdiction_types_admin_update on public.jurisdiction_types;

drop policy if exists phase0_person_death_records_insert_937d16a on public.person_death_records;
drop policy if exists phase0_person_death_records_remove_b476889 on public.person_death_records;
drop policy if exists phase0_person_death_records_update_f4fbc8c on public.person_death_records;

-- The legacy ALL policy mixed a legitimate internal read rule with writes.
drop policy if exists person_private_validation_admin_all on public.person_private_validation;
create policy person_private_validation_internal_select
on public.person_private_validation
for select
to authenticated
using ((select internal.current_user_has_admin_role()));

drop policy if exists public_change_suggestions_admin_update on public.public_change_suggestions;

drop policy if exists structure_event_types_insert_admin on public.structure_event_types;
drop policy if exists structure_event_types_remove_admin on public.structure_event_types;
drop policy if exists structure_event_types_update_admin on public.structure_event_types;

drop policy if exists structure_kinds_insert_admin on public.structure_kinds;
drop policy if exists structure_kinds_remove_admin on public.structure_kinds;
drop policy if exists structure_kinds_update_admin on public.structure_kinds;

drop policy if exists structure_level_office_configurations_insert_admin on public.structure_level_office_configurations;
drop policy if exists structure_level_office_configurations_remove_admin on public.structure_level_office_configurations;
drop policy if exists structure_level_office_configurations_update_admin on public.structure_level_office_configurations;

drop policy if exists sui_iuris_churches_admin_delete on public.sui_iuris_churches;
drop policy if exists sui_iuris_churches_admin_insert on public.sui_iuris_churches;
drop policy if exists sui_iuris_churches_admin_update on public.sui_iuris_churches;

drop policy if exists territory_intersections_admin_delete on public.territory_intersections;
drop policy if exists territory_intersections_admin_insert on public.territory_intersections;
drop policy if exists territory_intersections_admin_update on public.territory_intersections;

-- Fail the migration atomically if a future grant or policy leaves the bypass
-- open. These checks also document the intended authorization boundary.
do $$
declare
  target_table text;
  protected_tables constant text[] := array[
    'canonical_event_types',
    'canonical_relationship_types',
    'canonical_relationships',
    'canonical_territories',
    'civil_geographies',
    'ecclesial_traditions',
    'ecclesiastical_groupings',
    'ecclesiastical_jurisdictions',
    'jurisdiction_types',
    'person_death_records',
    'person_private_validation',
    'structure_event_types',
    'structure_kinds',
    'structure_level_office_configurations',
    'sui_iuris_churches',
    'territory_intersections'
  ];
begin
  foreach target_table in array protected_tables loop
    if has_table_privilege('authenticated', format('public.%I', target_table), 'INSERT')
      or has_table_privilege('authenticated', format('public.%I', target_table), 'UPDATE')
      or has_table_privilege('authenticated', format('public.%I', target_table), 'DELETE') then
      raise exception 'authenticated conserva escritura directa sobre public.%', target_table;
    end if;

    if exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = target_table
        and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    ) then
      raise exception 'public.% conserva una politica RLS de escritura directa', target_table;
    end if;
  end loop;

  if not has_table_privilege('anon', 'public.public_change_suggestions', 'INSERT')
    or not has_table_privilege('authenticated', 'public.public_change_suggestions', 'INSERT') then
    raise exception 'El contrato publico de insercion de sugerencias fue removido';
  end if;

  if has_table_privilege('authenticated', 'public.public_change_suggestions', 'UPDATE')
    or has_table_privilege('authenticated', 'public.public_change_suggestions', 'DELETE') then
    raise exception 'authenticated conserva revision directa de sugerencias publicas';
  end if;
end
$$;

comment on policy person_private_validation_internal_select on public.person_private_validation
is 'Conserva la lectura interna heredada; las mutaciones solo se permiten mediante contratos RPC auditados.';
