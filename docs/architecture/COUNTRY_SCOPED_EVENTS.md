# Eventos administrativos por país

> Estado: implementado y validado como parte de la fase 2E
> Última revisión: 2026-07-28
> Alcance: eventos canónicos, eventos estructurales, acciones, participantes, lectores y privilegios

## Problema corregido

El registro de eventos conservaba tres formas de acceso transversal incompatibles con un sistema multi-país:

- wrappers que aceptaban `current_user_is_super_or_national()` como alternativa al permiso territorial;
- políticas RLS que autorizaban por `internal.current_user_has_admin_role()` sin comparar país;
- privilegios directos de escritura sobre acciones, participantes y tablas del workflow estructural.

Además, `structure_events` y `structure_event_nodes` podían ser leídos por `anon` cuando el evento estaba aprobado, aunque contienen payloads, notas y metadatos administrativos.

## Migración

Aplicado mediante:

- `20260728143037_scope_event_workflows_by_country.sql`.

## Helpers canónicos

### `current_user_can_manage_canonical_event`

Resuelve la entidad del evento mediante `canonical_event_scope_entity_id(event_id)` y autoriza con:

```sql
current_user_can_manage_entity(permission_key, scope_entity_id)
```

Si el evento no tiene una entidad resoluble, falla cerrado y solo permite a `super_admin` con el permiso solicitado.

### `current_user_can_read_canonical_event`

El contrato de lectura distingue:

- evento `applied`: continúa disponible para el canal público;
- cualquier otro estado: exige sesión activa, `events.view` y alcance territorial sobre la entidad del evento;
- evento sin entidad: solo `super_admin` con `events.view`.

### `current_user_can_read_structure_event`

El workflow estructural es exclusivamente administrativo. La función resuelve la diócesis mediante `structure_event_diocese_id(event_id)` y exige `structures.manage` sobre esa diócesis. Un evento sin diócesis queda reservado a `super_admin`.

## Wrappers migrados

Los siguientes escritores dejaron de usar `current_user_is_super_or_national()`:

- `admin_create_event_draft`;
- `admin_generate_event_action_plan`;
- `admin_review_event`;
- `admin_approve_event`;
- `admin_configure_event_action`;
- `admin_update_event_action`;
- `admin_correct_canonical_event`.

La creación de borradores valida la entidad o unidad organizativa antes de insertar. Preparación, revisión, aprobación, edición de acciones y corrección reutilizan el helper compartido del evento.

Las operaciones conservan el pipeline `create_audit_log`, con entidad, país y solicitud de cambio cuando corresponde.

## RLS de eventos canónicos

### Eventos

- `anon` solo puede leer filas con `status='applied'`.
- `authenticated` usa `current_user_can_read_canonical_event(id)`.

### Acciones

`canonical_event_actions` solo es legible por usuarios autenticados que puedan leer el evento padre. Ya no existen políticas de escritura directa por rol administrativo.

### Participantes

- `anon` solo ve participantes de eventos aplicados cuando la entidad o unidad participante es pública y activa;
- `authenticated` hereda la autorización territorial del evento padre.

## Workflow estructural

Se retiró completamente el acceso anónimo a:

- `structure_events`;
- `structure_event_actions`;
- `structure_event_nodes`.

Las tres tablas solo son legibles por usuarios autenticados con `structures.manage` dentro de la diócesis del evento.

Un evento aprobado no se convierte automáticamente en información pública. La publicación institucional debe realizarse mediante una proyección pública explícita y sanitizada, no exponiendo el workflow administrativo.

## Escrituras RPC-only

`authenticated` ya no posee `INSERT`, `UPDATE` ni `DELETE` directos sobre:

- `canonical_event_actions`;
- `canonical_event_participants`;
- `structure_events`;
- `structure_event_actions`;
- `structure_event_nodes`.

Las mutaciones continúan mediante las fachadas RPC auditadas.

## Columnas públicas

Se revocó el `SELECT` completo de `canonical_events` para `anon` y se concedieron únicamente las columnas necesarias para las vistas históricas públicas.

Quedaron fuera del acceso anónimo:

- `created_by`;
- `approved_by`;
- `applied_by`;
- `source_document_id`;
- `authority_entity_id`;
- `updated_at`.

En `canonical_event_participants`, `anon` solo puede leer:

- `id`;
- `event_id`;
- `entity_id`;
- `organization_unit_id`;
- `role`.

No puede leer `before_state` ni `after_state`.

`notes_json` permanece temporalmente disponible porque `public_entity_evolution_events` extrae de allí claves heredadas expresamente públicas. Su normalización a columnas públicas dedicadas queda como deuda controlada.

## Evidencia transaccional

Las pruebas utilizaron eventos temporales y `ROLLBACK`.

### Eventos canónicos

Se confirmó:

- `anon` ve eventos aplicados DO y CO;
- no ve borradores DO ni CO;
- las vistas públicas siguen proyectando los eventos aplicados;
- un administrador DO ve el borrador, acciones y participantes DO;
- no ve el borrador, acciones ni participantes CO;
- los lectores administrativos devuelven información DO y `null` para CO;
- una mutación de acción CO devuelve `42501`;
- no quedan privilegios directos de escritura;
- una creación de evento DO completa el flujo y audita `country_iso2='DO'`;
- una creación de evento CO es rechazada.

### Eventos estructurales

Se confirmó:

- `anon` carece totalmente de `SELECT` sobre las tres tablas del workflow;
- un administrador DO ve evento, acción y participante estructural DO;
- no ve los equivalentes CO;
- los lectores administrativos respetan el mismo aislamiento;
- una mutación de acción estructural CO devuelve `42501`;
- no quedan privilegios directos de escritura.

Ningún registro temporal quedó persistido.

## Contratos automatizados

`tests/event-country-scope-contract.test.mjs` verifica:

- la versión exacta de la migración;
- uso del helper canónico por todos los wrappers migrados;
- ausencia del bypass nacional;
- políticas RLS territoriales;
- revocación de DML directo;
- ausencia de exposición anónima estructural;
- exclusión de actores y snapshots del contrato público.

## Pendientes relacionados

1. Normalizar las claves públicas heredadas de `notes_json`.
2. Migrar eventos y calendarios pastorales no canónicos.
3. Endurecer validación, aplicación, actualización y reversión de importaciones de eventos.
4. Revisar reportes, búsqueda y exportaciones de eventos.
5. Completar pruebas E2E con cuentas nacionales DO y CO.
6. Retirar el helper heredado `current_user_is_super_or_national()` cuando todos sus consumidores hayan migrado.
