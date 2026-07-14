# Sprint 2 — Consolidar el motor de estructuras

Fecha de inicio: 14 de julio de 2026.

## Objetivo

Establecer el motor estructural canónico como única fuente de verdad para territorio, organización interna, jerarquías, cargos permitidos, consultas públicas y alcance administrativo.

## Estado de entrada

Sprint 1 cerró con:

- 55 rutas administrativas auditadas.
- 51 rutas delegadas en `src/features`.
- 4 rutas de composición.
- 0 rutas con I/O directo.
- 274 pruebas aprobadas.
- TypeScript y build de producción aprobados.

La consolidación pastoral ya avanzó antes de este sprint:

- `organization_units` es el modelo canónico para unidades pastorales, administrativas y orgánicas.
- El modelo heredado `pastoral_entities` fue retirado.
- Las referencias de nombramientos, auditoría, eventos, permisos y vistas públicas fueron migradas a `organization_unit_id`.
- Existe `check-no-legacy-pastoral.mjs` para impedir la reintroducción del modelo eliminado.
- Las escrituras de unidades organizativas pasan por contratos canónicos con permiso, alcance y auditoría.

Por tanto, Sprint 2 no debe repetir esa migración. Debe completar la paridad y definir con precisión las fronteras entre los modelos canónicos que permanecen.

## Modelos canónicos que deben coexistir

### Entidades eclesiásticas

`ecclesiastical_entities` representa entidades con identidad institucional propia y ficha pública, por ejemplo jurisdicciones, parroquias, capillas, templos y otros tipos configurados.

### Estructuras territoriales configurables

`structure_templates`, `structure_levels`, `structure_nodes` y `structure_node_edges` representan la jerarquía territorial configurable, su vigencia y sus relaciones históricas.

### Organización interna

`organization_charts` y `organization_units` representan organización pastoral, administrativa y colegial. No sustituyen las entidades eclesiásticas ni deben volver a convertirse en una jerarquía territorial paralela.

### Cargos y nombramientos

`office_configurations`, `structure_level_office_configurations` y `position_assignments` relacionan cargos, niveles, organigramas, unidades, entidades y personas sin duplicar la identidad de ninguno de esos dominios.

## Backlog de ejecución

### S2-01 — Inventario de correspondencias

- Inventariar cada consumidor de `ecclesiastical_entities`, `structure_nodes`, `organization_units` y tablas heredadas todavía existentes.
- Clasificar cada consumidor como territorial, organizativo, institucional, nombramiento, permiso, evento o presentación pública.
- Detectar columnas de compatibilidad y adaptadores transitorios.
- Documentar qué modelo es fuente y cuál es proyección en cada caso.

Criterio de cierre:

- Existe una matriz archivo/consulta → modelo canónico → propósito.
- No queda ningún consumidor cuyo modelo fuente sea ambiguo.

### S2-02 — Consultas de paridad

- Crear consultas verificables para comparar entidades, nodos, unidades, relaciones y conteos actuales.
- Comprobar raíces, padres vigentes, nodos sin entidad, entidades sin nodo cuando corresponda y unidades sin organigrama.
- Separar diferencias válidas de inconsistencias reales.

Criterio de cierre:

- Las discrepancias quedan clasificadas como válidas, migrables o bloqueantes.
- Las consultas pueden ejecutarse nuevamente después de cada migración.

### S2-03 — Contrato territorial

- Confirmar que toda jerarquía territorial se lee desde plantillas, niveles, nodos y edges vigentes.
- Confirmar que una entidad con ficha propia se enlaza al nodo, pero no se duplica dentro del nodo.
- Revisar que las pantallas públicas y administrativas no reconstruyan jerarquías desde `parent_id` heredados cuando existe el edge canónico.
- Mantener compatibilidad temporal únicamente donde exista un consumidor probado.

Criterio de cierre:

- Todas las jerarquías territoriales vigentes se pueden reconstruir desde el motor canónico.
- No existen dos escrituras activas para la misma relación padre/hijo.

### S2-04 — Contrato organizativo

- Verificar que pastoral, administración y colegialidad usan `organization_charts` y `organization_units`.
- Revisar unidades sin organigrama, sin entidad de alcance o con padre incompatible.
- Confirmar que vistas públicas, permisos, auditoría, cargos y eventos usan `organization_unit_id`.
- Mantener bloqueada cualquier reintroducción de `pastoral_entities`.

Criterio de cierre:

- Toda unidad organizativa activa pertenece a un organigrama válido.
- No existen referencias activas al modelo pastoral eliminado.

### S2-05 — Paridad de cargos y alcance

- Verificar que los cargos por nivel provienen de `structure_level_office_configurations`.
- Verificar que cargos organizativos respetan el organigrama configurado.
- Revisar que nombramientos, auditoría y permisos resuelvan correctamente entidad, nodo o unidad.
- Sustituir la actualización destructiva de cargos por nivel por una RPC transaccional, idempotente y auditada.

Criterio de cierre:

- No existe fallback silencioso a todos los cargos.
- La actualización de cargos por nivel no puede dejar un estado parcial.

### S2-06 — Compatibilidad y bloqueo de legados

- Inventariar tablas, columnas, vistas y funciones heredadas restantes.
- Mantener solo adaptadores con consumidor identificado y prueba de paridad.
- Bloquear escrituras directas a modelos heredados.
- Documentar rollback y condición de eliminación futura.

Criterio de cierre:

- Cada compatibilidad restante tiene propietario, consumidor y fecha de retiro.
- Ninguna tabla heredada recibe escrituras nuevas.

### S2-07 — Documentación canónica

- Crear un diagrama lógico de los cuatro modelos.
- Documentar identidad, jerarquía, vigencia, alcance, historia y enlaces públicos.
- Añadir ejemplos territoriales simples y complejos.
- Registrar reglas de selección de padre, nivel y cargo.

Criterio de cierre:

- Un desarrollador puede identificar el modelo correcto sin leer migraciones históricas.

## Orden de ejecución

1. S2-01 Inventario de correspondencias.
2. S2-02 Consultas de paridad.
3. S2-03 Contrato territorial.
4. S2-04 Contrato organizativo.
5. S2-05 Paridad de cargos y alcance.
6. S2-06 Compatibilidad y bloqueo de legados.
7. S2-07 Documentación canónica.

Este orden es obligatorio porque las migraciones y bloqueos dependen del inventario y de las consultas de paridad. No se eliminará ninguna compatibilidad antes de identificar consumidores y verificar conteos.

## Criterio de cierre del sprint

- Todas las pantallas leen de modelos canónicos explícitos.
- Todas las escrituras llegan a un único contrato por dominio.
- Los conteos y jerarquías tienen consultas de paridad reproducibles.
- No se pierde historial ni enlace público.
- No existen escrituras activas a modelos heredados.
- `pnpm check` permanece verde.
- Las migraciones nuevas son idempotentes o tienen precondiciones explícitas.

## Deuda técnica controlada

- Caché de build en CI.
- Advertencias de Webpack por serialización de cadenas grandes.
- Unificación de catálogos compartidos en asistentes de entidades.
- Revisión de utilidades duplicadas de normalización, errores y alcance.

Estas tareas no deben desplazar el inventario y la paridad estructural, salvo que bloqueen una migración concreta.
