# Contrato de rendimiento web — fase 1

> Estado: activo
> Última revisión: 2026-07-29
> Rama operativa: `main`

## Objetivo

Este contrato fija los límites preventivos de rendimiento para el portal público y el área administrativa de SINEP RD. No sustituye las mediciones de campo de Core Web Vitals ni permite declarar un despliegue validado sin evidencia de Vercel y GitHub Actions.

## Core Web Vitals

Los objetivos se mantienen en `config/web-performance-budgets.json`:

- LCP menor o igual a 2,500 ms.
- INP menor o igual a 200 ms.
- CLS menor o igual a 0.1.

Estos valores son presupuestos de producto. La aceptación requiere datos de campo o una ejecución reproducible sobre una URL desplegada. Un build exitoso no demuestra por sí mismo el cumplimiento de Core Web Vitals.

## Presupuesto de JavaScript

Después de `next build`, `scripts/audit-next-bundles.mjs` lee `.next/app-build-manifest.json`, comprime cada chunk con gzip y valida:

- rutas públicas iniciales;
- fichas públicas dinámicas de personas, entidades, pastoral, oficinas, organismos, provincias eclesiásticas, lugares e instituciones;
- entrada administrativa;
- tamaño máximo de un chunk individual.

`pnpm check` ejecuta esta auditoría después del build. Un exceso de presupuesto o una ruta configurada ausente hace fallar el contrato.

## CSS por ruta

- `public-dashboard.css`, `public-territorial.css` y `public-combobox.css` pertenecen exclusivamente al portal principal y se importan desde `src/app/(public)/page.tsx`.
- El layout raíz no debe volver a importar esos tres archivos, porque hacerlo envía reglas del dashboard a directorios, fichas, páginas legales y administración.
- `admin-brand.css` se carga desde `src/app/(admin)/layout.tsx`; no forma parte del CSS común de las páginas públicas.
- Las tres reglas públicas que estaban mezcladas en `admin-brand.css` se preservan en `public-brand-overrides.css` para no alterar las fichas de oficinas, pastoral, organismos y provincias eclesiásticas.
- `scripts/audit-web-performance.mjs` y `tests/public-dashboard-css-boundary.test.mjs` protegen estas fronteras fuente.
- La reducción efectiva de hojas y bytes debe medirse en un build desplegado. El auditor de bundles vigente controla JavaScript mediante `app-build-manifest.json`; no se declarará un presupuesto CSS numérico hasta implementar una lectura reproducible de los manifiestos CSS de Next.js.

## Límite servidor/cliente

- El `RootLayout` no debe hidratar mejoras específicas del portal público.
- Los componentes cliente públicos deben existir solo cuando gestionen interacción real.
- Se prohíben `MutationObserver` y `setInterval` como mecanismo de sincronización general del DOM público.
- Las transformaciones de presentación deben realizarse en React, en el servicio de dominio o durante el renderizado del servidor.
- `/entidades/[slug]`, `/pastoral/[slug]`, `/oficinas/[id]`, `/organismos/[id]` y `/provincias-eclesiasticas/[slug]` se renderizan en servidor y no consultan sus propias rutas `/api/*` después de hidratar.
- La navegación anclada, la cronología institucional y el organigrama dinámico de `/entidades/[slug]` son componentes de servidor; no requieren estado, efectos ni eventos del navegador.
- El antiguo `EntityDetailPage.tsx` y el adaptador `/api/entidades/[slug]` fueron retirados. La ficha canónica usa `loadPublicEntityDetail()` y `EntityDetailServerView`.
- El portal principal usa `PublicDashboardShell` para cabecera, sidebar, accesos, controles de apariencia y navegación móvil renderizados en servidor.
- `PublicDashboardExplorer` conserva exclusivamente el modelo interactivo de ámbito, filtros y selección de vistas mediante `usePublicDashboardModel()`.
- `PublicTerritorialView` permanece en el grafo inicial porque es la vista predeterminada.
- `PublicPeopleView`, `PublicPastoralView`, `PublicAdministrativeView` y `PublicCollegialView` se cargan mediante `React.lazy`, cada una desde su propio módulo y dentro de un límite `Suspense`; no se usa `next/dynamic` ni se desactiva SSR.
- Los fallbacks de las vistas diferidas mantienen `tabpanel`, `aria-busy`, `role="status"` y `aria-live="polite"`; su CSS Module reserva altura responsive para reducir CLS.
- Los parámetros `vista`, `pais`, `provincia` y `jurisdiccion` se validan contra el bundle público durante el renderizado de servidor.
- Los cambios posteriores de vista y ámbito se reflejan con `history.replaceState` mediante `PublicDashboardUrlState`, sin `router.replace`, sin nueva navegación de servidor y sin solicitudes adicionales al dashboard.
- Los filtros internos de tipo de persona y nivel pastoral permanecen locales para evitar URLs excesivamente volátiles y trabajo de navegación innecesario.
- Las colecciones derivadas de personas y unidades organizativas se memoizan; la clasificación administrativa/colegial se ejecuta en una sola pasada por cambio del dataset.
- El footer del shell público usa una descripción neutral de cobertura internacional; no debe mostrar un país fijo porque el ámbito puede cambiar sin volver a renderizar el shell.
- `ThemeControl` y `PublicDashboardThemeControl` comparten `useThemePreference`, pero mantienen presentaciones separadas. Esto evita que las fichas públicas dependan del chunk de presentación del dashboard.
- Los antiguos `PublicDashboardClient.tsx`, `PublicPeoplePastoralViews.tsx` y `PublicOrganizationViews.tsx` fueron retirados para impedir que el shell o vistas no seleccionadas vuelvan al grafo cliente inicial.
- `scripts/audit-web-performance.mjs` bloquea regresiones en SSR, shell/explorador, `React.lazy`, `Suspense`, URL compartible, memoización, control de tema, CSS por ruta e imágenes sociales.

Las rutas API públicas equivalentes solo deben mantenerse cuando exista un consumidor explícito distinto del render inicial. No se deben conservar adaptadores sin consumidores por compatibilidad hipotética.

## Fuentes

La tipografía principal se carga mediante `next/font` con `display: swap` y variable CSS. No se debe reintroducir una hoja externa de Google Fonts ni una dependencia de fuentes cargada desde el navegador.

## Imágenes

- `next.config.ts` permite imágenes remotas de Supabase Storage y formatos AVIF/WebP.
- `placehold.co` está autorizado únicamente como proveedor explícito de imágenes ficticias para los datos QA vigentes.
- Como `placehold.co` entrega SVG por defecto, `normalizePersonPhotoSource()` añade el formato `/png` cuando el placeholder no declara un formato raster. No se habilita `dangerouslyAllowSVG`.
- La normalización reside en `src/features/personas/person-photo-source.ts` y se reutiliza tanto en `PersonPhoto.tsx` como en `generateMetadata()` de las fichas de personas.
- Open Graph y Twitter no deben publicar una URL SVG implícita cuando la fotografía renderizada utiliza una fuente raster normalizada.
- Las imágenes de contenido deben usar `next/image`, dimensiones estables y `sizes` cuando sean responsivas.
- La fotografía pública prioriza la carga por estar en la cabecera de la ficha y declara un ancho responsivo máximo de 320 píxeles.
- La fotografía administrativa conserva el avatar de 96 por 96 píxeles y su tratamiento decorativo.
- La auditoría fuente bloquea cualquier uso de `<img>` dentro de `src`; ya no existen excepciones heredadas.

## Instalación de optimización de imágenes

El proyecto fija `pnpm@10.18.3`. Para esa versión, `pnpm-workspace.yaml` declara `sharp` mediante `onlyBuiltDependencies`; `allowBuilds` no corresponde a la versión fijada.

Vercel continúa mostrando la advertencia `Ignored build scripts: sharp` al restaurar un caché de dependencias previo y omitir la reinstalación. Los builds y el optimizador de imágenes administrado por Vercel siguen operativos. La advertencia no se considera cerrada hasta ejecutar una instalación limpia o cambiar deliberadamente la estrategia de dependencias con evidencia reproducible.

## Caché pública

Las lecturas agregadas del dashboard público usan `unstable_cache` con:

- TTL de respaldo de 300 segundos;
- etiquetas separadas para dashboard, directorios y registro eclesial;
- invalidación por etiqueta y ruta.

Las fichas públicas de personas, entidades, unidades organizativas, oficinas, organismos colegiales y provincias eclesiásticas comparten la etiqueta `public:directories`, aunque conservan un TTL de respaldo de 900 segundos. Esto evita que una mutación invalide el dashboard pero deje una ficha dinámica con datos anteriores.

Las rutas administrativas y los datos dependientes del usuario no usan caché compartida.

## Invalidación

`POST /api/admin/public-cache` exige:

1. usuario autenticado;
2. rol administrativo confirmado por Supabase;
3. ámbito de invalidación permitido.

Las operaciones de creación, edición y cierre de relaciones del registro eclesial solicitan invalidación del ámbito `registry`. Si la invalidación falla, la mutación permanece válida y el TTL limita la obsolescencia a cinco minutos; el cliente registra una advertencia sin exponer datos sensibles.

Las mutaciones administrativas de personas, nombramientos, entidades, jurisdicciones, países, nodos estructurales y unidades organizativas reutilizan `revalidatePublicContent()`, que delega en el ámbito consolidado `directories` y permite invalidar además identificadores o slugs concretos.

## Contratos preventivos

- `pnpm audit:performance`: fuentes, imágenes, CSS por ruta, límites cliente, fichas SSR, shell del dashboard, `React.lazy`, límites `Suspense`, chunks por vista, estado compartible, memoización y caché.
- `pnpm audit:bundles`: bundles JavaScript reales posteriores al build.
- `tests/web-performance-contract.test.mjs`: arquitectura, imágenes, instalación, invalidación y presupuesto.
- `tests/public-dashboard-css-boundary.test.mjs`: estilos exclusivos del dashboard y administración fuera del layout raíz.
- `tests/public-ssr-navigation.test.mjs`: shell SSR, isla interactiva, carga diferida, límites `Suspense`, validación de parámetros, sincronización de URL y navegación pública.
- `tests/public-international-shell.test.mjs`: shell neutral respecto al país seleccionado sin convertirlo en cliente.
- `tests/theme-contract.test.mjs`: lógica compartida de tema con fronteras de presentación separadas.
- `tests/public-detail-ssr.test.mjs`: SSR y caché consolidada de fichas públicas.
- `tests/public-entity-detail-route.test.mjs`: ausencia del cliente duplicado y del adaptador API por slug.
- `tests/entity-profile-navigation.test.mjs`, `tests/entity-institutional-timeline.test.mjs` y `tests/entity-dynamic-organization-chart.test.mjs`: composición SSR y ausencia de hidratación presentacional.
- `pnpm check`: documentación, auditorías, TypeScript, pruebas, build y bundles.

## Evidencia de cierre

La fase no se considera validada operativamente hasta reunir:

- ejecución de GitHub Actions para el HEAD correspondiente;
- build de Vercel no bloqueado por límite de frecuencia;
- comprobación de rutas públicas desplegadas;
- medición de Core Web Vitals o Speed Insights con tráfico suficiente;
- revisión visual de imágenes, tipografía y fronteras CSS en móvil y escritorio.

El despliegue de Vercel asociado a `260583d` compiló correctamente, validó tipos y generó 50 páginas después de retirar endpoints públicos redundantes. En esa evidencia intermedia:

- `/` redujo su tamaño propio de 6.08 kB a 5.57 kB; el First Load JS permaneció en 111 kB porque las vistas todavía compartían el grafo cliente en ese commit.
- `/entidades/[slug]` redujo su tamaño propio de 3.59 kB a 733 B y el First Load JS de 109 kB a 106 kB tras mover navegación, cronología y organigrama al servidor.

El despliegue asociado a `30b30f8` confirmó cuatro chunks diferidos, pero `next/dynamic` elevó `/` a 6.24 kB propios y 112 kB de First Load JS.

El despliegue `dpl_AU7Afua93xf6v5QRYF2qSaJAjnBA`, asociado a `10d177e`, sustituyó ese cargador por `React.lazy` y cuatro límites `Suspense`. Compiló con Next.js 15.5.20, aprobó tipos, generó 50 páginas y quedó `READY`:

- `/`: 5.64 kB propios y 111 kB de First Load JS;
- mejora de 0.60 kB propios y 1 kB de First Load frente a `next/dynamic`;
- `/entidades/[slug]`: 733 B propios y 106 kB de First Load JS, sin regresión.

La inspección desplegada confirmó cuatro IDs de chunk, cuatro límites `Suspense` y una URL directa internacional con `vista`, `pais`, `provincia` y `jurisdiccion` resuelta por SSR.

El despliegue `dpl_9VCjE5daqvLs5nCuUX49SG7UGtmz`, asociado a `3172a38`, confirmó:

- compilación y validación de tipos correctas;
- `/personas/[slug]` en 177 B propios y 111 kB de First Load JS;
- eliminación del chunk de presentación del dashboard en el HTML de la ficha de persona, aunque el total de 111 kB permanece por el runtime requerido por `next/image`;
- `/_next/image` respondiendo 200 con `image/png` para el placeholder normalizado y caché pública;
- `og:image` y `twitter:image` utilizando la misma URL raster `/png` que la imagen renderizada.

Las separaciones de CSS por ruta se añadieron después de `3172a38`. Su HEAD está bloqueado por el límite de frecuencia de Vercel; todavía falta verificar que `/`, una ficha pública y `/admin` conserven apariencia y reciban hojas distintas.

## Advisors y riesgos

- `next/font/google` descarga la fuente durante el build; un bloqueo de red del entorno de compilación debe tratarse como fallo de infraestructura, no como razón para volver a una fuente remota en el navegador.
- La invalidación manual protege por rol administrativo. Debe evolucionar a permiso específico cuando exista un permiso operativo de caché en la matriz de autorización.
- Los presupuestos iniciales son límites de partida. Solo deben ajustarse con evidencia de bundle y una justificación documentada, nunca para ocultar una regresión.
- Los hosts de imágenes remotas deben permanecer restringidos; no debe abrirse un patrón global para resolver datos QA puntuales.
- La carga diferida reduce el código ejecutable inicial de las vistas no seleccionadas, pero su runtime, tamaño de ruta y transición deben medirse conjuntamente.
- `replaceState` mantiene una URL compartible sin llenar el historial con cada ajuste de filtro. El botón Atrás no recorre cada selección interna; este comportamiento es deliberado.
- Mover CSS entre layouts puede alterar el orden de cascada. Por eso las fronteras nuevas deben validarse visualmente antes de considerar cerrada la fase.
