# Sprint 8 — Rendimiento, indexación y salida mantenible

> Estado: activo
> Inicio: 2026-07-18
> Actualizada: 2026-07-20
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
6. [x] S8-06 — Revisar índices de las consultas públicas y administrativas más costosas con evidencia reproducible. **Validado con CI verde y aplicado en Supabase.**
7. [x] S8-07 — Diseñar e implementar la primera búsqueda interna canónica. **Implementación e integración principal validadas con CI verde.**
8. [ ] S8-08 — Incorporar health checks y contrato mínimo de observabilidad sin exponer datos sensibles.
9. [ ] S8-09 — Completar README técnico, manual administrativo y guía operativa de despliegue, migración y restauración.
10. [ ] S8-10 — Validar el alcance técnico propio de Sprint 8 con pruebas contractuales y CI, sin absorber el cierre operativo diferido de S7-10.

## S8-01 a S8-04 — Base técnica validada

- `next.config.ts` no declara todavía políticas globales de rendimiento; no se modificará sin evidencia concreta.
- `docs/architecture/RENDERING_CACHE_CONTRACT.md` separa rutas públicas, administrativas y operativas.
- `src/lib/public/metadata.ts` centraliza canonical, Open Graph, Twitter y robots para el portal público.
- `PUBLIC_INDEXING_ENABLED` mantiene cerrado por defecto el rastreo y el sitemap durante la beta interna.
- Las fichas públicas reutilizan cargadores cacheados y las rutas administrativas permanecen dinámicas y sin caché compartida.

## S8-05 — Consultas públicas consolidadas

- `loadPublicDashboardBundle()` eliminó la doble carga de diócesis, personas y universo parroquial en la portada.
- `buildDashboardSummary()` reutiliza los datos ya cargados y conserva una lectura histórica separada de personas para mantener los totales públicos.
- Los directorios no se migraron a filtrado íntegro en memoria porque el volumen y la transferencia deben medirse antes.

## S8-06 — Índices revisados y aplicados

Se compararon los filtros reales de `public_dioceses`, `public_organization_units`, `person_public_directory` y relaciones jerárquicas con `pg_indexes`.

`supabase/migrations/20260718160000_optimize_public_query_indexes.sql` incorpora tres índices parciales e idempotentes:

1. `ecclesiastical_entities_public_active_type_name_idx`.
2. `entity_relationships_current_active_child_idx`.
3. `organization_units_public_current_chart_order_idx`.

La migración fue aplicada en Supabase y verificada en `pg_indexes`. No se añadieron índices redundantes sobre `persons.display_name`, `status` o `visibility`. El volumen actual todavía no permite afirmar una mejora cuantificada de latencia.

## S8-07 — Búsqueda administrativa canónica

Hallazgo: la búsqueda principal del dashboard solo redirigía al directorio de personas y no representaba una búsqueda transversal del portal.

Implementación:

- `supabase/migrations/20260718234000_create_canonical_admin_search.sql` crea `app_private.admin_search_catalog()` y la fachada invocadora `public.admin_search_catalog()`.
- La función privada exige autenticación, término mínimo de dos caracteres y límite máximo de 60 resultados.
- Personas reutilizan `app_private.admin_list_people()`, preservando `people.view` y alcance existentes.
- Entidades exigen `entities.view` y comprobación de alcance mediante `current_user_can()`.
- Unidades organizativas exigen `pastorals.view` y comprobación de alcance territorial u organizativo.
- La implementación privada no es ejecutable por clientes; la fachada pública se concede únicamente a `authenticated`.
- `src/app/api/admin/search/route.ts` valida acceso administrativo, longitud y límite, y no expone errores internos.
- `/admin/buscar` presenta resultados tipados con destinos administrativos explícitos y solicitudes `no-store`.
- El encabezado del dashboard dirige ahora a `/admin/buscar` y solo muestra la entrada cuando el perfil puede consultar al menos uno de los tres dominios.
- El campo principal exige dos caracteres, limita a 120 y describe correctamente personas, entidades y unidades organizativas.
- `tests/admin-canonical-search.test.mjs` protege permisos, alcance, separación de dominios, límites, accesibilidad básica e integración del dashboard.

La migración fue aplicada correctamente en Supabase. La primera versión no incluye documentos, eventos ni importaciones; esos dominios requieren contratos de permisos y destinos propios antes de incorporarse.

La integración del dashboard y sus contratos quedaron confirmados por [CI #29761638740](https://github.com/Jumen-UX/sinep-rd/actions/runs/29761638740) sobre `b8b72fa`.

## Pendientes operativos de beta

Estos controles permanecen separados del cierre técnico de S8-07 y del trabajo de S8-08:

- S7-10: matriz autenticada, aislamiento entre diócesis, revisión visual y accesibilidad administrativa.
- S3-06: validación con URL autorizada y cuentas reales diferenciadas.
- Protección contra contraseñas filtradas en Supabase Auth.
- Copia de seguridad, restauración documentada y responsables de incidentes.
- Validación institucional y jurídica previa a una apertura pública.

Ninguno debe marcarse como completado mediante pruebas contractuales o CI sin la evidencia operativa correspondiente.

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

Iniciar S8-08 y endurecer el contrato mínimo de observabilidad y health checks sin exponer secretos, versiones sensibles, datos privados ni trazas internas.
