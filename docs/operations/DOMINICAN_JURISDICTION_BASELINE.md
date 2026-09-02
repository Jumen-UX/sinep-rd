# Línea base jurisdiccional — República Dominicana

> Estado: vigente
> Fecha de corte: 2026-09-02
> Propietario: dominio jurisdiccional, calidad de datos y arquitectura
> Migración: `20260902125431_load_dominican_jurisdiction_baseline.sql`
> Contrato relacionado: `docs/architecture/MOTOR_CONTEXTO_ECLESIAL_Y_COBERTURA.md`

## Propósito

Este documento fija la primera línea base real y documentada del organigrama jurisdiccional vigente de la Iglesia católica en República Dominicana después del retiro de fixtures ficticios.

La línea base modela identidad jurisdiccional, dependencia canónica y cobertura geográfica de descubrimiento. No carga ordinarios actuales, estadísticas pastorales, límites civiles finos ni organigramas internos.

## Principios de modelado

- La Santa Sede es la raíz canónica del plan jurisdiccional.
- República Dominicana es una dimensión de cobertura geográfica y de descubrimiento, no el padre canónico de las jurisdicciones.
- Las provincias eclesiásticas son entidades eclesiales canónicas.
- Las sedes metropolitanas y sufragáneas se relacionan mediante `jurisdiction_account_edges`.
- El Ordinariato Militar se modela como jurisdicción especializada dependiente de la Santa Sede.
- `ecclesiastical_entities.country_iso2 = 'DO'` se conserva como compatibilidad/país de referencia; la cobertura explícita vive en `jurisdiction_geographic_coverages`.
- No se infiere porcentaje de cobertura ni frontera civil donde las fuentes usadas no lo documentan con el nivel requerido.

## Resultado esperado

El estado vigente queda compuesto por 16 cuentas jurisdiccionales: la Santa Sede existente, dos provincias eclesiásticas, doce circunscripciones territoriales y un ordinariato militar. Existen 15 dependencias vigentes y 15 coberturas explícitas relacionadas con República Dominicana. La proyección `public_dioceses` devuelve 13 circunscripciones para `DO`.

### Provincia Eclesiástica de Santo Domingo

- Arquidiócesis de Santo Domingo — sede metropolitana.
- Diócesis de Baní — sufragánea.
- Diócesis de Barahona — sufragánea.
- Diócesis de Nuestra Señora de la Altagracia en Higüey — sufragánea.
- Diócesis de San Juan de la Maguana — sufragánea.
- Diócesis de San Pedro de Macorís — sufragánea.
- Diócesis de Stella Maris — sufragánea desde su erección el 27 de agosto de 2025.

### Provincia Eclesiástica de Santiago de los Caballeros

- Arquidiócesis de Santiago de los Caballeros — sede metropolitana.
- Diócesis de La Vega — sufragánea.
- Diócesis de Mao-Montecristi — sufragánea.
- Diócesis de Puerto Plata — sufragánea.
- Diócesis de San Francisco de Macorís — sufragánea.

### Jurisdicción especializada

- Ordinariato Militar de la República Dominicana — dependencia especializada de la Santa Sede; no pertenece a una provincia eclesiástica territorial.

## Fuentes

### Primarias

1. **Conferencia del Episcopado Dominicano — Mensaje del 27 de febrero de 2026.** Se usa para confirmar la existencia vigente de las sedes territoriales dominicanas y la presencia de Stella Maris en el episcopado nacional.
   - `https://ced.org.do/backoffice/wp-content/uploads/2026/02/Mensaje-CED-27-de-febrero-2026-1.pdf`
2. **Sala Stampa della Santa Sede — Erección de la Diócesis de Stella Maris, 27 de agosto de 2025.** Confirma su erección y su condición de sufragánea de Santo Domingo.
   - `https://press.vatican.va/content/salastampa/it/bollettino/pubblico/2025/08/27/0594/01028.html`
3. **Sala Stampa della Santa Sede — Ordinariato Militar de la República Dominicana, 2 de enero de 2017.** Confirma la existencia vigente de la jurisdicción militar.
   - `https://press.vatican.va/content/salastampa/es/bollettino/pubblico/2017/01/02/otros.html`

### Secundarias de contraste estructural

4. **Catholic-Hierarchy — Current Dioceses in Dominican Republic.** Se usa para contrastar el inventario vigente de 13 circunscripciones.
   - `https://www.catholic-hierarchy.org/country/ddo2.html`
5. **Catholic-Hierarchy — Structured View of Dioceses.** Se usa para contrastar las dos provincias eclesiásticas, sus sedes metropolitanas y sufragáneas.
   - `https://catholic-hierarchy.org/diocese/qview2.html`

Las fechas históricas de erección/elevación cargadas en la migración se toman de las fichas históricas de las respectivas circunscripciones en Catholic-Hierarchy y se usan como línea base operativa. Una futura fase de enriquecimiento documental puede sustituir o complementar esas referencias con actas de la Santa Sede/AAS por jurisdicción sin cambiar las identidades UUID ni la jerarquía vigente.

## Fuera de esta línea base

No se fijan aquí:

- obispo/arzobispo/ordinario vigente;
- sede vacante o administrador apostólico como estado de la jurisdicción;
- población, católicos, parroquias o superficie;
- provincias/municipios civiles cubiertos por cada diócesis;
- límites geográficos o porcentajes de cobertura;
- estructura interna de vicarías, zonas, parroquias o curia.

Esos datos tienen ciclos de actualización distintos y deben conservar sus propios contratos y fuentes.

## Invariantes verificadas

- `jurisdiction_accounts` vigentes: **16** incluyendo Santa Sede.
- `jurisdiction_account_edges` vigentes: **15**.
- coberturas vigentes `DO`: **15**.
- circunscripciones públicas `DO`: **13**.
- Ordinariato Militar visible en `public_dioceses`: **1**.
- fixtures ficticios vigentes: **0**.
- `public_dioceses` conserva `security_invoker = true`.

Cualquier cambio posterior a esta línea base debe preservar trazabilidad, fuente documental, vigencia histórica y separación entre jerarquía canónica y geografía civil.
