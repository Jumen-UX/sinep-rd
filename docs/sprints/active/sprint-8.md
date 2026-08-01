# Sprint 8 — Rendimiento, indexación y salida mantenible

> Estado: completado
> Alcance técnico: completado
> Validación operativa propia: completada
> Inicio: 2026-07-18
> Actualizada: 2026-08-01
> Cierre: 2026-08-01
> Rama operativa: `main`
> Propietario: rendimiento, indexación, observabilidad y documentación

## Contexto

Sprint 8 avanzó sobre rendimiento, indexación, búsqueda, observabilidad y documentación sin introducir caché sobre datos privados o dependientes del alcance administrativo.

Sprint 7, incluida S7-10, quedó completado el 2026-07-31 con evidencia autenticada, visual, de accesibilidad y de ciclo de cuentas QA. Sprint 8 queda como referencia técnica cerrada; la preparación operativa de beta continúa en Sprint 9.

## Resultado

1. [x] S8-01 — Auditoría de Next.js, límites servidor/cliente, metadata, sitemap, robots, caché, búsqueda, monitoreo y documentación.
2. [x] S8-02 — Contrato de renderizado, caché y revalidación por tipo de ruta pública.
3. [x] S8-03 — Metadata canónica, Open Graph y Twitter para páginas y fichas públicas.
4. [x] S8-04 — Sitemap y robots endurecidos para beta privada y apertura controlada.
5. [x] S8-05 — Servicios agregados para reducir consultas públicas repetitivas.
6. [x] S8-06 — Índices revisados y aplicados con migraciones idempotentes.
7. [x] S8-07 — Primera búsqueda administrativa canónica.
8. [x] S8-08 — Health checks y contrato mínimo de observabilidad.
9. [x] S8-09 — README, manual administrativo y guía operativa.
10. [x] S8-10 — Validación técnica integral mediante contratos y CI.

## Contratos consolidados

- Next.js sirve imágenes en AVIF/WebP y limita los orígenes remotos autorizados a Supabase Storage y placeholders aprobados.
- La indexación pública exige simultáneamente `PUBLIC_INDEXING_ENABLED=true` y `PUBLIC_LAUNCH_APPROVED=true`.
- Metadata, robots y sitemap permanecen cerrados durante la beta privada.
- Las fichas públicas usan servicios de dominio y caché controlada; las rutas administrativas permanecen dinámicas y sin caché compartida.
- `loadPublicDashboardBundle()` y su variante territorial reducen cargas repetitivas y payload inicial.
- La búsqueda administrativa canónica respeta permisos y alcance para personas, entidades y unidades organizativas.
- `/api/health` diferencia disponibilidad de aplicación y base de datos sin exponer detalles sensibles.
- La documentación operativa cubre despliegue, migración, restauración, observabilidad y correlación mediante `request_id`.


## Evidencia técnica canónica

- [Contrato de renderizado y caché](../../architecture/RENDERING_CACHE_CONTRACT.md).
- [Contrato de observabilidad](../../architecture/OBSERVABILITY_CONTRACT.md).
- `20260718160000_optimize_public_query_indexes.sql`.
- `20260718234000_create_canonical_admin_search.sql`.
- `loadPublicDashboardBundle()` y servicios territoriales agregados.
- Compuertas `PUBLIC_INDEXING_ENABLED` y `PUBLIC_LAUNCH_APPROVED`.

Los cambios posteriores sobre estos contratos requieren una nueva evidencia CI/E2E aplicable; la evidencia de cierre de Sprint 8 no valida modificaciones futuras.

## Seguridad y rendimiento posteriores

- `sharp` quedó actualizado y fijado en `0.35.3` mediante override raíz y lockfile validado.
- La alerta Dependabot heredada de `libvips` quedó cerrada.
- El caché incremental de `.next/cache` acelera builds sin reutilizar artefactos completos de producción.
- CodeQL y contratos preventivos protegen expresiones regulares, workflows, rutas, documentación y límites de despliegue.

## Pendientes operativos de beta y lanzamiento

No forman parte del cierre técnico de Sprint 8:

- completar S3-06 con URL autorizada y cuentas reales diferenciadas;
- verificar respaldo y ejecutar restauración documentada;
- definir canal, severidad y responsables de incidentes;
- validar institucional y jurídicamente privacidad, cookies y aviso legal;
- confirmar metadata `noindex`, robots restrictivo y sitemap vacío en la beta desplegada;
- revisar la aceptación temporal del riesgo de contraseñas filtradas antes del 2026-10-29 o antes de abrir al público.

## Riesgos y deuda controlada

- Habilitar indexación es una decisión operativa e institucional.
- Los cambios de slug deben invalidar rutas anterior y nueva.
- Los directorios requieren medición antes de ampliar caché o agregación compartida.
- Falta una imagen social institucional por defecto.
- Ningún dato privado o dependiente del alcance puede usar caché pública.

## Cierre técnico

S8-01 a S8-10 están completados técnica y documentalmente. Los pendientes operativos fueron trasladados a Sprint 9 sin declararlos resueltos.