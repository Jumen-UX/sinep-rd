# Revisión administrativa por país

> Estado: implementado y validado como parte de la fase 2E
> Última revisión: 2026-07-28
> Alcance: cola de revisión, solicitudes de cambio, nombramientos, publicación asociada e importaciones

## Problema corregido

La cola administrativa combinaba permisos específicos con tres atajos heredados:

- `current_user_is_super_or_national()`;
- `current_user_can(permission, 'national')`;
- `current_user_has_scope_access(...)`, que interpreta cualquier asignación `national` como acceso irrestricto.

En un sistema multi-país, estos atajos permitían que un administrador nacional de un país enumerara o intentara revisar registros de otro país. También existían fallbacks para nombramientos sin entidad y lotes de importación sin `scope_entity_id`.

## Migraciones

Aplicado mediante:

- `20260728140808_scope_review_workflows_by_country.sql`;
- `20260728140934_align_assignment_person_publish_scope.sql`.

## Resolución canónica de solicitudes

El helper privado `current_user_can_review_change_request(text, uuid)` resuelve el alcance en este orden:

1. `scope_entity_id`;
2. `diocese_id`;
3. entidad eclesiástica de `organization_unit_id`;
4. entidad derivada desde `target_table` y `target_id`.

Cuando se obtiene una entidad, la autorización pasa por `current_user_can_manage_entity(permission, entity_id)`, que compara permiso, país y alcance territorial.

Si no puede resolverse una entidad, la operación falla cerrada y solo se permite a `super_admin` con el permiso correspondiente. `national_admin` no constituye un fallback.

## Registros revisables

`current_user_can_review_record(text, text, uuid)` aplica la misma regla:

- entidad resoluble: autorización territorial canónica;
- entidad no resoluble: solo `super_admin`;
- permiso, tabla o identificador inválido: `false`.

La cola utiliza este helper para nombramientos, candidatos, datos faltantes y otras filas revisables.

## Solicitudes de personas

`admin_review_person_change_request` dejó de ejecutar una comprobación nacional global. Ahora reutiliza `current_user_can_review_change_request('people.approve', request_id)` antes de aprobar o rechazar.

Las auditorías de aprobación y rechazo pasan por `create_audit_log`, conservando el contexto de entidad, unidad organizativa, país y solicitud de cambio.

## Nombramientos y publicación asociada

Todo nombramiento debe pertenecer a:

- una entidad eclesiástica; o
- una unidad organizativa vinculada a una entidad.

El constraint `position_assignments_scope_required` impide crear nombramientos sin ambos contextos.

La revisión de nombramientos resuelve el ámbito mediante `review_record_scope_entity('position_assignments', id)`. Las decisiones de aprobación, corrección, disputa, mantenimiento interno y publicación usan el permiso correspondiente dentro de esa entidad.

La opción de publicar simultáneamente la ficha de la persona usa el mismo ámbito del nombramiento. `current_user_can_publish_assignment_person(uuid)` ya no consulta `current_user_has_scope_access` ni `current_user_is_super_or_national`.

## Importaciones

El constraint `import_batches_scope_entity_required` exige `scope_entity_id` en todos los lotes persistentes.

La cola solo enumera un lote cuando el actor puede administrar su entidad con al menos uno de estos permisos:

- `imports.prepare`;
- `imports.review`;
- `imports.apply`.

Se eliminó el caso donde un lote sin entidad era visible por tener un permiso general. Los lotes globales deberán modelarse explícitamente con una entidad país o ser ejecutados mediante un flujo futuro reservado a `super_admin`.

## Auditoría

`admin_review_item` dejó de insertar directamente en `audit_logs`.

Todas las ramas relevantes utilizan `create_audit_log`:

- nombramientos;
- candidatos importados;
- datos faltantes;
- solicitudes de cambio;
- solicitudes canónicas de personas.

Esto permite que `resolve_audit_scope` complete `scope_entity_id`, `organization_unit_id`, `diocese_id` y `country_iso2`.

## Evidencia transaccional

Las pruebas se ejecutaron con registros temporales y `ROLLBACK`.

Para un administrador nacional de República Dominicana se confirmó:

- solicitud DO visible y solicitud CO oculta;
- lote DO visible y lote CO oculto;
- nombramiento DO visible y nombramiento CO oculto;
- publicación de persona asociada DO: `true`;
- publicación de persona asociada CO: `false`;
- mutación de solicitud DO completada;
- mutación de solicitud CO rechazada con `42501`;
- auditoría de la mutación DO con `country_iso2='DO'` y la entidad país correcta;
- rechazo de nombramientos sin entidad o unidad;
- rechazo de lotes sin entidad.

Ningún registro temporal quedó persistido.

## Contratos automatizados

`tests/review-country-scope-contract.test.mjs` verifica:

- presencia de las dos versiones exactas de migración;
- ausencia de `current_user_is_super_or_national` en el flujo migrado;
- ausencia de autorización nacional global para solicitudes;
- filtrado territorial de solicitudes, nombramientos y lotes;
- constraints de alcance obligatorio;
- uso exclusivo del pipeline canónico de auditoría;
- publicación asociada basada en la entidad del nombramiento.

## Pendientes relacionados

Este bloque no elimina todavía el helper heredado `current_user_has_scope_access` ni modifica todos sus consumidores. Permanecen pendientes:

1. eventos estructurales y su aprobación/aplicación;
2. personas, cargos y nombramientos fuera del centro de revisión;
3. eventos y calendarios generales;
4. validación, aplicación y reversión completa de importaciones;
5. reportes, búsqueda y documentos;
6. normalización final de `scope_type='country'`.

Hasta completar esos dominios, no deben habilitarse administradores nacionales reales de otros países.
