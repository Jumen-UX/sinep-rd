# Alcances canónicos de autorización

> Estado: implementado en base de datos y navegación administrativa  
> Última revisión: 2026-07-28  
> Alcance: roles, asignaciones, navegación, RLS y compatibilidad heredada

## Objetivo

La autorización administrativa de SINEP debe distinguir entre:

- jurisdicciones y entidades eclesiales;
- nodos de una estructura territorial;
- áreas pastorales;
- unidades organizativas;
- países;
- acceso técnico global.

Los identificadores de estas categorías no son intercambiables. Cada uno pertenece a una tabla y una clave foránea distinta.

## Vocabulario canónico

`user_role_assignments.scope_type` admite exclusivamente:

| Valor | Significado | Identificador principal |
| --- | --- | --- |
| `global` | acceso técnico irrestricto | ninguno |
| `national` | país | `scope_entity_id` hacia entidad `country` |
| `diocese` | jurisdicción diocesana | `scope_entity_id` y `diocese_id` |
| `vicariate` | vicaría estructural | `structure_node_id` |
| `zone` | zona estructural | `structure_node_id` |
| `parish` | parroquia o cuasiparroquia | `scope_entity_id` |
| `entity` | entidad eclesial o nodo estructural genérico | `scope_entity_id` o `structure_node_id` |
| `pastoral_area` | área pastoral transversal | `pastoral_area_id` |
| `organization_unit` | unidad administrativa, pastoral o colegial | `organization_unit_id` |

`super_admin` se normaliza siempre a `global` y no conserva país ni identificadores de ámbito.

## Alias históricos

`normalize_authorization_scope_type` mantiene compatibilidad de lectura y migración:

- `country` → `national`;
- `archdiocese` y `apostolic_vicariate` → `diocese`;
- `pastoral_zone` → `zone`;
- `quasi_parish` → `parish`;
- `chapel` y `ecclesiastical_province` → `entity`;
- `pastoral_entity` → `organization_unit`;
- `other` → `unknown`.

Los alias no se almacenan en nuevas asignaciones.

## Separación de claves

### Entidades eclesiales

`scope_entity_id` conserva su clave foránea exclusiva hacia `ecclesiastical_entities`.

Se utiliza para:

- países;
- diócesis y jurisdicciones equivalentes;
- parroquias y cuasiparroquias;
- entidades eclesiales genéricas;
- entidad territorial de respaldo de una unidad o nodo cuando es necesario derivar país o diócesis.

### Nodos estructurales

`structure_node_id` apunta a `structure_nodes` y representa:

- vicarías;
- zonas;
- nodos estructurales genéricos.

Un nodo puede conservar una entidad diocesana como respaldo en `scope_entity_id`, pero ese respaldo no sustituye al identificador canónico ni amplía el alcance.

### Áreas y unidades

- `pastoral_area_id` apunta a `pastoral_areas`;
- `organization_unit_id` apunta a `organization_units`.

El país de un área pastoral se deriva desde sus unidades activas. Si un área abarca más de un país, la asignación es rechazada hasta resolver el conflicto de datos.

## Validación de escritura

`derive_role_assignment_country_context` normaliza y valida toda inserción o actualización:

1. identifica el rol;
2. normaliza `scope_type`;
3. verifica que el identificador corresponda a la tabla y categoría esperadas;
4. deriva entidad de respaldo y diócesis cuando aplica;
5. resuelve `country_iso2`;
6. rechaza contradicciones de país;
7. limpia identificadores que no corresponden al tipo seleccionado.

Los `CHECK` de `user_role_assignments` validan tanto el vocabulario como la forma de cada destino.

## Despachador tipado

`current_user_can_manage_scope` exige un permiso explícito y delega según el tipo:

- país → `current_user_can_manage_country`;
- entidad → `current_user_can_manage_entity`;
- nodo → `current_user_can_manage_structure_node`;
- área → `current_user_can_manage_pastoral_area`;
- unidad → `current_user_can_manage_organization_unit`;
- persona → `current_user_can_manage_person`.

Un alcance `national` sin entidad país devuelve `false`. Una asignación nacional solo opera dentro de su `country_iso2`.

## Compatibilidad heredada

### `current_user_can`

La fachada pública se conserva temporalmente para consumidores existentes. Es `SECURITY DEFINER`, pero delega exclusivamente en el despachador tipado. `anon` no puede ejecutarla.

### `current_user_has_scope_access`

La implementación privada fue corregida para comparar país y destino exacto. La fachada pública está revocada para `anon` y `authenticated`.

No debe utilizarse en nuevas fronteras. El único consumidor funcional pendiente es `admin_create_person_change_proposal`; actualmente utiliza la fachada segura `current_user_can` y deberá migrarse durante el refactor estático del dominio de personas.

### `current_user_is_super_or_national`

Fue eliminado de las políticas corregidas de:

- lotes de importación;
- revisiones canónicas de nombramientos;
- asignaciones de roles;
- catálogos de roles y permisos.

Las únicas referencias RLS restantes están en las políticas de mutación del bucket `person-photos`.

## RLS y privilegios

### Asignaciones

`user_role_assignments_select_scoped` permite:

- ver las asignaciones propias;
- ver asignaciones de usuarios gestionables mediante países compartidos.

Las mutaciones directas están revocadas. La escritura se realiza mediante RPC auditados.

### Lotes

`import_batches_select_scoped` permite:

- ver lotes propios;
- ver lotes cuya entidad sea gestionable con `imports.prepare`, `imports.review` o `imports.apply`.

`national_admin` no es un bypass global.

### Revisiones canónicas

`assignment_canonical_reviews_select_scoped` valida la entidad o unidad organizativa del nombramiento relacionado mediante `appointments.view`.

### Catálogos

`roles`, `permissions` y `role_permissions` son catálogos legibles por usuarios autenticados. Sus mutaciones directas permanecen revocadas.

## Navegación y payloads

La navegación administrativa consulta `structure_node_id` y selecciona el identificador activo según `scope_type`:

- vicaría/zona → nodo;
- área pastoral → área;
- unidad → unidad;
- país/diócesis/parroquia → entidad;
- `entity` → nodo o entidad según su origen.

`admin_list_users` y `get_my_onboarding_context` devuelven:

- `scope_type`;
- `scope_label`;
- `scope_entity_id`;
- `structure_node_id`;
- `country_iso2`;
- `diocese_id`;
- `pastoral_area_id`;
- `organization_unit_id`.

## Evidencia transaccional

Las pruebas temporales finalizaron con `ROLLBACK`.

### País

Para el administrador nacional DO:

- DO con `entities.view` → `true`;
- ES con `entities.view` → `false`;
- `national` sin entidad país → `false`.

### Opciones de asignación

El administrador DO recibió únicamente opciones de su país, separadas en:

- país;
- diócesis;
- parroquias;
- vicarías;
- zonas;
- nodos genéricos;
- entidades eclesiales;
- unidades organizativas.

### Persistencia

Se validaron de forma reversible:

- una vicaría con `structure_node_id`;
- una unidad con `organization_unit_id`;
- una entidad basada en nodo que preserva `structure_node_id`.

### RLS de asignaciones

El administrador DO vio tres asignaciones DO y ninguna asignación del `super_admin`.

## Contratos automatizados

`tests/canonical-role-scope-contract.test.mjs` protege:

- las ocho migraciones aplicadas;
- el vocabulario canónico;
- las claves dedicadas;
- la fachada segura;
- la preservación de nodos;
- etiquetas de onboarding;
- RLS sin bypass nacional;
- navegación por identificador canónico;
- catálogos sin helpers administrativos redundantes.

## Riesgos y pendientes

- El bucket público `person-photos` no contiene objetos, pero sus políticas de mutación aún utilizan `current_user_is_super_or_national`. Debe definirse primero una convención de rutas y vinculación a `person_id` antes de endurecerlas sin romper el flujo futuro.
- `admin_create_person_change_proposal` conserva un adaptador heredado seguro; su función es extensa y requiere un refactor estático, no una sustitución dinámica de texto SQL.
- Los roles históricos `diocesan_admin` e `internal_viewer` permanecen con alcance `national` porque así están configurados actualmente. La normalización no inventa una diócesis que no fue seleccionada por un administrador.
- La validación E2E final sigue requiriendo cuentas nacionales, diocesanas y pastorales independientes con secretos protegidos.
