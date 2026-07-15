# Sprint 2 — Evidencia consolidada

> Estado: archivado
> Fecha de trabajo: 2026-07-14
> Nota: este documento conserva evidencia histórica. El contrato vigente está en `docs/architecture/MODELO_ESTRUCTURAL_CANONICO.md`.

## Inventario y paridad

Sprint 2 separó explícitamente cuatro fuentes: identidad institucional, jerarquía territorial, organización interna y cargos o nombramientos. La auditoría estructural quedó integrada en `pnpm check` y bloquea consumidores de modelos heredados bajo `src/`.

La paridad inicial registró 12 plantillas activas, 61 niveles, 173 nodos activos y vigentes, 5 organigramas y 181 unidades organizativas vigentes en borrador. Los controles ejecutados no detectaron discrepancias bloqueantes de jerarquía, alcance u organigrama.

## Contrato territorial

`get_structure_tree` y `get_entity_descendants` fueron alineados con `structure_node_edges` como fuente de parentesco territorial. Las 12 plantillas devolvieron paridad completa; la plantilla principal reconstruyó 162 de 162 nodos y las otras once, 1 de 1. Una zona pastoral de prueba devolvió 14 descendientes directos esperados.

`structure_nodes.parent_node_id` quedó formalizado como compatibilidad o proyección de lectura, no como fuente jerárquica.

## Ciclo de vida organizativo

El guardado ordinario fue separado de aprobación y publicación. Se creó un contrato explícito de transición con acciones `approve`, `publish`, `unpublish`, `deactivate`, `archive` y `restore_draft`, con validación de permiso, alcance y auditoría.

Los resultados intermedios mostraron inicialmente 181 unidades en borrador: Santo Domingo tenía una jerarquía lista para revisión y once jurisdicciones conservaban una estructura plana. Después se validó un piloto en Santiago y el patrón se generalizó. El resultado posterior y vigente al cierre técnico fue de 12 cabeceras, 180 unidades hijas, 192 unidades alcanzables desde sus raíces y cero ciclos.

Los conteos de 181 unidades y las clasificaciones de jurisdicciones «pendientes de normalización» pertenecen a estados intermedios y fueron superados por la normalización posterior.

## Revisión organizativa

Se añadió `/admin/organizacion/revision` para filtrar unidades en borrador, seleccionar resultados y aprobar mediante el contrato de transición. La aprobación conserva visibilidad interna; la publicación permanece como acción posterior y separada.

## Cargos y nombramientos

Se verificaron 111 relaciones activas entre niveles y cargos, 49 predeterminadas y 187 nombramientos vigentes. Los 187 tenían cargo configurado, organigrama y entidad eclesiástica de alcance; no se detectaron incompatibilidades entre organigrama del cargo y nombramiento.

La actualización de cargos por nivel pasó a una RPC transaccional y se eliminó el fallback silencioso a todos los cargos.

## Compatibilidad heredada

Se bloquearon consumidores de aplicación de seis modelos estructurales heredados. La eliminación física de tablas quedó pospuesta hasta validar dependencias de base, migraciones, rollback y paridad histórica.

## Resultado de cierre

El Sprint 2 cerró técnicamente con CI #1129 sobre `b528e827`: 56 rutas administrativas auditadas, 52 delegadas en features, 4 de composición, 0 con I/O directo, 65 consumidores estructurales inventariados, 0 fuentes ambiguas y 294 pruebas aprobadas.

El cierre técnico no aprobó ni publicó automáticamente unidades y no sustituyó las pruebas operativas de beta.
