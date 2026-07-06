-- Seed initial office catalog for multiple simultaneous clergy assignments.
-- Applied to project hrvgpceqaxujlttpimdz on 2026-07-06.

insert into office_categories (key, name, description, sort_order, status)
values
  ('ecclesiastical', 'Eclesiástico', 'Oficios y cargos canónicos o de gobierno eclesial.', 10, 'active'),
  ('pastoral', 'Pastoral', 'Servicios de coordinación, dirección o acompañamiento pastoral.', 20, 'active'),
  ('administrative', 'Administrativo', 'Servicios administrativos, técnicos o de gestión institucional.', 30, 'active')
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  status = excluded.status,
  updated_at = now();

insert into office_scopes (key, name, adjective_masculine, adjective_feminine, description, sort_order, status)
values
  ('parish', 'Parroquial', 'parroquial', 'parroquial', 'Cargo ejercido en una parroquia o cuasi-parroquia.', 10, 'active'),
  ('pastoral_zone', 'Zona pastoral', 'zonal', 'zonal', 'Cargo ejercido en una zona pastoral, decanato o archiprestazgo.', 20, 'active'),
  ('diocesan', 'Diocesano', 'diocesano', 'diocesana', 'Cargo ejercido en el ámbito de una diócesis o arquidiócesis.', 30, 'active'),
  ('national', 'Nacional', 'nacional', 'nacional', 'Cargo ejercido en el ámbito nacional.', 40, 'active')
on conflict (key) do update set
  name = excluded.name,
  adjective_masculine = excluded.adjective_masculine,
  adjective_feminine = excluded.adjective_feminine,
  description = excluded.description,
  sort_order = excluded.sort_order,
  status = excluded.status,
  updated_at = now();

insert into office_base_roles (key, name, feminine_name, plural_name, description, sort_order, status)
values
  ('parroco', 'Párroco', null, 'Párrocos', 'Sacerdote a quien se confía el cuidado pastoral propio de una parroquia.', 10, 'active'),
  ('administrador_parroquial', 'Administrador parroquial', null, 'Administradores parroquiales', 'Sacerdote designado para administrar pastoralmente una parroquia cuando no hay párroco o por necesidad pastoral.', 20, 'active'),
  ('vicario_parroquial', 'Vicario parroquial', null, 'Vicarios parroquiales', 'Sacerdote colaborador del párroco en la atención pastoral de una parroquia.', 30, 'active'),
  ('archipreste', 'Archipreste / Decano', null, 'Archiprestes / Decanos', 'Sacerdote encargado de coordinar una zona pastoral, decanato o archiprestazgo.', 40, 'active'),
  ('director_pastoral', 'Director de pastoral', 'Directora de pastoral', 'Directores de pastoral', 'Persona encargada de dirigir o coordinar una pastoral específica.', 50, 'active'),
  ('coordinador_pastoral', 'Coordinador de pastoral', 'Coordinadora de pastoral', 'Coordinadores de pastoral', 'Persona encargada de coordinar un área, equipo o programa pastoral.', 60, 'active')
on conflict (key) do update set
  name = excluded.name,
  feminine_name = excluded.feminine_name,
  plural_name = excluded.plural_name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  status = excluded.status,
  updated_at = now();

insert into organization_charts (key, name, description, sort_order, visibility, status)
values
  ('parish_ministry', 'Organización parroquial', 'Cargos y servicios propios de una parroquia.', 10, 'public', 'active'),
  ('territorial_pastoral', 'Organización territorial pastoral', 'Cargos de coordinación en zonas, decanatos, archiprestazgos y divisiones pastorales.', 20, 'public', 'active'),
  ('diocesan_pastoral', 'Pastorales diocesanas', 'Direcciones, coordinaciones y equipos de pastoral diocesana.', 30, 'public', 'active')
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  visibility = excluded.visibility,
  status = excluded.status,
  updated_at = now();

with refs as (
  select
    (select id from office_categories where key = 'ecclesiastical') as ecclesiastical_category_id,
    (select id from office_categories where key = 'pastoral') as pastoral_category_id,
    (select id from office_scopes where key = 'parish') as parish_scope_id,
    (select id from office_scopes where key = 'pastoral_zone') as zone_scope_id,
    (select id from office_scopes where key = 'diocesan') as diocesan_scope_id,
    (select id from organization_charts where key = 'parish_ministry') as parish_chart_id,
    (select id from organization_charts where key = 'territorial_pastoral') as territorial_chart_id,
    (select id from organization_charts where key = 'diocesan_pastoral') as diocesan_pastoral_chart_id,
    (select id from office_base_roles where key = 'parroco') as parroco_role_id,
    (select id from office_base_roles where key = 'administrador_parroquial') as administrador_role_id,
    (select id from office_base_roles where key = 'vicario_parroquial') as vicario_role_id,
    (select id from office_base_roles where key = 'archipreste') as archipreste_role_id,
    (select id from office_base_roles where key = 'director_pastoral') as director_pastoral_role_id,
    (select id from office_base_roles where key = 'coordinador_pastoral') as coordinador_pastoral_role_id
)
insert into office_configurations (
  base_role_id, scope_id, category_id, organization_chart_id, key, display_name, description,
  requires_clergy, allowed_person_types, is_elective, is_renewable, default_term_months,
  continues_until_replaced, sort_order, visibility, status
)
select * from (
  select refs.parroco_role_id, refs.parish_scope_id, refs.ecclesiastical_category_id, refs.parish_chart_id,
         'parroco_parroquial', 'Párroco', 'Párroco de una parroquia concreta.', true, array['priest']::text[], false, true, null::integer, true, 10, 'public', 'active'
  from refs
  union all
  select refs.administrador_role_id, refs.parish_scope_id, refs.ecclesiastical_category_id, refs.parish_chart_id,
         'administrador_parroquial', 'Administrador parroquial', 'Administrador pastoral de una parroquia concreta.', true, array['priest']::text[], false, true, null::integer, true, 20, 'public', 'active'
  from refs
  union all
  select refs.vicario_role_id, refs.parish_scope_id, refs.ecclesiastical_category_id, refs.parish_chart_id,
         'vicario_parroquial', 'Vicario parroquial', 'Vicario o colaborador sacerdotal de una parroquia concreta.', true, array['priest']::text[], false, true, null::integer, true, 30, 'public', 'active'
  from refs
  union all
  select refs.archipreste_role_id, refs.zone_scope_id, refs.ecclesiastical_category_id, refs.territorial_chart_id,
         'archipreste_zona_pastoral', 'Archipreste / Decano', 'Responsable de coordinación pastoral de una zona, decanato o archiprestazgo.', true, array['priest']::text[], false, true, null::integer, true, 40, 'public', 'active'
  from refs
  union all
  select refs.director_pastoral_role_id, refs.diocesan_scope_id, refs.pastoral_category_id, refs.diocesan_pastoral_chart_id,
         'director_pastoral_diocesana', 'Director de pastoral', 'Director de una pastoral, comisión o área pastoral.', false, array['bishop','priest','deacon','religious','layperson']::text[], false, true, null::integer, true, 50, 'public', 'active'
  from refs
  union all
  select refs.coordinador_pastoral_role_id, refs.diocesan_scope_id, refs.pastoral_category_id, refs.diocesan_pastoral_chart_id,
         'coordinador_pastoral_diocesana', 'Coordinador de pastoral', 'Coordinador de una pastoral, comisión o programa pastoral.', false, array['bishop','priest','deacon','religious','layperson']::text[], false, true, null::integer, true, 60, 'public', 'active'
  from refs
) as values_to_insert
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
  visibility = excluded.visibility,
  status = excluded.status,
  updated_at = now();
