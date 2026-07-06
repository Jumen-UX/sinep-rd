-- Correct office category classification.

update office_categories
set name = 'Eclesial',
    description = 'Cargos propios del orden, gobierno o jurisdicción episcopal.',
    updated_at = now()
where key = 'ecclesiastical';

insert into office_categories (key, name, description, sort_order, status)
values
  ('pastoral', 'Pastoral', 'Cargos de coordinación, conducción o acompañamiento pastoral.', 20, 'active'),
  ('administrative', 'Administrativo', 'Cargos de gobierno operativo, curia, administración o gestión institucional.', 30, 'active')
on conflict (key) do update set name = excluded.name, description = excluded.description, updated_at = now();

insert into office_scopes (key, name, adjective_masculine, adjective_feminine, description, sort_order, status)
values
  ('episcopal', 'Episcopal', 'episcopal', 'episcopal', 'Cargo propio del ministerio episcopal.', 25, 'active'),
  ('curial', 'Curial', 'curial', 'curial', 'Cargo ejercido en la curia o gobierno administrativo de una jurisdicción.', 35, 'active')
on conflict (key) do update set name = excluded.name, description = excluded.description, updated_at = now();

insert into office_base_roles (key, name, plural_name, description, sort_order, status)
values
  ('obispo_diocesano', 'Obispo diocesano', 'Obispos diocesanos', 'Obispo a quien se confía el gobierno pastoral de una diócesis.', 5, 'active'),
  ('obispo_auxiliar', 'Obispo auxiliar', 'Obispos auxiliares', 'Obispo que colabora con el obispo diocesano.', 6, 'active'),
  ('vicario_general', 'Vicario general', 'Vicarios generales', 'Colaborador principal del obispo en el gobierno administrativo ordinario.', 35, 'active'),
  ('vicario_episcopal', 'Vicario episcopal', 'Vicarios episcopales', 'Responsable pastoral delegado para un territorio, sector, grupo o área.', 36, 'active')
on conflict (key) do update set name = excluded.name, plural_name = excluded.plural_name, description = excluded.description, updated_at = now();

insert into organization_charts (key, name, description, sort_order, visibility, status)
values
  ('episcopal_governance', 'Gobierno episcopal', 'Cargos propios del gobierno episcopal de una jurisdicción.', 5, 'public', 'active'),
  ('diocesan_curia', 'Curia diocesana', 'Cargos administrativos de la curia o gobierno ordinario de una diócesis.', 25, 'public', 'active')
on conflict (key) do update set name = excluded.name, description = excluded.description, updated_at = now();

with refs as (
  select
    (select id from office_categories where key = 'ecclesiastical') ecclesial_cat,
    (select id from office_categories where key = 'pastoral') pastoral_cat,
    (select id from office_categories where key = 'administrative') admin_cat,
    (select id from office_scopes where key = 'episcopal') episcopal_scope,
    (select id from office_scopes where key = 'diocesan') diocesan_scope,
    (select id from office_scopes where key = 'curial') curial_scope,
    (select id from organization_charts where key = 'episcopal_governance') episcopal_chart,
    (select id from organization_charts where key = 'diocesan_curia') curia_chart,
    (select id from organization_charts where key = 'territorial_pastoral') pastoral_chart
)
insert into office_configurations (base_role_id, scope_id, category_id, organization_chart_id, key, display_name, description, requires_clergy, allowed_person_types, is_elective, is_renewable, default_term_months, continues_until_replaced, sort_order, visibility, status)
select role_id, scope_id, category_id, chart_id, key, display_name, description, true, allowed, false, true, null::integer, true, sort_order, 'public', 'active'
from refs,
(values
  ((select id from office_base_roles where key='obispo_diocesano'), refs.episcopal_scope, refs.ecclesial_cat, refs.episcopal_chart, 'obispo_diocesano', 'Obispo diocesano', 'Obispo titular del gobierno pastoral de una diócesis.', array['bishop']::text[], 5),
  ((select id from office_base_roles where key='obispo_auxiliar'), refs.episcopal_scope, refs.ecclesial_cat, refs.episcopal_chart, 'obispo_auxiliar', 'Obispo auxiliar', 'Obispo auxiliar al servicio de una diócesis o arquidiócesis.', array['bishop']::text[], 6),
  ((select id from office_base_roles where key='vicario_general'), refs.curial_scope, refs.admin_cat, refs.curia_chart, 'vicario_general', 'Vicario general', 'Cargo administrativo de gobierno ordinario delegado por el obispo.', array['bishop','priest']::text[], 35),
  ((select id from office_base_roles where key='vicario_episcopal'), refs.diocesan_scope, refs.pastoral_cat, refs.pastoral_chart, 'vicario_episcopal', 'Vicario episcopal', 'Cargo pastoral delegado para un territorio, sector, grupo o área concreta.', array['bishop','priest']::text[], 36)
) as v(role_id, scope_id, category_id, chart_id, key, display_name, description, allowed, sort_order)
on conflict (key) do update set category_id = excluded.category_id, scope_id = excluded.scope_id, organization_chart_id = excluded.organization_chart_id, display_name = excluded.display_name, description = excluded.description, allowed_person_types = excluded.allowed_person_types, updated_at = now();

update office_configurations
set category_id = (select id from office_categories where key = 'pastoral'),
    organization_chart_id = (select id from organization_charts where key = 'territorial_pastoral'),
    updated_at = now()
where key = 'archipreste_zona_pastoral';
