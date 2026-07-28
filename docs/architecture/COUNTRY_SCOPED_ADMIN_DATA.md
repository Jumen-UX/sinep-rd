# Datos administrativos y exportaciones por alcance

> Estado: implementado e integrado en UI como parte de la fase 2F  
> Última revisión: 2026-07-28  
> Alcance: auditoría, búsqueda interna, documentos, KPI, reconstrucción histórica y exportaciones CSV

## Objetivo

Las consultas administrativas deben respetar simultáneamente:

- país;
- raíz territorial;
- unidad organizativa o área pastoral;
- permisos granulares;
- visibilidad del registro;
- separación entre lectura y mutación.

Un administrador nacional solo consulta su país. Un editor pastoral puede consultar su unidad o sus descendientes, pero no la unidad hermana ni toda la diócesis utilizada como entidad de respaldo.

## Migraciones

El bloque se implementó mediante ocho migraciones aplicadas y versionadas en el mismo orden:

1. `20260728193430_scope_audit_and_generic_units_by_country.sql`;
2. `20260728193615_grant_scoped_audit_read.sql`;
3. `20260728193829_scope_search_and_documents_by_country.sql`;
4. `20260728193923_grant_scoped_search_document_rpc_helpers.sql`;
5. `20260728194100_scope_admin_reports_by_country.sql`;
6. `20260728194950_support_pastoral_document_roots.sql`;
7. `20260728195113_prevent_pastoral_scope_entity_escalation.sql`;
8. `20260728200434_consolidate_document_select_rls.sql`.

Las migraciones correctivas permanecen separadas para reproducir exactamente la evolución aplicada en producción.

## Helpers genéricos de alcance

### País

`current_user_can_manage_country(permission, country_iso2)` exige:

- perfil activo;
- permiso solicitado;
- membresía activa en el país;
- asignación nacional del mismo país.

Solo `super_admin` puede operar sin limitarse a un país.

### Unidad organizativa

`current_user_can_manage_organization_unit(permission, unit_id)` admite dos vías independientes:

1. una asignación territorial real que administra la entidad de respaldo;
2. una asignación directa a la unidad, a una unidad ancestro o al área pastoral.

La delegación territorial solo se utiliza cuando la asignación no tiene `organization_unit_id` ni `pastoral_area_id`. Esto impide que un `scope_entity_id` auxiliar amplíe una asignación pastoral a toda la diócesis.

`current_user_can_manage_calendar_unit` delega en el mismo helper para mantener una única regla de seguridad.

### Área pastoral

`current_user_can_manage_pastoral_area` autoriza por:

- una unidad perteneciente al área;
- una asignación exacta al área;
- `super_admin` con el permiso correspondiente.

## Auditoría

### Lectura

`audit_logs_select_scoped` reemplaza las políticas administrativas globales.

Una fila es visible cuando el actor puede administrar con `audit.view` o `security.view` alguno de estos ámbitos:

- `scope_entity_id`;
- `organization_unit_id`;
- `pastoral_area_id`;
- `country_iso2`.

Una fila sin ámbito resoluble queda reservada a `super_admin`.

`admin_list_recent_audit_logs` aplica el mismo helper por fila. La vista `admin_audit_log` continúa como `security_invoker` y recibe únicamente las filas permitidas por RLS.

### Escritura

`admin_write_audit_log`:

1. deriva el permiso de la acción;
2. resuelve entidad, diócesis, unidad y área pastoral;
3. deriva el país;
4. valida el alcance;
5. inserta la fila con resultado y permiso trazables.

Los clientes no poseen `INSERT`, `UPDATE` ni `DELETE` sobre `audit_logs`.

La función pública heredada `create_audit_log` continúa existiendo por compatibilidad interna, pero `anon` y `authenticated` no pueden ejecutarla.

## Búsqueda administrativa

`admin_search_catalog` combina personas, entidades y unidades, pero cada fuente utiliza una autorización distinta:

- personas: `current_user_can_manage_person('people.view', person_id)`;
- entidades: `current_user_can_manage_entity('entities.view', entity_id)`;
- unidades: `current_user_can_manage_organization_unit('pastorals.view', unit_id)`.

`admin_list_people` también filtra la asignación utilizada para construir el subtítulo. Por tanto, una persona legítimamente relacionada con varios países no revela en el resultado una entidad o unidad que el actor no puede consultar.

Las fronteras nuevas no utilizan `current_user_has_scope_access`, `current_user_is_admin` ni `current_user_is_super_or_national`.

## Documentos

### Resolución de ámbito

Un documento puede derivar entidades y unidades desde:

- persona relacionada;
- entidad relacionada;
- unidad organizativa;
- nombramiento;
- movimiento.

Los resolutores son:

- `document_scope_entities`;
- `document_scope_units`;
- `current_user_can_manage_document`;
- `current_user_can_view_document`.

Los documentos `private` y `confidential` requieren `documents.view_private`. Los documentos internos requieren `documents.view`. Los documentos públicos activos o aprobados pueden consultarse anónimamente.

La lectura anónima utiliza `documents_select_public_anon`. Para usuarios autenticados, `documents_select_authenticated` combina la lectura pública y la lectura administrativa territorial en una sola política, evitando políticas permisivas duplicadas y evaluaciones innecesarias por fila.

### Raíces soportadas

`admin_list_documents` acepta en `p_scope_entity_id` cualquiera de estos identificadores:

- entidad territorial;
- unidad organizativa;
- área pastoral.

La función detecta el tipo de raíz y valida el permiso correspondiente.

Para unidades, `organization_unit_in_scope` recorre la jerarquía hasta 25 niveles y protege contra ciclos. Para áreas pastorales, cada documento debe resolver una unidad perteneciente al área solicitada.

### Mutaciones y Storage

`anon` y `authenticated` no tienen escritura directa sobre `documents`.

La carga documental permanece deshabilitada porque actualmente solo existe el bucket público `person-photos`. No existe todavía un bucket documental privado ni políticas de objetos que vinculen país, entidad, metadatos y auditoría.

La futura carga deberá:

1. usar un bucket privado;
2. validar tamaño y MIME;
3. generar una ruta con país y ámbito;
4. guardar objeto y metadatos mediante un flujo transaccional compensable;
5. auditar la operación;
6. evitar URLs públicas permanentes para documentos internos.

## Reportes administrativos

### KPI contextuales

`get_admin_contextual_kpis` admite:

- `national`;
- `diocese`;
- `parish`;
- `entity`.

La entidad raíz debe ser administrable con `entities.view`. Los conteos incluyen únicamente la raíz y sus descendientes:

- entidades activas;
- parroquias y cuasiparroquias activas;
- asignaciones activas;
- solicitudes pendientes.

El panel administrativo ahora solicita KPI contextuales también para `national`. Solo `super_admin` conserva métricas globales irrestrictas.

### Nombramientos importados

`admin_imported_appointment_review_summary` filtra cada fila mediante `appointments.view` sobre la parroquia relacionada antes de calcular sus siete métricas.

### Reconstrucción institucional

`get_institutional_state_reconstruction` exige exactamente una entidad o unidad.

- entidad: `events.view` mediante el helper territorial;
- unidad: `events.view` mediante el helper de unidad.

No es posible reconstruir la historia de una entidad o unidad externa aunque el identificador sea conocido.

## Exportaciones CSV

Las exportaciones se crean exclusivamente en el navegador desde datos ya devueltos por RPC territoriales.

`src/lib/csv.ts`:

- añade BOM UTF-8;
- escapa comillas;
- normaliza booleanos;
- neutraliza celdas que comienzan con `=`, `+`, `-` o `@`, incluso después de espacios o tabulaciones;
- normaliza el nombre del archivo.

Las exportaciones disponibles son:

- actividad administrativa;
- directorio documental.

No utilizan `service_role`, endpoints privilegiados ni lecturas directas de tablas sensibles.

## Integración web

### Actividad

`/admin/actividad` permite exportar únicamente las filas visibles cargadas mediante `admin_list_recent_audit_logs`.

### Documentos

`/admin/documentos`:

- hereda el alcance activo de `AdminNavigationProvider`;
- filtra por búsqueda, visibilidad y estado;
- muestra país, fuente y clasificación;
- exporta el resultado visible;
- informa explícitamente que la carga está deshabilitada.

La navegación muestra el módulo únicamente con `documents.view`.

## Evidencia transaccional

Todas las pruebas de datos temporales finalizaron con `ROLLBACK`.

### Auditoría

Un administrador nacional DO:

- vio la fila DO;
- no vio la fila ES;
- escribió una auditoría DO;
- no pudo escribir una auditoría ES.

Resultado: `audit_country_scope_passed`.

### Búsqueda y documentos

El administrador DO:

- encontró República Dominicana;
- no encontró España;
- vio documentos internos y privados DO según permisos;
- no vio el documento interno ES;
- no pudo usar España como raíz documental.

Un visitante anónimo vio el documento público ES y no vio el interno DO.

Resultado: `search_and_documents_scope_passed`.

### Reportes

El administrador DO:

- recibió KPI nacionales DO;
- no pudo solicitar KPI ES;
- reconstruyó una entidad DO;
- no pudo reconstruir una entidad ES;
- recibió las siete métricas del resumen de nombramientos.

Resultado: `admin_reports_scope_passed`.

### Editor pastoral

Un editor temporal asignado a **Pastoral Juvenil**:

- recibió su documento;
- no recibió el documento de **Pastoral Social**;
- no pudo usar la unidad hermana como raíz;
- conservó el mismo aislamiento en el helper del calendario.

Resultado: `pastoral_document_and_calendar_scope_passed`.

Ningún documento, rol o registro QA quedó persistido.

## Contratos automatizados

`tests/admin-data-scope-security.test.mjs` verifica:

- presencia de las ocho migraciones;
- aislamiento de auditoría;
- cierre de escrituras directas;
- búsqueda territorial y pastoral;
- resolutores documentales;
- raíces de entidad, unidad y área;
- política documental consolidada para usuarios autenticados;
- prevención de escalación por entidad de respaldo;
- KPI nacionales y reportes autorizados.

`tests/admin-data-exports-ui.test.mjs` verifica:

- protección contra fórmulas CSV;
- exportación desde RPC territoriales;
- ausencia de `service_role`;
- ausencia de mutaciones directas;
- directorio documental de solo lectura;
- navegación por `documents.view`;
- KPI contextuales para alcance nacional.

## Riesgos y pendientes

- No existe bucket documental privado; la carga permanece bloqueada.
- Las exportaciones CSV reflejan hasta el límite solicitado por cada pantalla. Las exportaciones masivas deberán usar paginación o procesos asíncronos auditados.
- `current_user_has_scope_access` conserva semántica heredada amplia; las nuevas fronteras no lo utilizan. Su normalización pertenece al siguiente bloque de deuda técnica.
- `create_audit_log` continúa en `public` por compatibilidad, aunque está revocada para clientes. Debe moverse a `app_private` cuando se migren todos sus consumidores internos.
- La validación E2E final requiere cuentas nacionales, diocesanas y pastorales independientes con secretos protegidos.
