# Seguridad administrativa: auditoría, permisos y alcance

## Objetivo

Toda operación administrativa debe identificar al actor, exigir el permiso funcional correspondiente, validar la jurisdicción afectada y registrar una auditoría consultable únicamente dentro del alcance autorizado.

## Modelo vigente

La autorización se compone de dos dimensiones independientes:

- **Permiso:** determina qué operación puede ejecutar el usuario, por ejemplo `people.update_proposal`, `appointments.publish`, `imports.apply` o `audit.view`.
- **Alcance:** determina sobre qué jurisdicción, nodo territorial o estructura pastoral puede ejecutar esa operación.

Los roles nacionales (`super_admin` y `national_admin`) tienen alcance total. Los demás roles deben operar dentro de la diócesis, vicaría, zona, parroquia, área pastoral o entidad pastoral asignada.

## Contratos obligatorios

1. Los clientes autenticados no escriben directamente en tablas canónicas críticas.
2. Las escrituras pasan por RPC que validan identidad, permiso, alcance e integridad.
3. La auditoría guarda `scope_type`, `scope_entity_id`, `diocese_id`, `pastoral_area_id` y `pastoral_entity_id` cuando corresponda.
4. Un usuario con `audit.view` solo ve registros dentro de su alcance.
5. Los registros sin ámbito resoluble se marcan como `unknown` y solo son visibles para roles nacionales.
6. Las operaciones de importación usan el permiso específico asociado a su fase: preparación, revisión o aplicación.

## Tablas con escritura directa revocada

- `canonical_events`
- `clergy_profiles`
- `ecclesiastical_entities`
- `position_assignments`

Las políticas amplias de `INSERT`, `UPDATE` y `DELETE` también fueron eliminadas para impedir que un grant accidental reactive la escritura directa.

## Auditoría

`admin_write_audit_log`:

- rechaza usuarios anónimos;
- deriva el permiso requerido a partir de la acción;
- resuelve el ámbito desde el registro objetivo y sus metadatos;
- comprueba que el usuario puede administrar la entidad resuelta;
- registra la acción con resultado `success`.

`admin_list_recent_audit_logs` mantiene su firma pública para no romper la interfaz administrativa, pero filtra por alcance antes de devolver resultados.

## Pruebas verificadas en el entorno desplegado

- `anon` no puede ejecutar `admin_write_audit_log`.
- `authenticated` no puede insertar directamente en `ecclesiastical_entities`.
- Los RPC canónicos de personas, entidades y asignaciones continúan ejecutables para usuarios autenticados.
- El escritor y el lector de auditoría funcionan con el rol `super_admin`.
- Los cuatro privilegios directos críticos quedaron revocados para `INSERT`, `UPDATE` y `DELETE`.

## Siguiente cobertura

El siguiente bloque debe inventariar todas las RPC de escritura y exigir que cada una genere exactamente un registro de auditoría con valores anteriores y posteriores cuando la operación modifique datos existentes.
