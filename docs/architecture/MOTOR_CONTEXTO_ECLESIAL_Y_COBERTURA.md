# Motor de Contexto Eclesial y cobertura geográfica

> Estado: vigente
> Última revisión: 2026-08-05
> Propietario: arquitectura, dominio territorial y producto público
> Complementa: `MODELO_ESTRUCTURAL_CANONICO.md`

## Propósito

Este contrato separa tres responsabilidades que no deben confundirse:

1. la organización eclesial canónica;
2. la cobertura o presencia geográfica;
3. la explicación pedagógica tipo wiki.

El usuario puede iniciar la exploración por un país porque es una entrada comprensible, pero el país no es necesariamente el padre canónico de una jurisdicción eclesiástica.

## Principio rector

La estructura eclesial es el eje del dominio. La geografía civil es una dimensión de descubrimiento, cobertura, ubicación y análisis.

```text
Entrada de descubrimiento
├── país
├── provincia eclesiástica
├── jurisdicción
├── parroquia
└── búsqueda global
        ↓
Motor de Contexto Eclesial
        ↓
Jurisdicción seleccionada
        ↓
Árbol territorial configurable
        ↓
Unidad local
```

Una jurisdicción puede:

- abarcar un país completo;
- abarcar parte de un país;
- abarcar varios países;
- tener presencia personal o especializada en distintos territorios;
- pertenecer o no a una provincia eclesiástica;
- estar inmediatamente sujeta a la Santa Sede.

Por tanto, no se permite deducir la estructura canónica desde `country_iso2`, nombres civiles ni una cadena fija país → provincia → diócesis.

## Modelo tipo plan de cuentas

La analogía con un plan de cuentas se aplica al árbol eclesial operativo:

- cada jurisdicción es una cuenta o contexto propietario;
- cada plantilla define la estructura admitida;
- cada nivel define la clasificación de los nodos;
- cada nodo tiene identidad estable;
- cada relación padre-hijo se registra explícitamente;
- el orden, la vigencia y la visibilidad son datos, no convenciones visuales;
- pueden incorporarse niveles nuevos sin alterar el esquema base.

Fuentes canónicas existentes:

- `ecclesiastical_entities`: identidad de jurisdicciones y entidades;
- `structure_templates`: plan estructural de una jurisdicción;
- `structure_levels`: catálogo de niveles del plan;
- `structure_nodes`: cuentas o nodos operativos;
- `structure_node_edges`: parentesco canónico e histórico;
- `public_jurisdiction_structure_tree`: proyección pública del árbol territorial.

La referencia estructural no debe construirse únicamente como un código decimal mutable. El identificador estable es el UUID. Puede existir un `reference_code` legible, pero debe conservarse aunque cambie la posición del nodo; la ruta jerárquica se deriva de los edges vigentes.

## Cobertura geográfica

La cobertura geográfica debe modelarse como una relación explícita, muchos-a-muchos e histórica.

Modelo conceptual:

```text
jurisdiction_geographic_coverages
├── jurisdiction_id
├── geographic_area_type
├── country_iso2
├── civil_division_id (futuro/opcional)
├── coverage_kind
├── coverage_percentage (opcional)
├── valid_from
├── valid_to
├── is_current
├── status
├── visibility
├── source_document_id
└── notes
```

`coverage_kind` debe distinguir como mínimo:

- `full`: cubre completamente el área indicada;
- `partial`: cubre solo parte del área;
- `personal`: presencia o competencia personal no estrictamente territorial;
- `specialized`: competencia especializada, por ejemplo militar;
- `seat`: país o territorio de la sede principal;
- `historical`: cobertura no vigente conservada para cronología.

Una jurisdicción puede tener varias filas vigentes. Ninguna fila implica por sí sola que el país sea su padre estructural.

## Compatibilidad con `country_iso2`

El campo `ecclesiastical_entities.country_iso2` existe y se usa actualmente en proyecciones públicas. Desde este contrato se considera:

- una referencia de compatibilidad;
- preferentemente el país de la sede principal;
- insuficiente para representar cobertura real;
- no canónico para determinar pertenencia estructural;
- no eliminable hasta migrar consumidores y datos.

La migración deberá poblar inicialmente la cobertura desde `country_iso2` como `coverage_kind = 'seat'` o `full` según evidencia disponible. No debe asumir automáticamente cobertura completa.

## Provincia eclesiástica

La provincia eclesiástica pertenece al dominio eclesial, no al civil.

Debe representarse mediante identidad y relaciones canónicas entre entidades. Una provincia eclesiástica puede servir como entrada de navegación, pero no debe inferirse por país. Una jurisdicción puede:

- pertenecer a una provincia eclesiástica;
- estar inmediatamente sujeta a la Santa Sede;
- pertenecer a otra agrupación admitida por el catálogo canónico.

## Entrada pública por país

La página de un país responde:

> ¿Cómo está organizada y presente la Iglesia católica en este territorio?

Debe agregar jurisdicciones por cobertura geográfica y explicar el tipo de relación:

- sede y cobertura principal;
- cobertura parcial;
- jurisdicción supranacional;
- jurisdicción personal o especializada;
- provincia eclesiástica relacionada;
- representación pontificia y conferencia episcopal cuando existan datos canónicos.

La página del país no reconstruye un árbol falso. Presenta rutas hacia los árboles eclesiales verdaderos.

## Contenido pedagógico tipo wiki

El contenido pedagógico requiere dos capas distintas:

### Catálogo conceptual

Explica qué es cada tipo:

- jurisdicción eclesiástica;
- diócesis;
- arquidiócesis;
- provincia eclesiástica;
- parroquia;
- vicaría;
- zona pastoral territorial;
- decanato;
- arciprestazgo;
- capilla;
- ordinariato;
- vicariato apostólico;
- prefectura apostólica;
- prelatura territorial;
- otros tipos configurados.

Cada concepto debe admitir:

- definición breve;
- explicación ampliada;
- posición habitual en la organización;
- qué puede contener;
- autoridad o responsable habitual;
- diferencias con conceptos relacionados;
- fuentes documentales;
- estado editorial y revisión.

### Ficha de instancia

Explica una entidad o nodo concreto:

- identidad;
- tipo y definición contextual;
- posición en el árbol;
- cobertura geográfica;
- historia y eventos institucionales;
- responsables y sucesión;
- estadísticas;
- fuentes;
- relaciones y elementos dependientes.

El catálogo conceptual no sustituye los datos de instancia, y la instancia no debe duplicar manualmente la definición del tipo.

## Auditoría del esquema actual

### Implementado y reutilizable

- identidad canónica en `ecclesiastical_entities`;
- tipos en `entity_types`;
- relaciones eclesiales explícitas en `entity_relationships`;
- plantillas, niveles, nodos y edges territoriales;
- vigencia, estado y visibilidad;
- proyección pública recursiva por jurisdicción;
- catálogo ISO de países;
- lugares e instituciones con ubicación civil propia;
- fuentes, documentos y trazabilidad en varios dominios.

### Parcial o incompatible con el nuevo contrato

- `ecclesiastical_entities.country_iso2` representa un solo país;
- `public_dioceses` proyecta un único país por jurisdicción;
- `public_countries` detecta presencia mediante `ee.country_iso2`;
- el dashboard público filtra diócesis por igualdad de `country_iso2`;
- la URL y el estado del dashboard todavía tratan país como filtro ascendente obligatorio en varios flujos;
- no existe un catálogo pedagógico canónico identificado en la auditoría actual.

### Faltante

- relación muchos-a-muchos jurisdicción ↔ cobertura geográfica;
- proyección pública de coberturas vigentes;
- resolución de jurisdicciones por país sin asumir paternidad;
- clasificación explícita de cobertura;
- historial de cambios de cobertura;
- catálogo conceptual wiki y sus fuentes editoriales;
- contrato unificado de breadcrumbs con múltiples puntos de entrada.

## Orden de implementación

1. Crear el contrato y tablas de cobertura geográfica.
2. Sembrar compatibilidad desde `country_iso2` sin inferir cobertura completa.
3. Crear proyecciones públicas de cobertura.
4. Actualizar `public_countries` y `public_dioceses` para usar cobertura.
5. Adaptar el dashboard para que país sea entrada de descubrimiento.
6. Conectar el árbol territorial real después de seleccionar jurisdicción.
7. Incorporar catálogo pedagógico y fichas tipo wiki.
8. Retirar gradualmente dependencias canónicas de `country_iso2`.

## Fuera de alcance inmediato

Hasta cerrar el motor territorial:

- expansión de organigramas pastorales;
- expansión de organización administrativa;
- expansión de organización colegial;
- KPI de esas dimensiones.

Una zona pastoral solo pertenece al árbol territorial cuando la jurisdicción la define explícitamente como `structure_level` y sus instancias como `structure_nodes`.

## Criterio de cierre

El motor territorial se considera correctamente separado cuando:

- una jurisdicción puede relacionarse con varios países;
- buscar por país devuelve jurisdicciones relacionadas sin convertir el país en padre;
- seleccionar una jurisdicción carga su estructura territorial configurada;
- breadcrumbs y URL distinguen ruta de descubrimiento de ruta canónica;
- las fichas explican tanto el concepto como la instancia;
- ningún KPI territorial depende de una inferencia por nombre o de un único `country_iso2`.
