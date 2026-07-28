# Ciclo de importaciones por país

> Estado: implementado y validado como parte de la fase 2E  
> Última revisión: 2026-07-28  
> Alcance: preparación, validación, corrección, revisión, aplicación, `noop`, lotes mixtos, actualización de eventos y reversión

## Objetivo

El sistema de importaciones persistentes debe impedir que un administrador nacional, diocesano o editor:

- prepare un lote para una entidad de otro país;
- valide, corrija o apruebe un lote ajeno;
- enlace como `noop` una persona, entidad, nombramiento o evento de otro país;
- introduzca una fila cuyo país contradiga el país administrativo del lote;
- aplique un lote mixto que contenga al menos un objetivo fuera de alcance;
- revierta cambios canónicos fuera de su país;
- descubra identificadores privados mediante códigos internos pertenecientes a otro país.

## Migraciones

El cierre se implementó mediante:

- `20260728153739_scope_import_control_plane_by_country.sql`;
- `20260728154339_validate_import_application_rows_by_country.sql`;
- `20260728154944_enforce_import_validation_country_consistency.sql`.

Estas migraciones complementan el primer bloque de importaciones de personas y nombramientos:

- `20260728150859_scope_people_imports_and_diagnostics_by_country.sql`;
- `20260728151123_fix_import_application_rpc_chain.sql`.

## Frontera de ejecución

La cadena canónica es:

```text
public RPC — SECURITY INVOKER
        ↓
app_private.rpc_definer__* — SECURITY DEFINER, search_path fijo
        ↓
app_private/internal motor histórico — sin EXECUTE para cliente
```

Las funciones públicas no elevan privilegios. Los wrappers privados son responsables de:

1. autenticar al actor;
2. comprobar el permiso granular;
3. resolver `scope_entity_id`;
4. verificar país y alcance mediante `current_user_can_manage_entity`;
5. validar cada fila antes de delegar al motor transaccional existente.

Los motores privados conservan su lógica de clasificación, idempotencia y aplicación, pero ya no constituyen una frontera de autorización accesible por REST.

## Control plane

### Preparación

`rpc_definer__admin_prepare_import_batch` exige `imports.prepare` y una entidad administrable.

Cuando el cliente no envía `scope_entity_id`, el wrapper puede utilizar `current_user_root_jurisdiction_id()`. Si no puede resolver una entidad concreta, la operación falla cerrada. No existen lotes globales implícitos, ni siquiera para `super_admin`.

### Validación y corrección

La revalidación y la corrección de filas requieren `imports.prepare` sobre la entidad del lote.

Las funciones públicas son `SECURITY INVOKER`; las funciones privadas de validación no conceden `EXECUTE` a `anon` ni `authenticated`.

### Revisión

La aprobación o rechazo requiere `imports.review` dentro de `scope_entity_id`. La auditoría derivada conserva entidad y `country_iso2`.

### Reversión

La reversión exige `imports.apply` sobre la entidad del lote. Si el lote contiene cambios sobre `canonical_events`, también exige `events.approve` en esa misma entidad.

## Validación previa a la aplicación

`assert_import_batch_rows_in_scope(batch_id, permission)` recorre todas las filas antes del preflight y antes de que el dispatcher pueda crear lotes sombra para operaciones mixtas.

La fila debe tener una operación soportada: `create`, `update` o `noop`.

### Personas

- `create`: la entidad actual debe estar en el país del lote y exige `people.create_proposal`;
- `noop`: la persona enlazada debe tener al menos una entidad canónica autorizada dentro del país del lote;
- las actualizaciones directas de personas no están habilitadas.

### Estructuras y parroquias

- `create`: `pais_iso2` debe coincidir con el país del lote;
- la diócesis o entidad superior debe pertenecer al mismo país;
- exige `structures.manage`;
- `noop`: la entidad enlazada debe pertenecer al país del lote;
- las actualizaciones estructurales directas no están habilitadas.

### Nombramientos

- `create`: persona y entidad deben pertenecer al país del lote;
- exige `appointments.create_proposal` tanto para la persona como para la entidad;
- `noop`: el nombramiento se resuelve mediante `review_record_scope_entity`;
- las actualizaciones directas de nombramientos no están habilitadas.

### Eventos

- `create`: la entidad debe estar en el país del lote y exige `events.create_proposal`;
- `update`: el evento se resuelve mediante `canonical_event_scope_entity_id` y exige `events.approve`;
- `noop`: exige `events.view` sobre la entidad del evento.

Cualquier fila sin entidad resoluble, con tabla inesperada o con país diferente falla antes de producir `import_batch_changes`.

## Validación de referencias privadas

Los códigos internos de personas se consultan únicamente dentro del país del lote:

- coincidencia exacta autorizada: se proyecta como `noop`;
- coincidencia ambigua autorizada: se informa únicamente el número de coincidencias;
- código existente solo fuera del país: la fila queda `unresolved`, sin `target_record_id` y con el código `person_reference_out_of_country`;
- código inexistente: permanece como `not_found`.

La respuesta no expone identificadores de personas de otro país.

## Consistencia territorial de estructuras

`enforce_structure_import_country_consistency` compara `pais_iso2` de cada fila con el país derivado de `scope_entity_id`.

Cuando difieren:

- crea la incidencia `structure_country_mismatch`;
- elimina `target_operation`, `target_schema`, `target_table` y `target_record_id`;
- marca la fila como error;
- recalcula el resumen y deja el lote en `needs_review`.

## Evidencia transaccional

Las pruebas directas en PostgreSQL utilizaron datos temporales y `ROLLBACK`.

### Control plane

Para un administrador nacional DO se confirmó:

- preparación, validación, corrección y aprobación de lote DO;
- auditoría de revisión con `country_iso2='DO'`;
- bloqueo de preparación, validación, corrección, revisión y reversión CO;
- reversión DO alcanzando el resultado canónico `blocked` o `completed`.

Resultado: `import_control_plane_scope_passed`.

### Aplicación

Se probaron positivamente en DO:

- `noop` de persona;
- `noop` de entidad estructural;
- `noop` de nombramiento;
- actualización de evento borrador;
- lote mixto de personas con una creación y un `noop`.

Los equivalentes que enlazaban objetivos CO fueron rechazados antes de insertar cambios.

Resultado: `import_application_row_scope_passed`.

### Consistencia de validación

Se confirmó:

- código interno CO dentro de lote DO: incidencia genérica, sin identificador objetivo;
- fila estructural `pais_iso2='CO'` dentro de lote DO: error y proyección de aplicación eliminada.

Resultado: `import_validation_country_consistency_passed`.

Ningún lote, fila, persona, nombramiento, evento o código privado temporal quedó persistido.

## Contrato automatizado

`tests/import-country-control-plane-contract.test.mjs` verifica:

- presencia de las tres migraciones exactas;
- fachadas públicas `SECURITY INVOKER`;
- wrappers privados `SECURITY DEFINER`;
- revocación de ejecución directa sobre motores;
- ausencia del bypass `current_user_is_super_or_national` en la nueva frontera;
- cobertura de personas, estructuras, nombramientos y eventos;
- aserción de filas antes del dispatcher;
- protección de referencias privadas;
- invalidación de país estructural inconsistente.

## Riesgos y pendientes

- Los motores históricos privados todavía contienen algunos atajos heredados. No son accesibles al cliente y están precedidos por wrappers fail-closed, pero deben simplificarse cuando se retire definitivamente `current_user_is_super_or_national()`.
- Las importaciones globales reales deberán modelarse con una entidad país explícita o con un flujo futuro exclusivo y auditable; no deben representarse mediante `scope_entity_id=null`.
- El recorrido E2E con cuentas nacionales DO y CO sigue pendiente por falta de credenciales dedicadas y secretos protegidos.
- La suite completa de GitHub CI, CodeQL y Playwright debe aportar la evidencia final de integración.
