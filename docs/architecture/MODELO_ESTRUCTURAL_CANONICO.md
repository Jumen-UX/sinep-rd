# Modelo estructural canónico

> Estado: vigente
> Última revisión: 2026-07-15
> Propietario: arquitectura y dominio de estructuras
> Sustituye: `docs/SPRINT_2_CANONICAL_STRUCTURE_MODEL.md` y `docs/architecture/CONTRATOS_MODELO_ESTRUCTURAL.md`

## Regla central

Cada dimensión estructural conserva una responsabilidad distinta. Ninguna dimensión debe inferirse silenciosamente desde otra.

## Identidad institucional

Fuente canónica: `ecclesiastical_entities`.

Responde a «¿qué entidad es?». Conserva nombre, slug, tipo y metadatos institucionales. Una entidad mantiene su identidad aunque cambie de posición territorial. Las relaciones jerárquicas no se reconstruyen desde nombres ni slugs.

## Jerarquía territorial configurable

Fuentes canónicas:

- `structure_templates`;
- `structure_levels`;
- `structure_nodes`;
- `structure_node_edges`.

Responde a «¿cuál es su posición territorial vigente o histórica?». `structure_node_edges` es la única fuente canónica de parentesco territorial. `structure_nodes.parent_node_id` no es fuente jerárquica y solo puede existir como compatibilidad o proyección derivada.

Las raíces se determinan por ausencia de edges entrantes elegibles. Los ciclos deben impedirse antes de confirmar relaciones. La vigencia se evalúa en nodos y edges.

Contratos de lectura principales:

- `get_structure_tree`;
- `get_entity_descendants`;
- servicios tipados de `features/structures` y dominios equivalentes vigentes.

## Organización interna

Fuentes canónicas:

- `organization_charts`;
- `organization_units`.

Representan estructuras pastorales, administrativas y colegiales. Una unidad pertenece a un organigrama explícito y puede operar dentro de un alcance eclesiástico sin convertirse en entidad institucional ni en nodo territorial.

La jerarquía interna usa `parent_unit_id`. Crear o editar contenido no aprueba ni publica. Aprobación, publicación, desactivación, archivo y restauración son transiciones explícitas y auditadas.

## Cargos y nombramientos

Los cargos disponibles se determinan por configuración de nivel, organigrama, jurisdicción y estado canónico. No existe fallback silencioso a todos los cargos.

Un nombramiento conserva como mínimo persona, cargo, alcance, vigencia, contexto organizativo cuando aplique, sucesión cuando corresponda, fuente y auditoría.

## Relación entre dimensiones

| Dimensión | Responde a | No sustituye |
|---|---|---|
| Identidad institucional | ¿Qué entidad es? | Posición territorial |
| Jerarquía territorial | ¿Dónde se ubica en la estructura? | Organización interna |
| Organización interna | ¿Qué órganos y unidades funcionan en un alcance? | Identidad institucional |
| Nombramientos | ¿Quién ocupa qué cargo, dónde y cuándo? | Definición estructural |

## Escritura autorizada

Toda mutación estructural administrativa debe:

1. autenticar al actor;
2. validar permiso;
3. validar alcance territorial u organizativo;
4. validar invariantes y ausencia de ciclos;
5. ejecutar mediante contrato transaccional canónico;
6. registrar auditoría con jurisdicción y alcance;
7. invalidar proyecciones o cachés públicas afectadas cuando corresponda.

Las tablas canónicas críticas no aceptan escrituras directas desde clientes autenticados cuando existe una fachada administrativa autorizada.

## Ciclo de vida y publicación

El guardado ordinario conserva el ciclo de vida. Las unidades nuevas nacen como borrador interno. Aprobar y publicar son acciones separadas. Una aprobación no implica visibilidad pública.

## Compatibilidad heredada

Los modelos estructurales retirados no pueden reaparecer como consumidores de aplicación bajo `src/`. Las migraciones históricas pueden conservar referencias necesarias para transformación o rollback. Las compatibilidades de payload permitidas son de solo lectura y deben derivarse de fuentes canónicas.

La política detallada de retirada permanece en [Deprecaciones estructurales](./DEPRECACIONES_ESTRUCTURALES.md).

## Regla para funcionalidades nuevas

Antes de implementar una funcionalidad debe identificarse:

- dimensión responsable;
- fuente canónica de lectura;
- contrato autorizado de escritura;
- permiso y alcance;
- vigencia e historial afectados;
- proyección pública a invalidar;
- pruebas de contrato necesarias.

Cuando una función necesite varias dimensiones, debe componerlas sin convertir una en sustituto de otra.
