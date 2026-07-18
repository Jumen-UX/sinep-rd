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
4. [x] S8-04 — Auditar y endurecer sitemap y robots de acuerdo con el estado no público y la futura apertura controlada. **Implementado; CI pendiente.**
5. [ ] S8-05 — Consolidar endpoints o servicios agregados para evitar consultas públicas repetitivas.
6. [ ] S8-06 — Revisar índices de las consultas públicas y administrativas más costosas con evidencia reproducible.
7. [ ] S8-07 — Diseñar e implementar la primera búsqueda interna canónica.
8. [ ] S8-08 — Incorporar health checks y contrato mínimo de observabilidad sin exponer datos sensibles.
9. [ ] S8-09 — Completar README técnico, manual administrativo y guía operativa de despliegue, migración y restauración.
10. [ ] S8-10 — Validar el alcance técnico propio de Sprint 8 con pruebas contractuales y CI, sin absorber el cierre operativo diferido de S7-10.

## S8-01 — Inventario completado

- `next.config.ts` no declara todavía políticas globales de rendimiento; no se modificará sin evidencia concreta.
- El README, la hoja de ruta y el manifiesto reconocen Sprint 8 como único sprint activo y Sprint 7 como diferido.
- Las fichas públicas ya cuentan con caché versionada, etiquetas, deduplicación por solicitud e invalidación explícita.
- El layout administrativo fuerza renderizado dinámico y ausencia de caché compartida.
- Sitemap, robots y health checks existían parcialmente y requieren contratos explícitos, no reimplementación indiscriminada.

## S8-02 — Contrato validado

`docs/architecture/RENDERING_CACHE_CONTRACT.md` clasifica rutas públicas, administrativas y operativas; prohíbe compartir datos dependientes de sesión o alcance; exige invalidación explícita y evita cambios globales sin evidencia.

## S8-03 — Metadata pública validada

- `src/lib/public/metadata.ts` centraliza metadata pública, canonical, Open Graph, Twitter y robots.
- El grupo `(public)` tiene `metadataBase` e identidad de sitio propias.
- Inicio, directorios y fichas dinámicas usan el mismo constructor.
- Las fichas inexistentes quedan fuera de índices.
- Metadata y HTML reutilizan los mismos cargadores cacheados.

## S8-04 — Indexación pública controlada

Hallazgo: `robots.ts` permitía rastrear el portal y `sitemap.ts` exponía rutas estáticas y fichas públicas en cualquier despliegue accesible, aunque el producto aún no está aprobado para apertura pública.

Implementación:

- `src/lib/public/indexing.ts` define una compuerta servidor `PUBLIC_INDEXING_ENABLED`.
- La compuerta es cerrada por defecto; solo acepta valores positivos explícitos.
- Con indexación desactivada, `robots.txt` devuelve `Disallow: /` para todos los agentes.
- Con indexación desactivada, el sitemap devuelve una lista vacía y no consulta Supabase.
- Con indexación activada, robots permite el portal pero mantiene bloqueados `/admin/` y `/api/`.
- Con indexación activada, el sitemap incluye únicamente rutas públicas estáticas, personas del directorio público y entidades activas con visibilidad pública.
- `.env.example` documenta `PUBLIC_INDEXING_ENABLED=false` y exige aprobación de apertura antes de habilitarlo.
- `tests/public-sitemap-contract.test.mjs` protege ambos modos y la degradación segura cuando Supabase no está disponible.

## Riesgos y deuda detectados

- Habilitar indexación es una decisión operativa de publicación; no debe activarse en previews ni entornos internos.
- Un cambio de slug debe invalidar la ruta anterior y la nueva.
- Los directorios públicos requieren auditoría propia antes de aplicar caché compartida.
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

Validar S8-04 con CI. Después auditar las consultas públicas repetitivas y consolidar únicamente aquellas cuya duplicación esté demostrada.
