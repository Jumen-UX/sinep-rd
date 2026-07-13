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
8. Las funciones privadas o internas de escritura no son ejecutables directamente por `anon` ni por `authenticated`.

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
- registra acción, permiso, resultado y ámbito.

`admin_list_recent_audit_logs` mantiene su firma pública, pero filtra por alcance antes de devolver resultados.

Un trigger de enriquecimiento completa automáticamente permiso y ámbito para auditorías heredadas que todavía insertan directamente en `audit_logs`. Los registros históricos que no pueden resolverse con certeza se conservan como `unknown` y no se exponen a administradores territoriales.

## Cobertura protegida

Actualmente existen **33 puntos de entrada administrativos mutadores protegidos** y una cola de revisión privada accesible únicamente mediante su fachada pública. El inventario final devuelve **cero funciones administrativas mutadoras expuestas directamente** en `internal` o `app_private` para el rol `authenticated`.

### Personas y clero

Contratos canónicos:

- `admin_save_canonical_person`
- `admin_mark_person_deceased`

Asistentes heredados redirigidos al contrato canónico:

- `admin_save_bishop`
- `admin_save_deacon`
- `admin_save_priest`
- `admin_save_layperson`
- `admin_save_religious`

Auditan creación o actualización de personas, fallecimientos y nombramientos creados durante el registro canónico.

### Entidades, jurisdicciones y nombramientos

- `admin_save_ecclesiastical_entity`
- `admin_save_jurisdiction`
- `admin_save_position_assignment`
- `resolve_assignment_canonical_incompatibility`

Las jurisdicciones mayores quedan reservadas a administración nacional. Las entidades subordinadas y los nombramientos exigen permiso y alcance sobre la entidad afectada.

### Estructuras

- `admin_save_structure_template`
- `admin_save_structure_level`
- `admin_save_structure_node`

Exigen `structures.manage` sobre la diócesis de la plantilla y registran valores anteriores y posteriores.

### Catálogo canónico de cargos

- `admin_save_office_configuration`
- `admin_update_office_configuration`
- `editor_suggest_office_configuration`

La creación y edición del catálogo global quedan reservadas a administración nacional. Las sugerencias territoriales requieren un rol activo y un alcance válido, y entran al flujo de revisión.

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

### Usuarios

- `admin_assign_user_role`
- `admin_end_user_role`
- `admin_update_user_profile_status`

Las implementaciones privadas conservan sus validaciones de permiso y protección del último superadministrador, pero ya no son ejecutables directamente.

### Importaciones y revisión

- `admin_prepare_import_batch`
- `admin_review_import_batch`
- `admin_update_import_batch_row`
- `admin_review_queue` — lector administrativo sellado

Los contratos privados de preparación, revisión, corrección y validación solo pueden invocarse a través de fachadas públicas `SECURITY DEFINER`.

## Pruebas verificadas

- `anon` no puede ejecutar `admin_write_audit_log`.
- `authenticated` no puede insertar directamente en `ecclesiastical_entities`.
- Los privilegios directos críticos quedaron revocados para `INSERT`, `UPDATE` y `DELETE`.
- Los contratos públicos permanecen ejecutables para usuarios autenticados autorizados.
- Ninguna función administrativa mutadora privada o interna permanece ejecutable directamente por `authenticated`.
- Las auditorías heredadas reciben permiso y ámbito automáticamente.
- El escritor y el lector de auditoría funcionan con el rol `super_admin`.
- Las APIs públicas de resumen, personas y acceso administrativo responden correctamente en el entorno desplegado.

## Estado del punto

La capa crítica de auditoría, permisos y alcance queda cerrada. Las mejoras futuras corresponden a experiencia de usuario del visor de auditoría, filtros más avanzados, pruebas E2E con usuarios reales de distintas jurisdicciones y activación de controles opcionales de autenticación, no a brechas conocidas de escritura directa.
