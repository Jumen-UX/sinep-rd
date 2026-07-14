# Sprint 2 — Resultados de paridad estructural

Fecha de ejecución: 14 de julio de 2026.
Proyecto Supabase: `hrvgpceqaxujlttpimdz`.

## Resumen de modelos

| Modelo | Registros |
|---|---:|
| Entidades eclesiásticas activas | 180 |
| Plantillas estructurales activas | 12 |
| Niveles estructurales | 61 |
| Nodos estructurales activos y vigentes | 173 |
| Organigramas activos | 5 |
| Unidades organizativas activas y vigentes | 0 |
| Unidades organizativas vigentes en borrador | 181 |

## Resultado de controles estructurales

Todos los controles de integridad ejecutados devolvieron cero inconsistencias:

- Plantillas activas sin raíz vigente: 0.
- Nodos con múltiples padres vigentes: 0.
- Edges vigentes entre plantillas distintas: 0.
- Nodos territoriales configurados sin entidad enlazada: 0.
- Entidades duplicadas en varios nodos del mismo catálogo: 0.
- Entidades esperadas sin nodo vigente: 0.
- Unidades vigentes sin organigrama: 0.
- Unidades vigentes con organigrama inactivo: 0.
- Padres organizativos de otro organigrama: 0.
- Unidades vigentes sin entidad territorial de alcance: 0.
- Nombramientos cuyo organigrama no coincide con el cargo: 0.
- Nombramientos cuya unidad pertenece a otro organigrama: 0.

## Clasificación

### Válido

- La jerarquía territorial actual presenta paridad estructural completa en los controles ejecutados.
- Las 181 unidades organizativas vigentes conservan organigrama, padre y alcance compatibles.
- No existen conflictos actuales entre nombramientos, cargos, organigramas y unidades.

### Migrable / operativo

- Las 181 unidades organizativas vigentes están en estado `draft`.
- Este estado no representa corrupción estructural, pero impide que las consultas limitadas a `status = 'active'` las consideren operativas o públicas.
- S2-04 debe definir el flujo de aprobación/publicación y determinar cuáles unidades pueden promoverse a `active` sin publicación automática indebida.

### Bloqueante

- No se detectaron discrepancias bloqueantes en las consultas ejecutadas.

## Corrección realizada durante la ejecución

La primera versión del diagnóstico usaba una columna `ecclesiastical_entities.diocese_id` que no existe en el esquema canónico. Se corrigió la consulta para derivar la expectativa territorial desde los tipos enlazados a niveles estructurales, manteniendo la pertenencia diocesana dentro del motor de estructuras.

## Diagnósticos reproducibles

- `supabase/diagnostics/sprint2_structural_parity.sql`
- `supabase/diagnostics/sprint2_organization_unit_lifecycle_parity.sql`

## Decisión de avance

S2-02 queda completado. S2-03 puede comenzar sin migraciones correctivas previas. La única condición operativa trasladada es resolver el ciclo de vida `draft → active` de las unidades organizativas durante S2-04.
