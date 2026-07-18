# Sprint 8 — Rendimiento, indexación y salida mantenible

> Estado: activo
> Inicio: 2026-07-18
> Rama operativa: `main`
> Propietario: rendimiento, indexación, observabilidad y documentación

## Contexto

Sprint 7 completó técnicamente S7-01 a S7-09. S7-10 permanece diferido por decisión operativa y conserva separadas sus validaciones autenticadas, visuales y de cierre.

Sprint 8 avanza únicamente sobre trabajos que no dependen de S7-10. No declara la aplicación lista para producción ni sustituye las validaciones operativas pendientes.

## Objetivo

Preparar una base mantenible para rendimiento público, indexación, búsqueda, observabilidad y documentación técnica, reduciendo consultas repetitivas y haciendo explícitos los contratos de caché, metadata y operación.

## Cola

1. [ ] S8-01 — Auditar configuración de Next.js, límites servidor/cliente, metadata, sitemap, robots, caché, búsqueda, monitoreo y documentación.
2. [ ] S8-02 — Definir el contrato de renderizado, caché y revalidación por tipo de ruta pública.
3. [ ] S8-03 — Implementar metadata canónica y Open Graph para páginas públicas principales y fichas.
4. [ ] S8-04 — Implementar sitemap y robots coherentes con el estado no público y la futura apertura controlada.
5. [ ] S8-05 — Consolidar endpoints o servicios agregados para evitar consultas públicas repetitivas.
6. [ ] S8-06 — Revisar índices de las consultas públicas y administrativas más costosas con evidencia reproducible.
7. [ ] S8-07 — Diseñar e implementar la primera búsqueda interna canónica.
8. [ ] S8-08 — Incorporar health checks y contrato mínimo de observabilidad sin exponer datos sensibles.
9. [ ] S8-09 — Completar README técnico, manual administrativo y guía operativa de despliegue, migración y restauración.
10. [ ] S8-10 — Validar el alcance técnico propio de Sprint 8 con pruebas contractuales y CI, sin absorber el cierre operativo diferido de S7-10.

## S8-01 — Inventario inicial

Hallazgos confirmados al inicio:

- `next.config.ts` no declara todavía políticas de imágenes, cabeceras, redirecciones, límites o configuración de rendimiento.
- El README contiene instrucciones útiles de desarrollo y calidad, pero su estado de producto y sprint activo están desactualizados.
- La hoja de ruta vigente todavía describe S7-06 como frente activo, aunque S7-01 a S7-09 ya fueron completados.
- No se encontraron contratos canónicos activos para sitemap, robots, estrategia de revalidación, health checks o búsqueda interna.
- S7-10, la matriz E2E autenticada, la revisión visual administrativa, la protección contra contraseñas filtradas y las pruebas operativas permanecen fuera del alcance inmediato.

## Reglas

- No introducir caché sobre datos privados o dependientes del alcance administrativo.
- No indexar rutas administrativas, borradores, vistas internas o información privada.
- Toda metadata pública debe derivarse de servicios de dominio y usar fallbacks seguros.
- Sitemap y robots deben respetar el estado real de publicación del producto.
- Los health checks no deben exponer secretos, versiones sensibles, conteos privados ni detalles internos de errores.
- Los cambios de índices deben basarse en consultas reales y migraciones idempotentes.
- La búsqueda debe respetar visibilidad, publicación, privacidad y estado canónico.
- S7-10 continúa diferido y no puede marcarse como completado desde este sprint.

## Criterio del primer bloque

Reconciliar la documentación canónica con el estado actual y proteger mediante pruebas que Sprint 8 sea el frente activo, mientras S7-10 permanezca explícitamente diferido. Después, definir el contrato de renderizado, caché y revalidación antes de implementar optimizaciones.