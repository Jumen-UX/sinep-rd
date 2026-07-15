# Contratos del modelo estructural canónico

> Estado: vigente  
> Revisado: 2026-07-14  
> Sprint: S2-07

Este documento identifica los contratos autorizados de lectura, escritura, auditoría y presentación pública del modelo estructural de SINEP RD. Complementa [Sprint 2 — Modelo estructural canónico](../SPRINT_2_CANONICAL_STRUCTURE_MODEL.md) y el [inventario de compatibilidad heredada](../SPRINT_2_LEGACY_COMPATIBILITY_INVENTORY.md).

## 1. Regla de arquitectura

Toda funcionalidad debe declarar explícitamente:

1. la dimensión estructural responsable;
2. la fuente canónica;
3. el contrato de lectura;
4. el contrato autorizado de escritura;
5. el permiso y alcance requeridos;
6. la auditoría esperada;
7. la proyección pública o caché que debe invalidarse.

No se permiten escrituras directas desde clientes autenticados a tablas estructurales críticas.

## 2. Matriz de contratos

| Dimensión | Fuente canónica | Lectura autorizada | Escritura autorizada | Auditoría | Presentación pública |
|---|---|---|---|---|---|
| Identidad institucional | `ecclesiastical_entities` | servicios de entidades, vistas y endpoints públicos tipados | rutas/RPC administrativas con validación de permiso y alcance | actor, acción, entidad, jurisdicción, metadatos | fichas institucionales, directorios, sitemap y dashboard |
| Jerarquía territorial | `structure_templates`, `structure_levels`, `structure_nodes`, `structure_node_edges` | `get_structure_tree`, `get_entity_descendants`, servicios de `features/structures` | RPC canónicas de configuración y mutación estructural | plantilla, nodo, edge, alcance, vigencia y operación | árboles territoriales, selectores, breadcrumbs y fichas derivadas |
| Organización interna | `organization_charts`, `organization_units` | servicios de `features/organizacion` y `features/organization-charts` | rutas/RPC de guardado y transición de ciclo de vida | organigrama, unidad, jurisdicción, estado previo y nuevo | organigramas y vistas pastorales, administrativas o colegiales publicadas |
| Cargos y nombramientos | configuraciones de cargos y asignaciones canónicas | servicios de `features/appointments` | RPC de configuración y asignación con sucesión | persona, cargo, alcance, vigencia, predecesor y sucesor | titulares, vacantes, sucesiones y directorios |
| Eventos estructurales | eventos canónicos y planes de aplicación | servicios de `features/events` | creación, revisión, aprobación y aplicación mediante contratos transaccionales | evento, actor, evidencia, plan, resultado y registros afectados | línea de tiempo y hechos históricos aprobados |

## 3. Contratos de lectura

### 3.1 Jerarquía territorial

- `get_structure_tree` es la proyección de árbol autorizada.
- `get_entity_descendants` es la proyección autorizada para expansión de alcance.
- `parent_node_id` solo puede aparecer como dato proyectado de lectura derivado de `structure_node_edges`.
- Las raíces se calculan por ausencia de edges entrantes elegibles.
- Ningún consumidor debe reconstruir parentesco desde nombres, slugs o columnas heredadas.

### 3.2 Organización interna

- La jerarquía se obtiene desde `organization_units.parent_unit_id` dentro de un `organization_chart_id` explícito.
- Toda lectura debe conservar la jurisdicción institucional y el estado de ciclo de vida.
- Las unidades no publicadas no deben exponerse en contratos públicos.

### 3.3 Composición transversal

Una pantalla puede combinar identidad, jerarquía, organización y nombramientos, pero debe hacerlo por IDs canónicos y servicios tipados. La composición no convierte una dimensión en fuente de verdad de otra.

## 4. Contratos de escritura

Toda mutación estructural debe cumplir, en este orden:

1. autenticación;
2. permiso específico;
3. validación de alcance;
4. validación de payload;
5. validación de invariantes y ciclos;
6. ejecución transaccional mediante RPC o ruta administrativa autorizada;
7. auditoría obligatoria;
8. invalidación de proyecciones públicas afectadas.

Quedan prohibidos:

- `.insert()`, `.update()`, `.delete()` o `.upsert()` directos desde componentes cliente sobre tablas estructurales canónicas;
- escrituras en modelos heredados bloqueados;
- aprobación o publicación implícita durante una edición ordinaria;
- fallback silencioso a todos los cargos cuando falta configuración de nivel;
- reescritura destructiva de historia estructural aprobada.

## 5. Ciclos de vida

### Unidades organizativas

`draft → active → inactive → archived`

La publicación es una acción separada de la aprobación. Crear o editar contenido no puede activar ni publicar automáticamente.

### Eventos estructurales

`draft → pending_review → approved → applied`

Una corrección histórica se registra mediante un nuevo evento o evento compensatorio, no eliminando el hecho anterior.

## 6. Auditoría mínima

Cada operación debe registrar, cuando aplique:

- actor autenticado;
- permiso usado;
- jurisdicción y alcance;
- tabla o dominio afectado;
- ID del registro;
- acción;
- estado anterior y posterior;
- vigencia;
- fuente o evidencia;
- request ID y metadatos operativos.

Una operación crítica no debe reportarse como exitosa si falla la auditoría obligatoria.

## 7. Proyecciones públicas e invalidación

Después de una mutación aprobada deben invalidarse las proyecciones afectadas, incluyendo según el caso:

- ficha pública de entidad;
- árbol territorial;
- directorios;
- organigramas;
- dashboard público;
- sitemap y metadata dinámica;
- líneas de tiempo y sucesiones.

La invalidación debe ocurrir en el límite servidor que confirma la operación, no en componentes presentacionales.

## 8. Compatibilidades permitidas

Solo se permiten compatibilidades de lectura documentadas y derivadas de fuentes canónicas. Actualmente `parent_node_id` se conserva únicamente como proyección de `get_structure_tree`.

Los modelos heredados bloqueados por la auditoría estricta no pueden reaparecer bajo `src/`. Las referencias históricas dentro de migraciones pueden conservarse para transformación, paridad o rollback.

## 9. Pruebas obligatorias

Todo contrato nuevo o modificado debe incluir pruebas que cubran al menos:

- límite ruta → feature → service;
- ausencia de I/O directo en rutas administrativas;
- permiso y alcance;
- uso de RPC canónica;
- auditoría;
- invariantes de jerarquía y ciclo de vida;
- compatibilidad pública cuando corresponda;
- protección contra regresión hacia modelos heredados.

La validación completa se ejecuta mediante `pnpm check`.
