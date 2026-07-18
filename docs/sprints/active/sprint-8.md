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
2. [x] S8-02 — Definir el contrato de renderizado, caché y revalidación por tipo de ruta pública. **Implementado; CI pendiente.**
3. [ ] S8-03 — Implementar metadata canónica y Open Graph para páginas públicas principales y fichas.
4. [ ] S8-04 — Implementar sitemap y robots coherentes con el estado no público y la futura apertura controlada.
5. [ ] S8-05 — Consolidar endpoints o servicios agregados para evitar consultas públicas repetitivas.
6. [ ] S8-06 — Revisar índices de las consultas públicas y administrativas más costosas con evidencia reproducible.
7. [ ] S8-07 — Diseñar e implementar la primera búsqueda interna canónica.
8. [ ] S8-08 — Incorporar health checks y contrato mínimo de observabilidad sin exponer datos sensibles.
9. [ ] S8-09 — Completar README técnico, manual administrativo y guía operativa de despliegue, migración y restauración.
10. [ ] S8-10 — Validar el alcance técnico propio de Sprint 8 con pruebas contractuales y CI, sin absorber el cierre operativo diferido de S7-10.

## S8-01 — Inventario completado

Hallazgos confirmados:

- `next.config.ts` no declara todavía políticas de imágenes, cabeceras, redirecciones, límites o configuración de rendimiento.
- El README, la hoja de ruta y el manifiesto documental quedaron reconciliados para reconocer Sprint 8 como único sprint activo y Sprint 7 como diferido.
- `src/lib/public/cache.ts` ya contiene una base canónica para fichas públicas de personas y entidades con `unstable_cache`, claves versionadas, etiquetas por dominio, deduplicación por solicitud e invalidación explícita.
- Las páginas `/personas/[slug]` y `/entidades/[slug]` declaran `revalidate = 900` y sus layouts de metadata reutilizan el mismo cargador cacheado.
- El layout administrativo fuerza renderizado dinámico, revalidación cero y ausencia de caché compartida.
- La metadata raíz solo declara título y descripción; no contiene todavía `metadataBase`, canonical global ni Open Graph común.
- No existen `sitemap.ts` ni `robots.ts` canónicos.
- No existe todavía un contrato mínimo de health checks ni una búsqueda interna canónica.
- S7-10, la matriz E2E autenticada, la revisión visual administrativa, la protección contra contraseñas filtradas y las pruebas operativas permanecen fuera del alcance inmediato.

## S8-02 — Contrato implementado

Se creó `docs/architecture/RENDERING_CACHE_CONTRACT.md` como fuente canónica para:

- clasificar rutas públicas estables, públicas revalidables, públicas sensibles al tiempo, administrativas, APIs administrativas y operación;
- prohibir caché global sobre datos privados, personalizados o dependientes de sesión, rol o alcance;
- exigir que metadata y HTML compartan cargadores canónicos;
- mantener 900 segundos como política inicial de fichas públicas, acompañada de invalidación explícita;
- documentar etiquetas, rutas afectadas, mutaciones invalidantes y condición de visibilidad antes de cachear una ruta;
- evitar cambios indiscriminados en `next.config.ts` sin evidencia y contrato.

## Riesgos y deuda detectados

- Las etiquetas actuales invalidan todas las fichas del dominio; la granularidad por slug se evaluará solo si existe evidencia de costo.
- Un cambio de slug debe invalidar la ruta anterior y la nueva.
- Los directorios públicos aún requieren auditoría propia antes de aplicar caché.
- Sitemap y robots deben representar el estado real no público antes de cualquier apertura.
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

Validar S8-01 y S8-02 con CI. Después implementar metadata canónica y Open Graph compartidos, sin mezclar todavía sitemap y robots para conservar bloques pequeños y verificables.
