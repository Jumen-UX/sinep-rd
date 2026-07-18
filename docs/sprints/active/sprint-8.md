# Sprint 8 — Rendimiento, indexación y salida mantenible

> Estado: activo
> Inicio: 2026-07-18
> Actualizada: 2026-07-18
> Rama operativa: `main`
> Propietario: rendimiento, indexación, observabilidad y documentación

## Contexto

Sprint 7 completó técnicamente S7-01 a S7-09. S7-10 permanece diferido por decisión operativa y conserva separadas sus validaciones autenticadas, visuales y de cierre.

Sprint 8 avanza únicamente sobre trabajos que no dependen de S7-10. No declara la aplicación lista para producción ni sustituye las validaciones operativas pendientes.

## Objetivo

Preparar una base mantenible para rendimiento público, indexación, búsqueda, observabilidad y documentación técnica, reduciendo consultas repetitivas y haciendo explícitos los contratos de caché, metadata y operación.

## Cola

1. [x] S8-01 — Auditar configuración de Next.js, límites servidor/cliente, metadata, sitemap, robots, caché, búsqueda, monitoreo y documentación.
2. [x] S8-02 — Definir el contrato de renderizado, caché y revalidación por tipo de ruta pública. **Validado con CI verde.**
3. [x] S8-03 — Implementar metadata canónica y Open Graph para páginas públicas principales y fichas. **Validado con CI verde.**
4. [x] S8-04 — Auditar y endurecer sitemap y robots de acuerdo con el estado no público y la futura apertura controlada. **Validado con CI verde.**
5. [x] S8-05 — Consolidar endpoints o servicios agregados para evitar consultas públicas repetitivas. **Validado con CI verde.**
6. [x] S8-06 — Revisar índices de las consultas públicas y administrativas más costosas con evidencia reproducible. **Implementado y aplicado; CI pendiente.**
7. [ ] S8-07 — Diseñar e implementar la primera búsqueda interna canónica.
8. [ ] S8-08 — Incorporar health checks y contrato mínimo de observabilidad sin exponer datos sensibles.
9. [ ] S8-09 — Completar README técnico, manual administrativo y guía operativa de despliegue, migración y restauración.
10. [ ] S8-10 — Validar el alcance técnico propio de Sprint 8 con pruebas contractuales y CI, sin absorber el cierre operativo diferido de S7-10.

## S8-01 a S8-04 — Base técnica validada

- `docs/architecture/RENDERING_CACHE_CONTRACT.md` separa rutas públicas, administrativas y operativas.
- `src/lib/public/metadata.ts` centraliza canonical, Open Graph, Twitter y robots para el portal público.
- `PUBLIC_INDEXING_ENABLED` mantiene cerrado por defecto el rastreo y el sitemap durante la beta interna.
- Las fichas públicas reutilizan cargadores cacheados y las rutas administrativas permanecen dinámicas y sin caché compartida.

## S8-05 — Consultas públicas consolidadas

- `loadPublicDashboardBundle()` eliminó la doble carga de diócesis, personas y universo parroquial en la portada.
- `buildDashboardSummary()` reutiliza los datos ya cargados y conserva una lectura histórica separada de personas para mantener los totales públicos.
- Los directorios no se migraron a filtrado íntegro en memoria porque el volumen y la transferencia deben medirse antes.

## S8-06 — Índices revisados y aplicados

### Evidencia

Se compararon los filtros reales de `public_dioceses`, `public_organization_units`, `person_public_directory` y las relaciones jerárquicas con `pg_indexes` del proyecto Supabase.

Se confirmó que ya existían:

- claves primarias y únicas por `slug`;
- índices individuales de estado, visibilidad, tipo y nombre;
- índices de claves foráneas de personas, entidades, organigramas, unidades y asignaciones;
- índices parciales de asignaciones vigentes y reglas de cardinalidad.

Por ello no se añadieron índices redundantes sobre `persons.display_name`, `status` o `visibility`.

### Migración

`supabase/migrations/20260718160000_optimize_public_query_indexes.sql` incorpora tres índices parciales e idempotentes:

1. `ecclesiastical_entities_public_active_type_name_idx` para entidades públicas activas por tipo y nombre.
2. `entity_relationships_current_active_child_idx` para localizar relaciones jerárquicas vigentes desde la entidad hija.
3. `organization_units_public_current_chart_order_idx` para recorrer unidades públicas vigentes por organigrama y orden visual.

La migración fue aplicada mediante el canal de migraciones de Supabase y los tres índices se verificaron en `pg_indexes`.

`tests/public-query-indexes.test.mjs` protege nombres, columnas, predicados parciales, idempotencia y ausencia de índices globales redundantes.

### Limitación de la evidencia

El volumen actual es todavía reducido y PostgreSQL puede preferir recorridos secuenciales. Los índices se justifican por la forma estable de las consultas y el crecimiento esperado, no por una mejora de latencia concluyente en la muestra actual. S8-10 deberá volver a revisar métricas reales antes de declarar una optimización cuantificada.

## Riesgos y deuda detectados

- Habilitar indexación web sigue siendo una decisión operativa de publicación.
- Un cambio de slug debe invalidar la ruta anterior y la nueva.
- Los directorios requieren medición antes de aplicar caché o agregación compartida.
- No existe todavía una imagen social institucional por defecto.
- Las advertencias documentales sobre metadata y documentos posiblemente huérfanos siguen siendo deuda no bloqueante.

## Reglas

- No introducir caché sobre datos privados o dependientes del alcance administrativo.
- No indexar rutas administrativas, borradores, vistas internas o información privada.
- Toda metadata pública debe derivarse de servicios de dominio y usar fallbacks seguros.
- Sitemap y robots deben respetar el estado real de publicación del producto.
- Los health checks no deben exponer secretos, versiones sensibles, conteos privados ni detalles internos de errores.
- Los cambios de índices deben basarse en consultas reales y migraciones idempotentes.
- La búsqueda debe respetar visibilidad, publicación, privacidad y estado canónico.
- S7-10 continúa diferido y no puede marcarse como completado desde este sprint.

## Criterio del siguiente bloque

Validar S8-06 con CI. Después diseñar la primera búsqueda interna canónica sobre fuentes públicas y administrativas separadas, sin mezclar visibilidad ni alcance.