# Calendario administrativo por país

> Estado: implementado y validado como parte de la fase 2E  
> Última revisión: 2026-07-28  
> Alcance: ocurrencias, conmemoraciones, recordatorios, reglas de visibilidad y generación anual

## Objetivo

El calendario administrativo debe permitir que cada administrador nacional, diocesano o territorial consulte y gestione únicamente la información de sus entidades autorizadas, sin alterar la proyección pública global de eventos visibles.

El contrato impide que un actor:

- consulte eventos internos de otro país;
- configure recordatorios para entidades o unidades organizativas externas;
- cambie reglas de visibilidad de otra diócesis;
- genere aniversarios de otro país;
- use el generador global heredado desde un cliente autenticado;
- escriba directamente en las tablas base del calendario.

## Migraciones

El bloque se implementó mediante:

- `20260728162429_scope_calendar_records_by_country.sql`;
- `20260728162604_grant_calendar_policy_helpers.sql`;
- `20260728162726_create_scoped_admin_calendar_reader.sql`;
- `20260728163057_create_scoped_calendar_configuration_rpcs.sql`;
- `20260728163206_fix_event_reminder_role_catalog_validation.sql`;
- `20260728163434_generate_calendar_occurrences_by_scope.sql`.

Las migraciones correctivas permanecen separadas para reproducir exactamente el orden aplicado en producción.

## Modelo de alcance

Una ocurrencia no almacena un único `country_iso2` administrativo. Una persona, un nombramiento o una unidad organizativa puede participar legítimamente en más de una entidad y, por tanto, en más de un país.

El sistema deriva un conjunto de entidades mediante funciones privadas:

- `event_occurrence_scope_entities`;
- `commemorative_event_scope_entities`;
- `event_reminder_scope_entities`;
- `event_notification_log_scope_entities`;
- `calendar_record_scope_entities`.

Las fuentes consideradas incluyen:

- entidad o diócesis relacionada;
- unidad organizativa;
- nombramiento;
- movimiento;
- ámbitos canónicos de la persona;
- fuente generadora: persona, perfil clerical, nombramiento, entidad, unidad organizativa, movimiento o conmemoración.

Un actor puede consultar o gestionar el registro cuando existe al menos una entidad derivada para la cual `current_user_can_manage_entity` concede el permiso solicitado.

Los registros sin ámbito resoluble quedan reservados a `super_admin` con el permiso granular correspondiente.

## Jerarquía territorial

`calendar_entity_in_scope(entity_id, scope_entity_id)` recorre relaciones territoriales activas hacia los ancestros.

Esto permite consultar un país, provincia eclesiástica, diócesis, parroquia u otra entidad y recibir únicamente registros cuya entidad derivada sea la propia raíz o uno de sus descendientes.

La función usa protección contra ciclos y una profundidad máxima de 25 niveles.

## RLS y acceso público

### Ocurrencias

`event_occurrences_select_scoped` permite:

- a cualquier visitante: filas `public` y `active`;
- a usuarios autenticados: filas no públicas únicamente cuando su ámbito y permiso lo permiten;
- para `private` y `confidential`: exige `events.view_private`.

### Conmemoraciones

`commemorative_events_select_scoped` permite:

- a cualquier visitante: filas públicas con estado `active` o `approved`;
- a usuarios autorizados: filas internas, privadas o confidenciales dentro de su ámbito.

### Recordatorios y reglas de visibilidad

Los recordatorios, reglas de visibilidad y registros de notificación no son públicos. Sus políticas se basan en el ámbito derivado y en los permisos de eventos.

Un usuario puede consultar su propio registro de notificación aunque no administre el ámbito del evento.

### Escritura directa

`anon` y `authenticated` no tienen `INSERT`, `UPDATE` ni `DELETE` directos sobre:

- `event_occurrences`;
- `commemorative_events`;
- `event_reminders`;
- `event_visibility_settings`;
- `event_notification_logs`.

Toda escritura administrativa debe utilizar RPC auditados.

La vista `public_calendar_events` usa `security_invoker=true`.

## Corrección del contrato de fuentes

El generador histórico ya intentaba producir aniversarios con `source_table='organization_units'`, pero la restricción de `event_occurrences` no admitía ese valor.

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
- la entidad raíz debe ser administrable;
- cada fila debe tener al menos un ámbito descendiente de la raíz;
- los eventos privados o confidenciales exigen `events.view_private`;
- devuelve `matched_scope_entity_id` y el país derivado para trazabilidad.

El lector administrativo no incluye eventos públicos de otros países cuando se consulta una raíz concreta. La proyección pública global continúa disponible por los contratos públicos existentes.

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

El tipo de alcance se deriva de la entidad. El modelo nuevo no crea recordatorios personales sin una entidad administrativa explícita, porque la tabla heredada no dispone de una columna `person_id` para representar ese contrato correctamente.

Las creaciones y actualizaciones se auditan con entidad, país, tipo de evento, canal y estado.

## Visibilidad por diócesis

`admin_save_event_visibility_setting` exige `events.manage_visibility`.

Solo permite configurar:

- arquidiócesis;
- diócesis;
- vicariatos apostólicos.

Valida el tipo de evento, la visibilidad y la coherencia entre `can_be_public` y `default_visibility`.

La configuración se mantiene única por diócesis y tipo de evento y genera auditoría territorial.

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

## Evidencia transaccional

Todas las pruebas utilizaron datos temporales y finalizaron con `ROLLBACK`.

### RLS

Se confirmó que un administrador nacional DO:

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

Ningún registro QA quedó persistido.

## Contrato automatizado

`tests/calendar-country-scope-security.test.mjs` verifica:

- presencia y orden de las seis migraciones;
- resolutores de alcance por tipo de registro;
- ausencia de `current_user_is_admin` y `current_user_is_super_or_national` en la nueva frontera;
- políticas RLS territoriales;
- revocación de escritura directa;
- admisión de `organization_units` como fuente;
- fachada pública `SECURITY INVOKER` y wrapper privado `SECURITY DEFINER`;
- permisos separados para lectura, recordatorios, visibilidad y generación;
- bloqueo de generadores globales heredados.

## Riesgos y pendientes

- La generación por ámbito actualiza o crea ocurrencias, pero no elimina automáticamente registros obsoletos. La limpieza debe modelarse por fuente y ámbito sin borrar una ocurrencia que aún sea válida para otro país.
- El generador global heredado continúa existiendo para operación técnica. Debe retirarse cuando la generación por ámbito cubra todos los procesos automáticos.
- La creación y edición de conmemoraciones manuales debe continuar por el workflow canónico de eventos; este bloque solo protege su lectura territorial y las incluye en el calendario administrativo.
- La interfaz web todavía debe consumir los nuevos RPC de lectura, generación, recordatorios y visibilidad.
- La evidencia final E2E requiere cuentas nacionales independientes DO y CO.
