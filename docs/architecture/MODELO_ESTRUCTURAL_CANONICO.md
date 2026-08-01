# Modelo estructural canónico

> Estado: vigente
> Última revisión: 2026-08-01
> Propietario: arquitectura y dominio de estructuras
> Sustituye: `docs/SPRINT_2_CANONICAL_STRUCTURE_MODEL.md` y `docs/architecture/CONTRATOS_MODELO_ESTRUCTURAL.md`

## Regla central

Cada dimensión estructural conserva una responsabilidad distinta. Ninguna dimensión debe inferirse silenciosamente desde otra.

Las **jurisdicciones eclesiásticas forman un catálogo territorial canónico**. Cada jurisdicción territorial actúa como una cuenta o contexto operativo independiente dentro de SINEP-RD. Bajo esa cuenta se configuran sus estructuras territoriales y sus suborganizaciones pastorales, administrativas y colegiales.

No existen órganos organizativos globales sin una cuenta jurisdiccional propietaria.

## Catálogo de jurisdicciones y cuentas territoriales

Fuente canónica de identidad: `ecclesiastical_entities`.

El catálogo de jurisdicciones contiene las circunscripciones territoriales admitidas por el sistema, por ejemplo:

- arquidiócesis;
- diócesis;
- ordinariatos;
- prelaturas territoriales;
- vicariatos apostólicos;
- prefecturas apostólicas;
- otras circunscripciones configuradas en el catálogo canónico.

Cada jurisdicción territorial puede habilitarse como una **cuenta operativa**. La cuenta no crea una identidad eclesial nueva: utiliza la jurisdicción del catálogo como raíz de datos, permisos, configuración y navegación.

La cuenta jurisdiccional debe ser el punto de entrada para:

- navegación pública y administrativa;
- filtros y dashboards;
- usuarios, roles y permisos;
- estructura territorial;
- suborganizaciones pastorales, administrativas y colegiales;
- organigramas;
- cargos y nombramientos;
- estadísticas;
- fuentes, auditoría e historial;
- publicación selectiva.

Una jurisdicción puede existir en el catálogo sin tener todavía una cuenta operativa activa. Activar una cuenta habilita su gestión, pero no publica automáticamente sus datos.

La jurisdicción propietaria debe resolverse mediante su identificador canónico. No se permite inferirla por nombre, slug, organigrama o coincidencias textuales.

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

Responde a «¿cuál es su posición territorial vigente o histórica dentro de una cuenta jurisdiccional?». `structure_node_edges` es la única fuente canónica de parentesco territorial. `structure_nodes.parent_node_id` no es fuente jerárquica y solo puede existir como compatibilidad o proyección derivada.

Las raíces se determinan por ausencia de edges entrantes elegibles. Los ciclos deben impedirse antes de confirmar relaciones. La vigencia se evalúa en nodos y edges.

Cada plantilla territorial pertenece a una jurisdicción propietaria. Los nodos y relaciones que la integran no pueden mezclar jurisdicciones salvo que exista un contrato explícito para una estructura supradiocesana.

Contratos de lectura principales:

- `get_structure_tree`;
- `get_entity_descendants`;
- servicios tipados de `features/structures` y dominios equivalentes vigentes.

## Suborganizaciones de la cuenta jurisdiccional

Fuentes canónicas:

- `organization_charts`;
- `organization_units`.

Cada cuenta jurisdiccional puede configurar suborganizaciones independientes según su realidad eclesial. La clasificación mínima es:

- **pastoral**: vicarías pastorales, comisiones, coordinaciones, áreas, secretariados y organismos de acción pastoral;
- **administrativa**: curia, cancillería, economía, tribunales, oficinas, departamentos y servicios de gestión;
- **colegial**: consejos, colegios, cabildos, comisiones deliberativas y demás órganos colegiados.

Una cuenta puede tener cero, uno o varios organigramas de cada clasificación. No se deben crear organigramas vacíos por defecto cuando la jurisdicción no los utilice.

Cada organigrama pertenece explícitamente a una cuenta jurisdiccional. Cada unidad pertenece a un organigrama y hereda de él la jurisdicción propietaria y la clasificación organizativa.

Una unidad organizativa puede tener unidades hijas y órganos subordinados de su misma clasificación o de una clasificación permitida por reglas explícitas. No se debe mezclar pastoral, administrativa y colegial mediante nombres o convenciones implícitas.

Una unidad organizativa opera dentro de su cuenta jurisdiccional sin convertirse automáticamente en entidad institucional ni en nodo territorial. Solo debe enlazarse a `ecclesiastical_entities` o `structure_nodes` cuando exista una identidad o posición territorial real que justifique esa relación.

La jerarquía interna usa `parent_unit_id`. Crear o editar contenido no aprueba ni publica. Aprobación, publicación, desactivación, archivo y restauración son transiciones explícitas y auditadas.

## Regla de composición

La composición funcional esperada es:

```text
Catálogo de jurisdicciones
└── Cuenta jurisdiccional
    ├── Estructura territorial
    │   └── Nodos territoriales
    ├── Suborganización pastoral
    │   └── Órganos y unidades pastorales
    ├── Suborganización administrativa
    │   └── Órganos y unidades administrativas
    └── Suborganización colegial
        └── Órganos y unidades colegiales
```

La jurisdicción no es una unidad organizativa. Es la cuenta territorial propietaria que agrupa las dimensiones territorial, pastoral, administrativa y colegial.

Toda consulta, mutación o proyección de organización interna debe conservar este eje:

```text
jurisdiction_id → organization_chart → organization_unit
```

`organization_chart` representa una suborganización o árbol organizativo dentro de la cuenta. `organization_unit` representa cada órgano, oficina, consejo, comisión, área o unidad que pertenece a ese árbol.

En el esquema actual, `jurisdiction_id` puede materializarse como `ecclesiastical_entity_id` mientras se mantenga una validación explícita de que la entidad seleccionada es una jurisdicción territorial admisible.

## Aislamiento de cuenta

Toda lectura y escritura administrativa debe operar dentro de una cuenta jurisdiccional resuelta.

Como mínimo, el sistema debe garantizar:

- que un usuario solo gestione las jurisdicciones autorizadas;
- que un organigrama no mezcle unidades de cuentas distintas;
- que una unidad hija pertenezca a la misma cuenta que su padre;
- que cargos, nombramientos, fuentes y auditoría conserven la cuenta propietaria;
- que los filtros y estadísticas se calculen primero por jurisdicción;
- que una publicación nunca exponga datos de otra cuenta por una relación incorrecta.

No se propone un esquema físico separado por cuenta. El aislamiento se mantiene mediante claves jurisdiccionales, RLS, permisos por alcance, contratos transaccionales y auditoría.

## Cargos y nombramientos

Los cargos disponibles se determinan por configuración de nivel, organigrama, jurisdicción y estado canónico. No existe fallback silencioso a todos los cargos.

Un nombramiento conserva como mínimo persona, cargo, jurisdicción, alcance, vigencia, contexto organizativo cuando aplique, sucesión cuando corresponda, fuente y auditoría.

Un cargo en un órgano pastoral, administrativo o colegial debe resolver primero su cuenta jurisdiccional y después su unidad organizativa. No se permite una asignación organizativa cuyo órgano y jurisdicción sean incompatibles.

## Relación entre dimensiones

| Dimensión | Responde a | No sustituye |
|---|---|---|
| Catálogo de jurisdicciones | ¿qué circunscripciones territoriales reconoce el sistema? | Cuenta operativa |
| Cuenta jurisdiccional | ¿en qué contexto territorial se gestionan datos y permisos? | Unidad organizativa |
| Identidad institucional | ¿qué entidad es? | Posición territorial |
| Jerarquía territorial | ¿dónde se ubica en la estructura de la jurisdicción? | Organización interna |
| Suborganización interna | ¿qué órganos y unidades funcionan en la cuenta? | Identidad institucional |
| Nombramientos | ¿quién ocupa qué cargo, dónde y cuándo? | Definición estructural |

## Escritura autorizada

Toda mutación estructural administrativa debe:

1. autenticar al actor;
2. resolver la cuenta jurisdiccional;
3. validar permiso;
4. validar la jurisdicción propietaria;
5. validar alcance territorial u organizativo;
6. validar invariantes y ausencia de ciclos;
7. ejecutar mediante contrato transaccional canónico;
8. registrar auditoría con jurisdicción y alcance;
9. invalidar proyecciones o cachés públicas afectadas cuando corresponda.

Las tablas canónicas críticas no aceptan escrituras directas desde clientes autenticados cuando existe una fachada administrativa autorizada.

## Ciclo de vida y publicación

El guardado ordinario conserva el ciclo de vida. Las unidades nuevas nacen como borrador interno. Aprobar y publicar son acciones separadas. Una aprobación no implica visibilidad pública.

La publicación de una unidad depende también del estado, visibilidad y vigencia de su cuenta jurisdiccional y de su organigrama. Una unidad no puede quedar públicamente visible si su jurisdicción propietaria no es pública, activa y vigente.

## Compatibilidad heredada

Los modelos estructurales retirados no pueden reaparecer como consumidores de aplicación bajo `src/`. Las migraciones históricas pueden conservar referencias necesarias para transformación o rollback. Las compatibilidades de payload permitidas son de solo lectura y deben derivarse de fuentes canónicas.

La política detallada de retirada permanece en [Deprecaciones estructurales](./DEPRECACIONES_ESTRUCTURALES.md).

## Regla para funcionalidades nuevas

Antes de implementar una funcionalidad debe identificarse:

- jurisdicción del catálogo;
- cuenta jurisdiccional propietaria;
- dimensión responsable;
- clasificación pastoral, administrativa o colegial cuando aplique;
- fuente canónica de lectura;
- contrato autorizado de escritura;
- permiso y alcance;
- vigencia e historial afectados;
- proyección pública a invalidar;
- pruebas de contrato necesarias.

Cuando una función necesite varias dimensiones, debe componerlas desde la cuenta jurisdiccional sin convertir una dimensión en sustituto de otra.
