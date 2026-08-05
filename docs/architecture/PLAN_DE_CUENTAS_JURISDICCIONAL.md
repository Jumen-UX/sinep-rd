# Plan de cuentas y organigrama jurisdiccional

> Estado: vigente
> Fecha: 2026-08-05
> Propietario: arquitectura y dominio jurisdiccional
> Sustituye como prioridad de producto a los motores territoriales internos, pastorales, administrativos y colegiales.

## Regla central

SINEP se concentra exclusivamente en representar, explicar, navegar e historizar las jurisdicciones eclesiales de la Iglesia católica.

El núcleo es un **organigrama jurisdiccional versionado**. Su implementación usa principios de un plan de cuentas: identidad estable, clasificación, dependencia, vigencia, reglas de integridad y trazabilidad. Su representación funcional muestra cómo se relacionan las jurisdicciones eclesiales desde la Santa Sede.

El organigrama no representa personas, cargos, países ni estructuras internas de una diócesis. Sus nodos representan provincias eclesiásticas, arquidiócesis, diócesis, ordinariatos, prelaturas, vicariatos, prefecturas, administraciones, eparquías, exarcados y otras jurisdicciones admitidas.

## Tres perspectivas del mismo modelo

- **Plan de cuentas jurisdiccional:** identidad, código estable, clasificación y control de integridad.
- **Organigrama jurisdiccional:** representación administrativa de nodos y dependencias.
- **Árbol jurisdiccional:** proyección técnica vigente o histórica de las relaciones.

No son tres sistemas distintos.

## Separación obligatoria

- El país es una dimensión de descubrimiento y cobertura; nunca es padre canónico.
- `ecclesiastical_entities` conserva la identidad institucional.
- `jurisdiction_accounts` incorpora cada identidad jurisdiccional al plan.
- `jurisdiction_account_edges` conserva dependencia, vigencia e historia organizativa.
- `jurisdiction_account_type_rules` define combinaciones padre/hijo admisibles.
- Las relaciones geográficas se mantienen en `jurisdiction_geographic_coverages`.
- La historia institucional y la auditoría técnica no se mezclan.

## Código de cuenta

Cada cuenta posee un código interno estable e inmutable. El código no codifica la posición jerárquica para evitar que una modificación de dependencia cambie la identidad de la cuenta.

La ruta jerárquica se calcula como proyección y puede variar históricamente sin alterar el código estable.

## Estado actual, historia y auditoría

Toda modificación del organigrama debe clasificarse antes de persistirse:

1. **Evento histórico:** hecho institucional documentado que forma parte de la historia pública de la jurisdicción. Puede crear, elevar, unir, dividir, suprimir, restaurar, renombrar o cambiar la dependencia de una cuenta. Debe registrar fecha efectiva, tipo de evento, fuente y efectos estructurales.
2. **Cambio organizativo:** operación administrativa que modifica el estado vigente del organigrama sin constituir por sí misma un relato histórico público. Puede preparar, corregir o completar una relación organizativa. Conserva trazabilidad interna.
3. **Corrección administrativa:** ajuste editorial o de calidad de datos que no altera la realidad histórica ni canónica. Genera auditoría, pero no aparece en la cronología pública.

Un evento histórico puede producir uno o varios cambios en `jurisdiction_accounts` y `jurisdiction_account_edges`. Una corrección administrativa nunca debe crear automáticamente un evento histórico.

## Alcance activo

Durante esta fase solo se desarrollan:

1. catálogo de jurisdicciones;
2. plan de cuentas;
3. tipos y reglas padre/hijo;
4. organigrama vigente e histórico;
5. ficha pública tipo wiki;
6. eventos jurisdiccionales;
7. descubrimiento auxiliar por país;
8. auditoría de cambios del organigrama.

Quedan congelados, sin eliminación física:

- estructuras internas de diócesis;
- parroquias, capillas, sectores y comunidades;
- organización pastoral;
- organización administrativa ajena al organigrama jurisdiccional;
- organización colegial;
- personas, cargos y nombramientos;
- instituciones, lugares y medios;
- dashboards y KPI ajenos a jurisdicciones.

## Criterios de integridad

- Una cuenta corresponde a una sola entidad jurisdiccional.
- Una cuenta tiene como máximo un padre vigente.
- La Santa Sede es la raíz inicial.
- Un país no puede ser cuenta padre.
- Los ciclos están prohibidos.
- Cada relación conserva vigencia, fuente y estado.
- Las reglas de tipos se validan antes de crear o cambiar una dependencia.
- Ningún consumidor nuevo debe inferir dependencia desde `country_iso2`.
- Todo evento histórico debe tener fecha efectiva y fuente documentada.
- Toda operación administrativa debe producir auditoría.
- La cronología pública solo incluye eventos marcados como históricos y publicados.

## Experiencia administrativa

El administrador trabaja sobre un organigrama interactivo con capacidad para:

- expandir y contraer ramas;
- buscar por código, nombre o tipo;
- crear y editar cuentas;
- proponer o ejecutar cambios de dependencia;
- registrar eventos históricos con efectos estructurales;
- registrar correcciones administrativas sin contaminar la historia pública;
- consultar el estado del organigrama en una fecha determinada;
- revisar auditoría y fuentes.

## Experiencia pública

El público no recibe el organigrama técnico editable. La información se presenta mediante recorridos pedagógicos, páginas por país, fichas tipo wiki, relaciones explicadas y líneas de tiempo institucionales.

## Compatibilidad

Las tablas y pantallas existentes fuera del dominio jurisdiccional no se eliminan todavía. Permanecen congeladas para preservar datos y permitir una retirada deliberada posterior. Ninguna funcionalidad nueva debe depender de ellas mientras este contrato esté vigente.
