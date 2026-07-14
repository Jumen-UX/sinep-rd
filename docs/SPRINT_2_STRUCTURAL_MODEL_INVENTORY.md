# Sprint 2 — Inventario de correspondencias estructurales

Fecha: 14 de julio de 2026.

## Regla de fuente de verdad

| Modelo canónico | Propósito | Rol |
| --- | --- | --- |
| `ecclesiastical_entities` | Identidad institucional, ficha propia, nombre, slug y tipo de entidad | Fuente institucional |
| `structure_templates`, `structure_levels`, `structure_nodes`, `structure_node_edges` | Jerarquía territorial configurable, nivel, padre vigente e historia estructural | Fuente territorial |
| `organization_charts`, `organization_units` | Organización pastoral, administrativa y colegial | Fuente organizativa |
| `office_configurations`, `structure_level_office_configurations`, `position_assignments` | Cargos permitidos y nombramientos de personas sobre entidades, organigramas o unidades | Fuente de cargos y nombramientos |

Una entidad puede estar enlazada desde un nodo o una unidad, pero el enlace no transfiere identidad ni convierte el modelo enlazado en fuente institucional.

## Matriz de consumidores verificados

| Archivo / consulta | Modelo canónico | Clasificación | Fuente o proyección | Propósito |
| --- | --- | --- | --- | --- |
| `src/features/estructuras/services/structure-admin-service.ts` · `ecclesiastical_entities` | Entidades eclesiásticas | Institucional | Fuente | Catálogo de entidades enlazables y raíz diocesana |
| `src/features/estructuras/services/structure-admin-service.ts` · `get_structure_tree` / `structure_levels` | Motor territorial | Territorial | Fuente | Reconstrucción del árbol y niveles configurados |
| `src/features/estructuras/services/structure-admin-service.ts` · `admin_save_structure_node` | Motor territorial | Territorial | Escritura canónica | Alta y edición de nodos con enlace opcional a entidad o unidad |
| `src/lib/admin/scopeUtils.ts` · `ecclesiastical_entities` | Entidades eclesiásticas | Permiso/alcance | Fuente institucional | Nombre y catálogo de alcance institucional |
| `src/lib/admin/scopeUtils.ts` · `organization_units` | Organización interna | Permiso/alcance | Fuente organizativa | Nombre de alcance por unidad organizativa |
| `src/lib/admin/scopeUtils.ts` · `get_entity_descendants` | Contrato de alcance territorial | Permiso/alcance | Proyección transitoria a revisar en S2-03 | Expansión de alcance a descendientes institucionales |
| `src/features/organization-charts/services/organization-chart-admin-service.ts` · `organization_charts` | Organización interna | Organizativo | Fuente | Organigramas activos |
| `src/features/organization-charts/services/organization-chart-admin-service.ts` · `organization_units` | Organización interna | Organizativo | Fuente | Unidades y relaciones padre/hijo internas |
| `src/features/organization-charts/services/organization-chart-admin-service.ts` · `position_assignments` | Cargos y nombramientos | Nombramiento/cargo | Fuente | Responsables actuales por organigrama o unidad |
| `src/lib/public/dashboard.ts` · `public_ecclesiastical_entities`, `public_dioceses`, `public_parishes` | Entidades eclesiásticas | Presentación pública | Proyección pública | Directorio y KPIs institucionales |
| `src/lib/public/dashboard.ts` · `public_organization_units` | Organización interna | Presentación pública | Proyección pública | Vistas pastoral, administrativa y colegial |
| `src/lib/public/dashboard.ts` · `public_position_assignments_with_hierarchy` | Cargos y nombramientos | Presentación pública | Proyección pública | Personas y cargos actuales con contexto jerárquico |

## Compatibilidades y puntos transitorios detectados

### `get_entity_descendants`

`scopeUtils.ts` todavía expande el alcance institucional mediante `get_entity_descendants`. Este consumidor está identificado y no debe eliminarse todavía. S2-03 debe comprobar si la función reconstruye la jerarquía desde `structure_nodes` y `structure_node_edges` vigentes o si conserva una relación institucional paralela.

### Proyecciones públicas

Las vistas `public_dioceses`, `public_parishes`, `public_ecclesiastical_entities`, `public_organization_units` y `public_position_assignments_with_hierarchy` son proyecciones de lectura. No son fuentes de escritura. S2-02 debe verificar sus conteos contra las tablas canónicas correspondientes.

### Enlaces de nodos

`structure_nodes` admite `linked_ecclesiastical_entity_id` y `linked_organization_unit_id`. Estos campos son referencias de enlace. El nodo conserva nivel, posición e historia territorial; la entidad conserva identidad institucional; la unidad conserva identidad organizativa.

## Auditoría reproducible

El comando `pnpm audit:structures` recorre el código activo de `src` y produce una matriz archivo/modelo con clasificación por propósito. `pnpm audit:structures:strict` falla si aparece un modelo estructural detectado sin una asignación explícita de fuente canónica.

El auditor forma parte de `pnpm check`, de modo que una nueva referencia a los modelos inventariados queda visible en CI y cualquier modelo detectado sin clasificación bloquea la validación.

## Resultado S2-01

- Las fuentes institucional, territorial, organizativa y de nombramientos están separadas explícitamente.
- Los consumidores principales de código activo tienen modelo y propósito identificados.
- `pastoral_entities` permanece bloqueado por `check-no-legacy-pastoral.mjs` y no forma parte de la matriz canónica.
- `get_entity_descendants` queda marcado como compatibilidad concreta para revisión territorial, no como ambigüedad silenciosa.
- Las vistas públicas quedan clasificadas como proyecciones de lectura.

Siguiente paso: S2-02 debe crear consultas de paridad reproducibles para raíces, padres vigentes, nodos sin entidad, entidades sin nodo cuando corresponda, unidades sin organigrama y conteos de proyecciones públicas.
