# Calendario administrativo por país

> Estado: implementado, integrado en UI y validado como parte de la fase 2E  
> Última revisión: 2026-07-28  
> Alcance: ocurrencias, conmemoraciones, recordatorios, reglas de visibilidad, generación anual y ámbitos pastorales

## Objetivo

El calendario administrativo permite que administradores nacionales, diocesanos, territoriales y editores pastorales consulten únicamente las fechas relacionadas con sus ámbitos autorizados, sin alterar la proyección pública global de eventos visibles.

El contrato impide que un actor:

- consulte eventos internos de otro país;
- consulte una unidad organizativa hermana sin autorización;
- use la entidad territorial de respaldo para ampliar un permiso pastoral limitado;
- configure recordatorios para entidades o unidades externas;
- cambie reglas de visibilidad de otra diócesis;
- genere aniversarios de otro país;
- use el generador global heredado desde un cliente autenticado;
- escriba directamente en las tablas base del calendario.

## Migraciones

El bloque se implementó mediante diez migraciones aplicadas y versionadas en el mismo orden:

1. `20260728162429_scope_calendar_records_by_country.sql`;
2. `20260728162604_grant_calendar_policy_helpers.sql`;
3. `20260728162726_create_scoped_admin_calendar_reader.sql`;
4. `20260728163057_create_scoped_calendar_configuration_rpcs.sql`;
5. `20260728163206_fix_event_reminder_role_catalog_validation.sql`;
6. `20260728163434_generate_calendar_occurrences_by_scope.sql`;
7. `20260728164733_optimize_calendar_notification_rls.sql`;
8. `20260728165626_create_calendar_scope_options.sql`;
9. `20260728170753_support_pastoral_calendar_scopes.sql`;
10. `20260728170915_fix_pastoral_calendar_reader_columns.sql`.

Las migraciones correctivas permanecen separadas para reproducir exactamente la evolución aplicada en producción y para que los contratos automatizados puedan comprobarla.

## Modelo de alcance

Una ocurrencia no almacena un único `country_iso2` administrativo. Una persona, un nombramiento o una unidad organizativa puede participar legítimamente en varias entidades e incluso en más de un país.

El sistema deriva dos conjuntos de alcance independientes:

### Entidades territoriales

- `event_occurrence_scope_entities`;
- `commemorative_event_scope_entities`;
- `event_reminder_scope_entities`;
- `event_notification_log_scope_entities`;
- `calendar_record_scope_entities`.

Las fuentes consideradas incluyen entidad, diócesis, persona, nombramiento, movimiento, unidad organizativa y la fuente generadora del evento.

### Unidades organizativas y pastorales

- `event_occurrence_scope_units`;
- `commemorative_event_scope_units`;
- `event_reminder_scope_units`;
- `event_notification_log_scope_units`;
- `calendar_record_scope_units`.

`current_user_can_manage_calendar_unit` valida:

- perfil activo;
- pertenencia al país de la unidad;
- permiso granular solicitado;
- asignación directa a la unidad o a uno de sus ancestros;
- asignación al área pastoral correspondiente cuando exista.

La autorización usa las columnas canónicas `organization_unit_id` y `pastoral_area_id`. No depende del valor heredado `scope_type='pastoral_entity'`, por lo que queda preparada para la futura normalización a `scope_type='organization_unit'`.

`current_user_can_manage_calendar_record` concede acceso cuando existe una entidad territorial administrable o una unidad organizativa administrable. Un permiso pastoral no se convierte automáticamente en acceso general a toda la diócesis de respaldo.

Los registros sin entidad ni unidad resoluble quedan reservados a `super_admin` con el permiso granular correspondiente.

## Jerarquía territorial

`calendar_entity_in_scope(entity_id, scope_entity_id)` recorre relaciones territoriales activas hacia los ancestros.

Esto permite consultar un país, provincia eclesiástica, diócesis, parroquia u otra raíz y recibir únicamente registros cuya entidad derivada sea esa raíz o uno de sus descendientes.

La función usa protección contra ciclos y una profundidad máxima de 25 niveles.

## Catálogo de ámbitos

`admin_list_calendar_scope_options` devuelve únicamente entidades activas accesibles con `events.view`.

Incluye:

- país;
- provincia eclesiástica;
- arquidiócesis, diócesis y jurisdicciones equivalentes;
- vicariato, decanato y zona;
- parroquia, cuasiparroquia y capilla.

El catálogo devuelve tipo, país, diócesis y entidad superior. Un editor pastoral recibe la entidad territorial que respalda su unidad, pero los lectores de registros siguen limitando las filas a su unidad autorizada.

La fachada pública es `SECURITY INVOKER`; el wrapper privado es `SECURITY DEFINER` con `search_path` fijo.

## RLS y acceso público

### Ocurrencias

`event_occurrences_select_scoped` permite:

- a cualquier visitante: filas `public` y `active`;
- a usuarios autenticados: filas no públicas solo dentro de un ámbito territorial o pastoral autorizado;
- para `private` y `confidential`: exige `events.view_private`.

### Conmemoraciones

`commemorative_events_select_scoped` permite:

- a cualquier visitante: filas públicas con estado `active` o `approved`;
- a usuarios autorizados: filas internas, privadas o confidenciales de su ámbito.

### Recordatorios y reglas de visibilidad

Los recordatorios, reglas de visibilidad y registros de notificación no son públicos. Sus políticas se basan en el ámbito derivado y en los permisos de eventos.

Un usuario puede consultar su propio registro de notificación aunque no administre el ámbito del evento. La comparación usa `(select auth.uid())` para evitar reevaluación por fila.

### Escritura directa

`anon` y `authenticated` no tienen `INSERT`, `UPDATE` ni `DELETE` directos sobre:

- `event_occurrences`;
- `commemorative_events`;
- `event_reminders`;
- `event_visibility_settings`;
- `event_notification_logs`.

Toda escritura administrativa utiliza RPC auditados. La vista `public_calendar_events` usa `security_invoker=true`.

## Contrato de fuentes

El generador histórico ya intentaba producir aniversarios con `source_table='organization_units'`, pero la restricción anterior de `event_occurrences` no admitía ese valor.

La restricción actual incluye:

- `persons`;
- `clergy_profiles`;
- `appointments`;
- `ecclesiastical_entities`;
- `organization_units`;
- `pastoral_entities`, mientras exista compatibilidad heredada;
- `movements`;
- `commemorative_events`;
- `manual`;
- `system`.

## Lector administrativo

`admin_list_calendar_events` combina ocurrencias automáticas y conmemoraciones manuales.

Parámetros principales:

- fecha inicial y final;
- entidad raíz;
- tipo de evento;
- inclusión o exclusión de información no pública;
- límite de resultados.

Reglas:

- exige `events.view`;
- el rango máximo es de cinco años;
- la raíz debe ser accesible como entidad territorial o como respaldo de una unidad autorizada;
- cada fila debe estar dentro de la jerarquía solicitada;
- cada fila pasa además por `current_user_can_manage_calendar_record`;
- los eventos privados o confidenciales exigen `events.view_private`;
- devuelve `matched_scope_entity_id` y país derivado para trazabilidad.

El lector administrativo no mezcla eventos públicos de otros países cuando se consulta una raíz concreta. La proyección pública global continúa disponible mediante los contratos públicos existentes.

## Recordatorios

`admin_save_event_reminder` exige `events.manage_reminders`.

El RPC valida:

- entidad explícita y administrable;
- país resoluble;
- tipo de evento activo;
- anticipación entre 0 y 365 días;
- canal soportado;
- rol destinatario existente;
- unidad organizativa activa, vigente, del mismo país y descendiente de la entidad raíz.

El tipo de alcance se deriva de la entidad. El modelo no crea recordatorios personales sin entidad administrativa explícita porque la tabla heredada no dispone de una columna `person_id` que represente correctamente ese contrato.

Las creaciones y actualizaciones se auditan con entidad, país, tipo de evento, canal y estado.

## Visibilidad por diócesis

`admin_save_event_visibility_setting` exige `events.manage_visibility`.

Solo permite configurar:

- arquidiócesis;
- diócesis;
- vicariatos apostólicos.

Valida el tipo de evento, la visibilidad y la coherencia entre `can_be_public` y `default_visibility`.

La configuración es única por diócesis y tipo de evento y genera auditoría territorial.

## Generación anual por ámbito

`admin_generate_calendar_occurrences(year, scope_entity_id)` exige `events.apply`.

Genera o actualiza únicamente fuentes dentro de la entidad solicitada:

- cumpleaños;
- aniversarios de fallecimiento;
- aniversarios de ordenación diaconal, sacerdotal y episcopal;
- aniversarios de nombramiento y asignación parroquial;
- aniversarios de erección parroquial y diocesana;
- aniversarios de creación de unidades organizativas.

Cada candidato debe:

1. pertenecer a la entidad raíz o a un descendiente;
2. ser administrable con `events.apply`;
3. conservar la visibilidad segura de la persona o fuente;
4. cumplir el contrato de idempotencia de `event_occurrences`.

El resultado devuelve año, entidad, país, cantidad afectada y auditoría.

Los generadores globales heredados:

- `generate_event_occurrences`;
- `generate_current_and_next_year_events`;

quedaron sin `EXECUTE` para `anon` y `authenticated`. Se reservan para operación técnica controlada.

## Integración web

El modo **Fechas** de `/admin/eventos` carga `CalendarWorkspace` sin sustituir los flujos históricos, borradores, planes, contratos ni revisión.

La interfaz ofrece:

- selector territorial autorizado;
- año y mes;
- tipo de evento;
- vista pública o información interna autorizada;
- listado de ocurrencias y conmemoraciones;
- generación anual cuando existe `events.apply`;
- creación y consulta de recordatorios cuando existe `events.manage_reminders`;
- edición de reglas diocesanas cuando existe `events.manage_visibility`.

`CalendarWorkspace` hereda el contexto de `AdminNavigationProvider`, inicializa la raíz desde el alcance activo y muestra estados de carga, error y éxito mediante regiones accesibles.

La capa TypeScript está en `calendar-admin-service.ts`. Las mutaciones usan exclusivamente los RPC auditados; no existen escrituras directas desde el cliente a las tablas del calendario.

## Evidencia transaccional

Todas las pruebas utilizaron datos temporales y finalizaron con `ROLLBACK`.

### RLS nacional y anónima

Un administrador nacional DO:

- ve ocurrencias y conmemoraciones internas DO;
- no ve equivalentes internos CO;
- continúa viendo información pública de ambos países mediante las tablas públicas.

Un actor anónimo solo ve filas públicas.

Resultado: `calendar_rls_country_scope_passed`.

### Lector administrativo

Se confirmó que:

- una consulta con raíz DO devuelve únicamente filas DO;
- los eventos públicos CO no se mezclan en la consulta administrativa DO;
- solicitar explícitamente la raíz CO produce `42501`.

Resultado: `admin_calendar_reader_scope_passed`.

### Configuración

Se confirmó:

- creación y lectura de recordatorio DO;
- bloqueo de recordatorio CO;
- creación y lectura de regla de visibilidad DO;
- bloqueo de regla de visibilidad CO.

Resultado: `calendar_configuration_scope_passed`.

### Generación

Se confirmó:

- generación efectiva de ocurrencias 2026 para DO;
- cada ocurrencia generada posee al menos un ámbito DO;
- bloqueo de generación CO;
- bloqueo del generador global para `authenticated`.

Resultado: `scoped_calendar_generation_passed`.

### Catálogo territorial

Se confirmó que el administrador DO recibe únicamente opciones DO, incluido el país raíz, y que no puede usar CO como raíz.

Resultado: `calendar_scope_options_passed`.

### Editor pastoral

Se asignó temporalmente un editor a la unidad **Pastoral Juvenil** y se confirmó que:

- ve la ocurrencia interna de su unidad;
- no ve la unidad hermana **Pastoral Social**;
- no ve un evento territorial genérico de la arquidiócesis;
- recibe la entidad territorial de respaldo como opción de navegación;
- el lector administrativo devuelve únicamente la fila de su unidad.

Resultado: `pastoral_calendar_scope_passed`.

Ningún registro, rol o configuración QA quedó persistido.

## Contratos automatizados

### Seguridad y base de datos

`tests/calendar-country-scope-security.test.mjs` verifica:

- presencia y orden de las diez migraciones;
- resolutores de entidades y unidades;
- ausencia de `current_user_is_admin` y `current_user_is_super_or_national` en la nueva frontera;
- políticas RLS territoriales y pastorales;
- optimización de `auth.uid()`;
- revocación de escritura directa;
- admisión de `organization_units` como fuente;
- catálogo de ámbitos;
- fachadas públicas `SECURITY INVOKER` y wrappers privados `SECURITY DEFINER`;
- permisos separados para lectura, recordatorios, visibilidad y generación;
- preservación del alcance estrecho de un editor pastoral;
- bloqueo de generadores globales heredados;
- alias efectivos del lector después de la corrección.

### Interfaz

`tests/calendar-admin-ui.test.mjs` verifica:

- uso de los siete RPC territoriales;
- ausencia de escritura directa desde el servicio;
- herencia del contexto administrativo;
- controles por permisos;
- filtros y estados accesibles;
- integración del modo **Fechas** sin retirar los workflows históricos;
- exportación del servicio desde el módulo de eventos.

## Riesgos y pendientes

- La generación por ámbito crea o actualiza ocurrencias, pero no elimina automáticamente registros obsoletos. La limpieza debe modelarse por fuente y alcance sin borrar una ocurrencia que aún sea válida para otra entidad o país.
- El generador global heredado continúa existiendo para operación técnica y debe retirarse cuando la generación por ámbito cubra todos los procesos automáticos.
- La creación y edición de conmemoraciones manuales continúa por el workflow canónico de eventos; este bloque protege su lectura territorial y las incorpora al calendario.
- La etiqueta heredada `scope_type='pastoral_entity'` continúa pendiente de normalización, aunque el calendario ya opera sobre `organization_unit_id` y `pastoral_area_id`.
- El enlace de resumen superior de la pantalla histórica todavía apunta al flujo de eventos y no al bloque interno del calendario; es una deuda UX menor sin impacto funcional.
- La evidencia final E2E requiere cuentas nacionales y pastorales independientes y secretos protegidos.
