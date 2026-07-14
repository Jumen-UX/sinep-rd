# Sprint 2 — Piloto de normalización organizativa

Fecha: 14 de julio de 2026.

## Alcance

Se normalizó únicamente la Arquidiócesis Metropolitana de Santiago de los Caballeros dentro del organigrama `diocesan_pastoral`.

La intervención fue deliberadamente acotada para validar el patrón antes de aplicarlo a las diez jurisdicciones restantes con jerarquía plana.

## Estado previo

- 15 unidades pastorales vigentes.
- 15 unidades raíz.
- 0 unidades hijas.
- 0 unidades cabecera.
- Todas en estado `draft`, visibilidad `internal` y `is_current = true`.

## Cambio aplicado

La migración `20260714223000_normalize_santiago_diocesan_pastoral_hierarchy.sql`:

1. Resuelve la jurisdicción por `slug` y el organigrama por `key`.
2. Crea, solo si no existe, la cabecera `Pastorales diocesanas — Arquidiócesis Metropolitana de Santiago de los Caballeros`.
3. Mantiene la cabecera en `draft`, `internal` y vigente.
4. Reasigna como hijas las 15 unidades vinculadas a áreas pastorales.
5. Falla si el resultado no contiene exactamente 15 hijas.

No se aprobaron ni publicaron unidades.

## Validación real

Resultado posterior en Supabase:

- 16 unidades totales.
- 1 raíz.
- 15 hijas.
- 1 cabecera.
- 15 unidades de área pastoral bajo la cabecera.
- 0 ciclos.
- 16 de 16 unidades alcanzables desde la raíz.

El diagnóstico de preparación clasifica ahora como `ready_for_functional_review` a:

- Arquidiócesis Metropolitana de Santo Domingo.
- Arquidiócesis Metropolitana de Santiago de los Caballeros.

Permanecen diez jurisdicciones con `requires_hierarchy_normalization`.

## Decisión

El patrón técnico quedó validado. La siguiente migración podrá generalizarlo a las diez jurisdicciones restantes, manteniendo las mismas precondiciones, sin cambiar estado, visibilidad ni publicación.
