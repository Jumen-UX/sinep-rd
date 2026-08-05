# Plan de cuentas jurisdiccional

> Estado: vigente
> Fecha: 2026-08-05
> Propietario: arquitectura y dominio jurisdiccional
> Sustituye como prioridad de producto a los motores territoriales internos, pastorales, administrativos y colegiales.

## Regla central

SINEP se concentra exclusivamente en representar, explicar, navegar e historizar las jurisdicciones eclesiales de la Iglesia católica.

El núcleo no es el país, la parroquia, el organigrama, la persona ni la estructura interna de una diócesis. El núcleo es un **plan de cuentas jurisdiccional** cuya raíz es la Santa Sede y cuyos registros representan provincias eclesiásticas, arquidiócesis, diócesis, ordinariatos, prelaturas, vicariatos, prefecturas, administraciones, eparquías, exarcados y otras jurisdicciones admitidas.

## Separación obligatoria

- El país es una dimensión de descubrimiento y cobertura; nunca es padre canónico.
- `ecclesiastical_entities` conserva la identidad institucional.
- `jurisdiction_accounts` incorpora cada identidad jurisdiccional al plan de cuentas.
- `jurisdiction_account_edges` conserva dependencia, vigencia e historia.
- `jurisdiction_account_type_rules` define combinaciones padre/hijo admisibles.
- Las relaciones geográficas se mantienen en `jurisdiction_geographic_coverages`.

## Código de cuenta

Cada cuenta posee un código interno estable e inmutable. El código no codifica la posición jerárquica para evitar que una modificación de dependencia cambie la identidad de la cuenta.

La ruta jerárquica se calcula como proyección y puede variar históricamente sin alterar el código estable.

## Alcance activo

Durante esta fase solo se desarrollan:

1. catálogo de jurisdicciones;
2. plan de cuentas;
3. tipos y reglas padre/hijo;
4. árbol vigente e histórico;
5. ficha pública tipo wiki;
6. eventos jurisdiccionales;
7. descubrimiento auxiliar por país.

Quedan congelados, sin eliminación física:

- estructuras internas de diócesis;
- parroquias, capillas, sectores y comunidades;
- organización pastoral;
- organización administrativa;
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

## Compatibilidad

Las tablas y pantallas existentes fuera del dominio jurisdiccional no se eliminan todavía. Permanecen congeladas para preservar datos y permitir una retirada deliberada posterior. Ninguna funcionalidad nueva debe depender de ellas mientras este contrato esté vigente.
