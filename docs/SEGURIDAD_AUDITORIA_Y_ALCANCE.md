# Seguridad administrativa: auditoría, permisos y alcance

## Objetivo

Toda operación administrativa debe identificar al actor, exigir el permiso funcional correspondiente, validar la jurisdicción afectada y registrar una auditoría consultable únicamente dentro del alcance autorizado.

## Modelo vigente

La autorización se compone de dos dimensiones independientes:

- **Permiso:** determina qué operación puede ejecutar el usuario, por ejemplo `people.update_proposal`, `appointments.publish`, `events.approve`, `structures.manage`, `imports.apply` o `audit.view`.
- **Alcance:** determina sobre qué jurisdicción, nodo territorial o estructura pastoral puede ejecutar esa operación.

Los roles nacionales (`super_admin` y `national_admin`) tienen alcance total. Los demás roles deben operar dentro de la diócesis, vicaría, zona, parroquia, área pastoral o entidad pastoral asignada.

## Contratos obligatorios

1. Los clientes autenticados no escriben directamente en tablas canónicas críticas.
2. Las escrituras pasan por RPC que validan identidad, permiso, alcance e integridad.
3. La auditoría guarda `scope_type`, `scope_entity_id`, `diocese_id`, `pastoral_area_id` y `pastoral_entity_id` cuando corresponda.
4. Los cambios registran el estado anterior y posterior cuando modifican datos existentes.
5. Un usuario con `audit.view` solo ve registros dentro de su alcance.
6. Los registros sin ámbito resoluble se marcan como `unknown` y solo son visibles para roles nacionales.
7. Las operaciones de importación usan el permiso específico asociado a su fase: preparación, revisión o aplicación.
8. Las funciones internas de escritura no son ejecutables directamente por `anon` ni por `authenticated`.

## Tablas con escritura directa revocada

- `canonical_events`
- `clergy_profiles`
- `ecclesiastical_entities`
- `position_assignments`

Las políticas amplias de `INSERT`, `UPDATE` y `DELETE` también fueron eliminadas para impedir que un grant accidental reactive la escritura directa.

## Auditoría y visibilidad

`admin_write_audit_log`:

- rechaza usuarios anónimos;
- deriva el permiso requerido a partir de la acción;
- resuelve el ámbito desde el registro objetivo y sus metadatos;
- comprueba que el usuario puede administrar la entidad resuelta;
- registra la acción, el permiso requerido y el resultado.

`admin_list_recent_audit_logs` mantiene su firma pública para no romper la interfaz administrativa, pero filtra por alcance antes de devolver resultados.

Los ámbitos admitidos incluyen jurisdicción nacional, diócesis, vicaría, zona, parroquia, entidad, área pastoral y entidad pastoral. Los registros históricos que no pueden resolverse con certeza se conservan como `unknown` y no se exponen a administradores territoriales.

## Contratos críticos protegidos

Actualmente existen **17 contratos públicos críticos protegidos**, todos como fachadas `SECURITY DEFINER` con permiso, alcance y auditoría. Sus funciones equivalentes en el esquema `internal` ya no son ejecutables por usuarios autenticados.

### Personas y clero

- `admin_save_canonical_person`
- `admin_mark_person_deceased`

Auditan creación o actualización de personas, registro de fallecimiento y nombramientos creados durante el registro canónico.

### Entidades y nombramientos

- `admin_save_ecclesiastical_entity`
- `admin_save_position_assignment`

Validan la entidad superior o el ámbito del cargo y registran el objeto creado junto con su jurisdicción.

### Estructuras

- `admin_save_structure_template`
- `admin_save_structure_level`
- `admin_save_structure_node`

Exigen `structures.manage` sobre la diócesis de la plantilla y registran los valores anteriores y posteriores.

### Eventos canónicos

- `admin_create_event_draft`
- `admin_review_event`
- `admin_generate_event_action_plan`
- `admin_update_event_action`
- `admin_configure_event_action`

El alcance se deriva de la entidad de autoridad o de la entidad participante prioritaria. La creación exige `events.create_proposal`, la revisión `events.approve` y la preparación o edición `events.update_proposal`.

### Eventos estructurales

- `admin_create_structural_evolution_event_draft`
- `admin_review_structural_evolution_event`
- `admin_generate_structural_application_plan`
- `admin_update_structural_event_action`
- `admin_configure_structural_event_action`

El alcance se deriva de la diócesis de la plantilla o del nodo estructural y exige `structures.manage`.

## Pruebas verificadas

- `anon` no puede ejecutar `admin_write_audit_log`.
- `authenticated` no puede insertar directamente en `ecclesiastical_entities`.
- Los cuatro privilegios directos críticos quedaron revocados para `INSERT`, `UPDATE` y `DELETE`.
- Los 17 contratos públicos permanecen ejecutables para usuarios autenticados autorizados.
- Los 17 contratos públicos son `SECURITY DEFINER`.
- Ninguna de las 17 funciones internas correspondientes permanece ejecutable por `authenticated`.
- El escritor y el lector de auditoría funcionan con el rol `super_admin`.
- El despliegue que ejecuta la prueba de regresión de estos contratos finalizó correctamente en Vercel.

## Cobertura pendiente

La base crítica del punto está cerrada. Queda como ampliación posterior inventariar y normalizar RPC heredadas de menor prioridad, principalmente administración avanzada de usuarios, centros de revisión especializados y utilidades antiguas de importación. Estas deben adoptar el mismo patrón antes de considerarse contratos canónicos permanentes.
