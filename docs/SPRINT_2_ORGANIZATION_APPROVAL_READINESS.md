# Sprint 2 — Preparación para aprobar unidades organizativas

Fecha de evaluación: 14 de julio de 2026.

## Objetivo

Clasificar las 181 unidades organizativas vigentes en estado `draft` antes de ejecutar cualquier aprobación, evitando convertir en operativa una jerarquía todavía incompleta o plana.

## Diagnóstico reproducible

Archivo:

`supabase/diagnostics/sprint2_organization_unit_approval_readiness.sql`

El diagnóstico es de solo lectura y comprueba:

- distribución por organigrama;
- cantidad de raíces e hijos por entidad de alcance;
- existencia de una unidad cabecera;
- correspondencia entre áreas pastorales y unidades hijas;
- identidad, slug, organigrama y entidad territorial de alcance.

## Resultado real

Las 181 unidades pertenecen al organigrama `diocesan_pastoral` y se distribuyen entre 12 entidades eclesiásticas.

### Lista para revisión funcional

**Arquidiócesis Metropolitana de Santo Domingo**

- 16 unidades en borrador.
- 1 unidad cabecera.
- 15 unidades hijas asociadas a las 15 áreas pastorales.
- Jerarquía coherente con el patrón esperado para una organización diocesana de pastorales.

Esta clasificación significa que puede pasar a revisión humana y de permisos. No significa que deba aprobarse o publicarse automáticamente.

### Requieren normalización jerárquica

Las otras 11 jurisdicciones presentan el mismo patrón:

- 15 unidades en borrador;
- 15 raíces;
- 0 unidades hijas;
- 0 unidades cabecera;
- 15 áreas pastorales.

Jurisdicciones afectadas:

- Arquidiócesis Metropolitana de Santiago de los Caballeros.
- Diócesis de Baní.
- Diócesis de Barahona.
- Diócesis de La Vega.
- Diócesis de Mao-Monte Cristi.
- Diócesis de Nuestra Señora de la Altagracia en Higüey.
- Diócesis de Puerto Plata.
- Diócesis de San Francisco de Macorís.
- Diócesis de San Juan de la Maguana.
- Diócesis de San Pedro de Macorís.
- Diócesis de Stella Maris.

Estas 165 unidades no deben aprobarse en lote todavía. Primero debe existir una decisión funcional por jurisdicción:

1. Crear una unidad cabecera y mover las 15 áreas debajo de ella; o
2. Confirmar expresamente que el organigrama de esa jurisdicción debe ser plano.

Mientras no exista esa decisión, su estado correcto es `draft` e `internal`.

## Criterio operativo propuesto

Una entidad queda `ready_for_functional_review` cuando:

- tiene exactamente una unidad raíz;
- la raíz es la única unidad sin `pastoral_area_id`;
- todas las unidades con área pastoral tienen padre;
- el número de hijas coincide con el número de áreas pastorales;
- ninguna unidad carece de nombre, slug, organigrama o entidad de alcance.

Una entidad queda `requires_hierarchy_normalization` cuando incumple cualquiera de esos criterios.

## Decisión de seguridad

No se ejecutó ninguna transición de ciclo de vida.

- 181 unidades permanecen en `draft`.
- 181 unidades permanecen con visibilidad `internal`.
- 0 unidades fueron aprobadas.
- 0 unidades fueron publicadas.

## Próximo paso

Realizar una prueba controlada únicamente con la Arquidiócesis Metropolitana de Santo Domingo, usando cuentas reales diferenciadas para edición, aprobación y publicación. La aprobación y la publicación deben verificarse como operaciones independientes y auditadas.
