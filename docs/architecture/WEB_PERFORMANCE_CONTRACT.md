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

## Frontera de layouts

- `src/app/layout.tsx` es infraestructura común: tipografía, scripts de tema y accesibilidad, enlace de salto, herramientas de accesibilidad y telemetría.
- El root no importa `next/link`, no renderiza `ThemeControl` y no contiene header, footer ni `site-shell`.
- `src/app/(public)/layout.tsx` es propietario del shell público, navegación, control de apariencia, footer y destino `#contenido-principal`.
- `src/app/(admin)/layout.tsx` mantiene su propio destino `#contenido-principal` sin incorporar navegación ni presentación pública.
- Esta separación evita que una ruta administrativa renderice elementos públicos ocultos o descargue un chunk público para resolver dependencias del root.
- `scripts/audit-web-performance.mjs`, `tests/public-admin-layout-boundary.test.mjs` y `tests/theme-contract.test.mjs` protegen la frontera.

## CSS por ruta

- `public-dashboard.css`, `public-territorial.css` y `public-combobox.css` pertenecen exclusivamente al portal principal y se importan desde `src/app/(public)/page.tsx`.
- El layout raíz no debe volver a importar esos tres archivos, porque hacerlo envía reglas del dashboard a directorios, fichas, páginas legales y administración.
- `admin-brand.css` se carga desde `src/app/(admin)/layout.tsx`; no forma parte del CSS común de las páginas públicas.
- Las tres reglas públicas que estaban mezcladas en `admin-brand.css` se preservan en `public-brand-overrides.css` para no alterar las fichas de oficinas, pastoral, organismos y provincias eclesiásticas.
- `scripts/audit-web-performance.mjs` y `tests/public-dashboard-css-boundary.test.mjs` protegen estas fronteras fuente.
- El auditor de bundles vigente controla JavaScript mediante `app-build-manifest.json`; no se declarará un presupuesto CSS numérico hasta implementar una lectura reproducible de los manifiestos CSS de Next.js.

## Límite servidor/cliente

- El `RootLayout` no debe hidratar mejoras específicas del portal público.
- Los componentes cliente públicos deben existir solo cuando gestionen interacción real.
- Se prohíben `MutationObserver` y `setInterval` como mecanismo de sincronización general del DOM público.
- Las transformaciones de presentación deben realizarse en React, en el servicio de dominio o durante el renderizado del servidor.
- `/entidades/[slug]`, `/pastoral/[slug]`, `/oficinas/[id]`, `/organismos/[id]` y `/provincias-eclesiasticas/[slug]` se renderizan en servidor y no consultan sus propias rutas `/api/*` después de hidratar.
- La navegación anclada, la cronología institucional y el organigrama dinámico de `/entidades/[slug]` son componentes de servidor.
- El antiguo `EntityDetailPage.tsx` y el adaptador `/api/entidades/[slug]` fueron retirados. La ficha canónica usa `loadPublicEntityDetail()` y `EntityDetailServerView`.
- El portal principal usa `PublicDashboardShell` para cabecera, sidebar, accesos, controles de apariencia y navegación móvil renderizados en servidor.
- `PublicDashboardExplorer` conserva exclusivamente el modelo interactivo de ámbito, filtros y selección de vistas mediante `usePublicDashboardModel()`.
- `PublicTerritorialView` permanece en el grafo inicial porque es la vista predeterminada.
- `PublicPeopleView`, `PublicPastoralView`, `PublicAdministrativeView` y `PublicCollegialView` se cargan mediante `React.lazy`, cada una desde su propio módulo y dentro de un límite `Suspense`; no se usa `next/dynamic` ni se desactiva SSR.
- Los fallbacks de las vistas diferidas mantienen `tabpanel`, `aria-busy`, `role="status"` y `aria-live="polite"`; su CSS Module reserva altura responsive para reducir CLS.
- Los parámetros `vista`, `pais`, `provincia` y `jurisdiccion` se validan contra el bundle público durante el renderizado de servidor.
- Los cambios posteriores de vista y ámbito se reflejan con `history.replaceState` mediante `PublicDashboardUrlState`, sin `router.replace`, sin nueva navegación de servidor y sin solicitudes adicionales al dashboard.
- Los filtros internos de tipo de persona y nivel pastoral permanecen locales.
- Las colecciones derivadas de personas y unidades organizativas se memoizan; la clasificación administrativa/colegial se ejecuta en una sola pasada por cambio del dataset.
- El footer del shell público usa una descripción neutral de cobertura internacional.
- `ThemeControl` y `PublicDashboardThemeControl` comparten `useThemePreference`, pero mantienen presentaciones separadas.
- Los antiguos `PublicDashboardClient.tsx`, `PublicPeoplePastoralViews.tsx` y `PublicOrganizationViews.tsx` fueron retirados.
- `scripts/audit-web-performance.mjs` bloquea regresiones en layouts, SSR, shell/explorador, `React.lazy`, `Suspense`, URL compartible, memoización, control de tema, CSS por ruta e imágenes sociales.

Las rutas API públicas equivalentes solo deben mantenerse cuando exista un consumidor explícito distinto del render inicial. No se deben conservar adaptadores sin consumidores por compatibilidad hipotética.

## Fuentes

La tipografía principal se carga mediante `next/font` con `display: swap` y variable CSS. No se debe reintroducir una hoja externa de Google Fonts ni una dependencia de fuentes cargada desde el navegador.

## Imágenes

- `next.config.ts` permite imágenes remotas de Supabase Storage y formatos AVIF/WebP.
- `placehold.co` está autorizado únicamente como proveedor explícito de imágenes ficticias para los datos QA vigentes.
- Como `placehold.co` entrega SVG por defecto, `normalizePersonPhotoSource()` añade el formato `/png` cuando el placeholder no declara un formato raster. No se habilita `dangerouslyAllowSVG`.
- La normalización reside en `src/features/personas/person-photo-source.ts` y se reutiliza tanto en `PersonPhoto.tsx` como en `generateMetadata()`.
- Open Graph y Twitter no deben publicar una URL SVG implícita cuando la fotografía renderizada utiliza una fuente raster normalizada.
- Las imágenes de contenido deben usar `next/image`, dimensiones estables y `sizes` cuando sean responsivas.
- La fotografía pública prioriza la carga por estar en la cabecera de la ficha y declara un ancho responsivo máximo de 320 píxeles.
- La fotografía administrativa conserva el avatar de 96 por 96 píxeles y su tratamiento decorativo.
- La auditoría fuente bloquea cualquier uso de `<img>` dentro de `src`.

## Instalación de optimización de imágenes

El proyecto fija `pnpm@10.18.3`. Para esa versión, `pnpm-workspace.yaml` declara `sharp` mediante `onlyBuiltDependencies`; `allowBuilds` no corresponde a la versión fijada.

Vercel continúa mostrando la advertencia `Ignored build scripts: sharp` al restaurar un caché de dependencias previo y omitir la reinstalación. Los builds y el optimizador de imágenes administrado por Vercel siguen operativos. La advertencia no se considera cerrada hasta ejecutar una instalación limpia o cambiar deliberadamente la estrategia de dependencias con evidencia reproducible.

## Caché pública

Las lecturas agregadas del dashboard público usan `unstable_cache` con:

- TTL de respaldo de 300 segundos;
- etiquetas separadas para dashboard, directorios y registro eclesial;
- invalidación por etiqueta y ruta.

Las fichas públicas de personas, entidades, unidades organizativas, oficinas, organismos colegiales y provincias eclesiásticas comparten la etiqueta `public:directories`, aunque conservan un TTL de respaldo de 900 segundos.

Las rutas administrativas y los datos dependientes del usuario no usan caché compartida.

## Invalidación

`POST /api/admin/public-cache` exige:

1. usuario autenticado;
2. rol administrativo confirmado por Supabase;
3. ámbito de invalidación permitido.

Las operaciones de creación, edición y cierre de relaciones del registro eclesial solicitan invalidación del ámbito `registry`. Si la invalidación falla, la mutación permanece válida y el TTL limita la obsolescencia a cinco minutos.

Las mutaciones administrativas reutilizan `revalidatePublicContent()`, que delega en el ámbito consolidado `directories` y permite invalidar además identificadores o slugs concretos.

## Contratos preventivos

- `pnpm audit:performance`: layouts, fuentes, imágenes, CSS por ruta, límites cliente, fichas SSR, dashboard, chunks por vista, estado compartible, memoización y caché.
- `pnpm audit:bundles`: bundles JavaScript reales posteriores al build.
- `tests/web-performance-contract.test.mjs`: arquitectura, imágenes, instalación, invalidación y presupuesto.
- `tests/public-admin-layout-boundary.test.mjs`: root infraestructural y shells propios por grupo de rutas.
- `tests/public-dashboard-css-boundary.test.mjs`: estilos exclusivos del dashboard y administración fuera del layout raíz.
- `tests/public-ssr-navigation.test.mjs`: shell SSR, carga diferida, parámetros y sincronización de URL.
- `tests/public-international-shell.test.mjs`: shell neutral respecto al país seleccionado.
- `tests/theme-contract.test.mjs`: lógica compartida de tema y fronteras de presentación.
- `tests/public-detail-ssr.test.mjs`: SSR y caché consolidada de fichas públicas.
- `tests/public-entity-detail-route.test.mjs`: ausencia del cliente duplicado y del adaptador API por slug.
- `tests/entity-profile-navigation.test.mjs`, `tests/entity-institutional-timeline.test.mjs` y `tests/entity-dynamic-organization-chart.test.mjs`: composición SSR y ausencia de hidratación presentacional.
- `pnpm check`: documentación, auditorías, TypeScript, pruebas, build y bundles.

## Evidencia de cierre

La fase no se considera validada operativamente hasta reunir:

- ejecución de GitHub Actions para el HEAD correspondiente;
- build de Vercel no bloqueado por límite de frecuencia;
- comprobación de rutas públicas y administrativas desplegadas;
- medición de Core Web Vitals o Speed Insights con tráfico suficiente;
- revisión visual en móvil y escritorio.

El despliegue asociado a `260583d` confirmó `/` en 5.57 kB propios y 111 kB de First Load JS, y `/entidades/[slug]` en 733 B y 106 kB.

El despliegue asociado a `30b30f8` confirmó cuatro chunks diferidos, pero `next/dynamic` elevó `/` a 6.24 kB propios y 112 kB de First Load JS.

El despliegue `dpl_AU7Afua93xf6v5QRYF2qSaJAjnBA`, asociado a `10d177e`, sustituyó ese cargador por `React.lazy` y cuatro límites `Suspense`:

- `/`: 5.64 kB propios y 111 kB de First Load JS;
- `/entidades/[slug]`: 733 B propios y 106 kB de First Load JS;
- cuatro chunks independientes y URL internacional directa resuelta por SSR.

El despliegue `dpl_9VCjE5daqvLs5nCuUX49SG7UGtmz`, asociado a `3172a38`, confirmó:

- `/personas/[slug]` en 177 B propios y 111 kB de First Load JS;
- eliminación del chunk de presentación del dashboard en la ficha de persona;
- `/_next/image` respondiendo 200 con `image/png`;
- `og:image` y `twitter:image` utilizando la URL raster normalizada.

El despliegue `dpl_4WGZXKqtiHdHDLeuDcZwk1Mt2CHb`, asociado a `184af63`, validó las fronteras CSS:

- compilación, tipos y 50 páginas correctas;
- `/` en 5.71 kB propios y 111 kB de First Load JS;
- una ficha pública carga la hoja común `f691…css` y no la hoja de dashboard `4736…css`;
- `/` carga adicionalmente `4736…css`, que contiene únicamente reglas de combobox, dashboard, territorial, impresión y fallback;
- `/admin/login` carga `1cef…css` con la marca administrativa, además de sus hojas administrativas específicas.

La inspección RSC de ese mismo despliegue detectó que `/admin/login` todavía descargaba `app/(public)/page-112bb055756962be.js`. El módulo se utilizaba como proveedor de `next/link` para el header y footer que entonces residían en el root. El HEAD posterior mueve el shell público a `(public)`, deja el root infraestructural y asigna un destino de salto independiente a `(admin)`. Esta reducción aún requiere un build exacto y verificación del HTML administrativo.

## Advisors y riesgos

- `next/font/google` descarga la fuente durante el build; un bloqueo de red debe tratarse como fallo de infraestructura.
- La invalidación manual protege por rol administrativo. Debe evolucionar a permiso específico cuando exista un permiso operativo de caché.
- Los presupuestos solo deben ajustarse con evidencia, nunca para ocultar una regresión.
- Los hosts de imágenes remotas deben permanecer restringidos.
- La carga diferida debe evaluarse junto con su runtime y transición.
- `replaceState` mantiene una URL compartible sin llenar el historial con cada ajuste.
- Mover CSS o shells entre layouts puede alterar cascada, foco o navegación. Cada frontera requiere validación desplegada.
