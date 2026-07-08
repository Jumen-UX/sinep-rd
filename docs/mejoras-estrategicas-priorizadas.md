# Mejoras estratégicas priorizadas — SINEP RD

Este backlog operacionaliza el Plan Maestro v1 y evita seguir agregando pantallas sueltas sin controles de integridad, trazabilidad y permisos.

## 1. Integridad de datos — prioridad crítica

Estado: en ejecución.

- Mantener una sola asignación actual por cargo y ámbito eclesial.
- Cerrar automáticamente asignaciones actuales equivalentes antes de aceptar una nueva.
- Defender la regla también en base de datos con índice único parcial.
- Evitar operaciones parciales usando RPCs transaccionales para flujos compuestos.

Criterio de aceptación:

- No pueden existir dos `position_assignments.is_current = true` para el mismo cargo y el mismo ámbito.
- Si el wizard crea un sacerdote con cargo actual, la asignación anterior queda cerrada o la base de datos rechaza el duplicado.

## 2. Prevención real de duplicados

Estado: base técnica agregada.

- Usar `pg_trgm` y `similarity()` para buscar coincidencias antes de crear personas o entidades.
- Buscar personas por nombre canónico, slug, tipo de persona y fecha de nacimiento.
- Buscar entidades por nombre, slug, tipo y ámbito jerárquico.
- Mostrar coincidencias antes de permitir crear una ficha nueva.

Criterio de aceptación:

- Antes de crear una persona nueva, el flujo administrativo consulta `/api/admin/duplicados/personas`.
- Antes de crear una entidad/parroquia nueva, el flujo administrativo consulta `/api/admin/duplicados/entidades`.
- El botón de crear debe mostrar advertencia cuando existan coincidencias fuertes.

## 3. Auditoría y cola de revisión

Estado: primera pantalla agregada.

- Centralizar datos con estado `pending_review`, `unknown`, `not_identified`, `incomplete`, `not_verified` o `needs_review`.
- Exponer una vista administrativa en `/admin/revision`.
- Permitir filtrar por tipo de pendiente y estado.

Criterio de aceptación:

- Un administrador puede ver pendientes sin consultar la base de datos directamente.
- Los campos marcados como no identificados desde asistentes aparecen en la cola.
- Las asignaciones de cargo pendientes de verificación aparecen en la cola.

## 4. Permisos granulares por jurisdicción

Estado: pendiente.

- Pasar de un chequeo global de administrador a permisos por diócesis, provincia eclesiástica o jurisdicción.
- Definir alcance: lectura, creación, edición, validación y administración de usuarios.
- Asegurar que un usuario de una diócesis no pueda modificar datos de otra sin permiso explícito.

Criterio de aceptación:

- Cada acción administrativa sensible valida el alcance territorial/eclesial del usuario.
- Los RPCs administrativos reciben o resuelven el ámbito antes de escribir.

## 5. Testing automatizado

Estado: pendiente.

- Crear pruebas para RPCs críticos.
- Cubrir el caso: no se permiten dos cargos actuales equivalentes.
- Cubrir el caso: crear sacerdote + perfil clerical + asignación rápida no deja registros parciales.
- Agregar pruebas de API para traducción de errores administrativos.

Criterio de aceptación:

- `pnpm typecheck` sigue pasando.
- La lógica crítica de integridad tiene pruebas automatizadas en CI.

## 6. UX administrativa

Estado: parcialmente pendiente.

- Reemplazar selects grandes por combobox con búsqueda.
- Conectar la búsqueda de duplicados en la UI antes de crear.
- Mostrar el paso exacto del wizard que tiene errores obligatorios.
- Traducir errores técnicos de Postgres a español simple.

Criterio de aceptación:

- El usuario escribe menos y selecciona más.
- Los errores se entienden sin leer mensajes técnicos de base de datos.
- Los formularios grandes guían al usuario por contexto jerárquico.

## 7. Stack visual oficial

Estado: pendiente.

- Cerrar la instalación formal de Tailwind y shadcn/ui si se confirma que serán el estándar definitivo.
- Evitar seguir creciendo con estilos dispersos difíciles de migrar.
- Definir componentes base: botón, card, input, combobox, badge, alert, table y dialog.

Criterio de aceptación:

- Nuevas pantallas administrativas usan componentes consistentes.
- El sistema visual queda alineado con el libro de marca y con el stack aprobado.
