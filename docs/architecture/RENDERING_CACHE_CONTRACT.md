# Contrato de renderizado, caché y revalidación

> Estado: activo
> Actualizada: 2026-07-18
> Propietario: arquitectura web y rendimiento

## Objetivo

Definir cómo se renderizan, almacenan en caché, revalidan e invalidan las rutas de SINEP RD sin mezclar datos públicos con información autenticada o dependiente del alcance administrativo.

## Principios obligatorios

1. Los datos privados, administrativos, personalizados o dependientes de cookies, sesión, rol o alcance no se comparten mediante caché global.
2. Solo se cachean datos cuya visibilidad pública esté determinada por contratos de dominio y políticas de publicación.
3. La revalidación temporal no sustituye la invalidación explícita después de una mutación administrativa.
4. Metadata, contenido HTML y datos estructurados de una misma ficha deben usar el mismo cargador canónico para evitar consultas y resultados divergentes.
5. Ninguna optimización puede ampliar visibilidad, saltar RLS ni exponer errores internos.

## Clases de ruta

### P0 — Públicas estables

Ejemplos: páginas legales, contenido institucional estático y páginas sin datos personalizados.

- Renderizado preferido: estático.
- Caché: propia del framework y CDN.
- Revalidación: solo cuando cambie el contenido o durante el despliegue.
- Prohibido: acceder a cookies o sesión para variar el contenido cacheado.

### P1 — Públicas publicadas y revalidables

Ejemplos: fichas públicas de personas y entidades, directorios y resúmenes públicos.

- Renderizado preferido: servidor con revalidación incremental.
- Caché de datos: `unstable_cache` o mecanismo estable equivalente, con clave versionada y etiquetas por dominio.
- Deduplificación por solicitud: `cache()` cuando metadata y página consuman el mismo cargador.
- Revalidación temporal inicial: 900 segundos para fichas, revisable con evidencia.
- Invalidación: `revalidateTag` y `revalidatePath` después de crear, editar, publicar, retirar o cambiar el slug de contenido público.
- El cargador solo devuelve registros publicables y campos permitidos públicamente.

### P2 — Públicas sensibles al tiempo

Ejemplos futuros: avisos o eventos públicos cuya vigencia cambie con frecuencia.

- Renderizado: servidor o revalidación corta según el contrato funcional.
- La caducidad debe derivarse de la necesidad real, no de un valor arbitrario.
- Si el dato cambia mediante una operación administrativa, debe existir invalidación explícita.

### A0 — Administrativas autenticadas

Incluye `/admin`, sus layouts, páginas y servicios dependientes de sesión, rol o alcance.

- Renderizado: dinámico.
- Caché compartida: prohibida.
- Configuración esperada: `dynamic = 'force-dynamic'`, `revalidate = 0` o contrato equivalente donde corresponda.
- Las consultas deben ejecutarse con la sesión y RLS vigentes.
- Puede existir memoización local a una solicitud, pero nunca reutilización entre usuarios o alcances.

### API-A — APIs administrativas y mutaciones

- Caché HTTP compartida: prohibida.
- Las respuestas deben declarar semántica no almacenable cuando exista riesgo de intermediarios.
- Después de una mutación que afecte contenido público, el servicio debe invocar la invalidación pública canónica.
- Los errores no exponen SQL, tokens, variables de entorno ni trazas internas.

### O0 — Operación y salud

- Los health checks no incluyen datos privados, conteos internos ni detalles de infraestructura sensible.
- No se cachean respuestas que deban representar disponibilidad actual.
- La observabilidad debe diferenciar errores de datos, dependencias y aplicación sin devolver detalles al cliente.

## Estado actual confirmado

- `src/lib/public/cache.ts` cachea fichas públicas de personas y entidades durante 900 segundos.
- Las claves están versionadas y separadas por dominio.
- Las fichas usan etiquetas de invalidación y `revalidatePath` para inicio, directorios y detalles.
- Las páginas `/personas/[slug]` y `/entidades/[slug]` declaran `revalidate = 900`.
- Sus layouts de metadata reutilizan el mismo cargador cacheado que la página.
- El layout administrativo raíz fuerza renderizado dinámico, sin revalidación ni caché compartida.
- `next.config.ts` continúa sin políticas explícitas y no debe modificarse hasta justificar cada opción.
- No existen todavía `sitemap.ts` ni `robots.ts` canónicos.

## Riesgos detectados

1. Las etiquetas actuales invalidan todas las fichas de un dominio; posteriormente puede añadirse una etiqueta por slug si la evidencia muestra necesidad.
2. Los directorios públicos deben auditarse antes de aplicarles caché, porque pueden combinar filtros y consultas distintas.
3. Un cambio de slug debe invalidar tanto la ruta anterior como la nueva.
4. La metadata raíz no declara todavía `metadataBase`, canonical global, Open Graph común ni política global de robots.
5. La ausencia de sitemap y robots impide representar formalmente el estado no público y la futura apertura controlada.

## Criterio de implementación

Antes de cachear una ruta se debe registrar:

- clase de ruta;
- fuente de datos;
- condición de visibilidad;
- duración o razón para no usar duración;
- etiquetas de caché;
- mutaciones que la invalidan;
- rutas que deben revalidarse;
- prueba contractual correspondiente.

## Siguiente paso

Auditar las rutas públicas principales y asignarlas a P0, P1 o P2. Después implementar metadata compartida, robots y sitemap conforme al estado real de publicación, sin indexar rutas administrativas ni contenido no publicado.
