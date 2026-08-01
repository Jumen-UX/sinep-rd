# Modelo estructural canónico

> Estado: vigente
> Última revisión: 2026-08-01
> Propietario: arquitectura y dominio de estructuras
> Sustituye: `docs/SPRINT_2_CANONICAL_STRUCTURE_MODEL.md` y `docs/architecture/CONTRATOS_MODELO_ESTRUCTURAL.md`

## Regla central

Cada dimensión estructural conserva una responsabilidad distinta. Ninguna dimensión debe inferirse silenciosamente desde otra.

La **jurisdicción eclesiástica es el eje principal de composición funcional del sistema**. Toda estructura pastoral, administrativa o colegial debe pertenecer explícitamente a una jurisdicción o a una unidad dependiente de ella. No existen órganos organizativos globales sin un alcance jurisdiccional definido.

## Eje jurisdiccional

Fuente canónica de identidad: `ecclesiastical_entities`.

Una jurisdicción es una entidad eclesiástica con capacidad de contener estructura territorial y organización interna según su naturaleza. Entre otras, puede representar arquidiócesis, diócesis, ordinariatos, prelaturas, vicariatos apostólicos u otras circunscripciones configuradas en el catálogo canónico.

La jurisdicción responde a «¿dentro de qué autoridad y alcance eclesiástico existe esta estructura?». Debe ser el punto de entrada para:

- navegación pública y administrativa;
- filtros y dashboards;
- permisos y alcance;
- organigramas;
- cargos y nombramientos;
- estadísticas;
- fuentes, auditoría e historial;
- publicación selectiva.

Cada unidad organizativa debe resolver de forma inequívoca su jurisdicción, directamente mediante `ecclesiastical_entity_id` o mediante una relación canónica derivable y validada. No se permite inferirla por nombre, slug, organigrama o coincidencias textuales.

## Identidad institucional

Fuente canónica: `ecclesiastical_entities`.

Responde a «¿qué entidad es?». Conserva nombre, slug, tipo y metadatos institucionales. Una entidad mantiene su identidad aunque cambie de posición territorial. Las relaciones jerárquicas no se reconstruyen desde nombres ni slugs.

No toda entidad institucional es una jurisdicción. Cuando una entidad actúe como jurisdicción, ese rol debe provenir de su tipo o configuración canónica, no de una convención visual.

## Jerarquía territorial configurable

Fuentes canónicas:

- `structure_templates`;
- `structure_levels`;
- `structure_nodes`;
- `structure_node_edges`.

Responde a «¿cuál es su posición territorial vigente o histórica dentro de una jurisdicción?». `structure_node_edges` es la única fuente canónica de parentesco territorial. `structure_nodes.parent_node_id` no es fuente jerárquica y solo puede existir como compatibilidad o proyección derivada.

Las raíces se determinan por ausencia de edges entrantes elegibles. Los ciclos deben impedirse antes de confirmar relaciones. La vigencia se evalúa en nodos y edges.

Cada plantilla territorial debe tener una jurisdicción propietaria. Los nodos y relaciones que la integran no pueden mezclar jurisdicciones salvo que exista un contrato explícito para una estructura supradiocesana.

Contratos de lectura principales:

- `get_structure_tree`;
- `get_entity_descendants`;
- servicios tipados de `features/structures` y dominios equivalentes vigentes.

## Organización interna

Fuentes canónicas:

- `organization_charts`;
- `organization_units`.

Representan órganos y unidades que funcionan dentro de una jurisdicción. La clasificación organizativa mínima es:

- **pastoral**: vicarías pastorales, comisiones, coordinaciones, áreas, secretariados y organismos de acción pastoral;
- **administrativa**: curia, cancillería, economía, tribunales, oficinas, departamentos y servicios de gestión;
- **colegial**: consejos, colegios, cabildos, comisiones deliberativas y demás órganos colegiados.

Una jurisdicción puede tener uno o varios organigramas de cada clasificación cuando su estructura real lo requiera. Cada organigrama pertenece a una jurisdicción y cada unidad pertenece a un organigrama explícito.

Una unidad organizativa puede tener unidades hijas y órganos subordinados de su misma clasificación o de una clasificación permitida por reglas explícitas. No se debe mezclar pastoral, administrativa y colegial mediante nombres o convenciones implícitas.

Una unidad organizativa opera dentro de su jurisdicción sin convertirse automáticamente en entidad institucional ni en nodo territorial. Solo debe enlazarse a `ecclesiastical_entities` o `structure_nodes` cuando exista una identidad o posición territorial real que justifique esa relación.

La jerarquía interna usa `parent_unit_id`. Crear o editar contenido no aprueba ni publica. Aprobación, publicación, desactivación, archivo y restauración son transiciones explícitas y auditadas.

## Regla de pertenencia

La composición funcional esperada es:

```text
Jurisdicción
├── Estructura territorial
│   └── Nodos territoriales
├── Organización pastoral
│   └── Órganos y unidades pastorales
├── Organización administrativa
│   └── Órganos y unidades administrativas
└── Organización colegial
    └── Órganos y unidades colegiales
```

La jurisdicción no es una unidad organizativa. Es el alcance propietario que vincula las dimensiones territorial, pastoral, administrativa y colegial.

Toda consulta, mutación o proyección de organización interna debe conservar este eje:

```text
jurisdiction_id → organization_chart → organization_unit
```

En el esquema actual, `jurisdiction_id` puede materializarse como `ecclesiastical_entity_id` mientras se mantenga una validación explícita de que la entidad seleccionada es una jurisdicción admisible.

## Cargos y nombramientos

Los cargos disponibles se determinan por configuración de nivel, organigrama, jurisdicción y estado canónico. No existe fallback silencioso a todos los cargos.

Un nombramiento conserva como mínimo persona, cargo, jurisdicción, alcance, vigencia, contexto organizativo cuando aplique, sucesión cuando corresponda, fuente y auditoría.

Un cargo en un órgano pastoral, administrativo o colegial debe resolver primero su jurisdicción y después su unidad organizativa. No se permite una asignación organizativa cuyo órgano y jurisdicción sean incompatibles.

## Relación entre dimensiones

| Dimensión | Responde a | No sustituye |
|---|---|---|
| Jurisdicción | ¿bajo qué autoridad y alcance existe? | Unidad organizativa |
| Identidad institucional | ¿qué entidad es? | Posición territorial |
| Jerarquía territorial | ¿dónde se ubica en la estructura de la jurisdicción? | Organización interna |
| Organización interna | ¿qué órganos y unidades funcionan en la jurisdicción? | Identidad institucional |
| Nombramientos | ¿quién ocupa qué cargo, dónde y cuándo? | Definición estructural |

## Escritura autorizada

Toda mutación estructural administrativa debe:

1. autenticar al actor;
2. validar permiso;
3. validar la jurisdicción propietaria;
4. validar alcance territorial u organizativo;
5. validar invariantes y ausencia de ciclos;
6. ejecutar mediante contrato transaccional canónico;
7. registrar auditoría con jurisdicción y alcance;
8. invalidar proyecciones o cachés públicas afectadas cuando corresponda.

Las tablas canónicas críticas no aceptan escrituras directas desde clientes autenticados cuando existe una fachada administrativa autorizada.

## Ciclo de vida y publicación

El guardado ordinario conserva el ciclo de vida. Las unidades nuevas nacen como borrador interno. Aprobar y publicar son acciones separadas. Una aprobación no implica visibilidad pública.

La publicación de una unidad depende también del estado, visibilidad y vigencia de su jurisdicción y de su organigrama. Una unidad no puede quedar públicamente visible si su jurisdicción propietaria no es pública, activa y vigente.

## Compatibilidad heredada

Los modelos estructurales retirados no pueden reaparecer como consumidores de aplicación bajo `src/`. Las migraciones históricas pueden conservar referencias necesarias para transformación o rollback. Las compatibilidades de payload permitidas son de solo lectura y deben derivarse de fuentes canónicas.

La política detallada de retirada permanece en [Deprecaciones estructurales](./DEPRECACIONES_ESTRUCTURALES.md).

## Regla para funcionalidades nuevas

Antes de implementar una funcionalidad debe identificarse:

- jurisdicción propietaria;
- dimensión responsable;
- clasificación pastoral, administrativa o colegial cuando aplique;
- fuente canónica de lectura;
- contrato autorizado de escritura;
- permiso y alcance;
- vigencia e historial afectados;
- proyección pública a invalidar;
- pruebas de contrato necesarias.

Cuando una función necesite varias dimensiones, debe componerlas desde la jurisdicción sin convertir una dimensión en sustituto de otra.
