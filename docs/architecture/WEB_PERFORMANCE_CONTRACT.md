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
- fichas públicas dinámicas, incluida `/pastoral/[slug]`;
- entrada administrativa;
- tamaño máximo de un chunk individual.

`pnpm check` ejecuta esta auditoría después del build. Un exceso de presupuesto o una ruta configurada ausente hace fallar el contrato.

## Límite servidor/cliente

- El `RootLayout` no debe hidratar mejoras específicas del portal público.
- Los componentes cliente públicos deben existir solo cuando gestionen interacción real.
- Se prohíben `MutationObserver` y `setInterval` como mecanismo de sincronización general del DOM público.
- Las transformaciones de presentación deben realizarse en React, en el servicio de dominio o durante el renderizado del servidor.
- `/pastoral/[slug]` se renderiza en servidor y no realiza una segunda solicitud a `/api/pastoral` después de hidratar.

## Fuentes

La tipografía principal se carga mediante `next/font` con `display: swap` y variable CSS. No se debe reintroducir una hoja externa de Google Fonts ni una dependencia de fuentes cargada desde el navegador.

## Imágenes

- `next.config.ts` permite imágenes remotas de Supabase Storage y formatos AVIF/WebP.
- `placehold.co` está autorizado únicamente como proveedor explícito de imágenes ficticias para los datos QA vigentes.
- Como `placehold.co` entrega SVG por defecto, `normalizePersonPhotoSource()` añade el formato `/png` cuando el placeholder no declara un formato raster. No se habilita `dangerouslyAllowSVG`.
- Las imágenes de contenido deben usar `next/image`, dimensiones estables y `sizes` cuando sean responsivas.
- `src/features/personas/components/PersonPhoto.tsx` centraliza los retratos público y administrativo.
- La fotografía pública prioriza la carga por estar en la cabecera de la ficha y declara un ancho responsivo máximo de 320 píxeles.
- La fotografía administrativa conserva el avatar de 96 por 96 píxeles y su tratamiento decorativo.
- La auditoría fuente bloquea cualquier uso de `<img>` dentro de `src`; ya no existen excepciones heredadas.
- La verificación desplegada debe comprobar también que `/_next/image` responda correctamente; un HTML 200 no demuestra por sí solo que el host y el formato remotos estén autorizados.

## Instalación de optimización de imágenes

El proyecto fija `pnpm@10.18.3`. Para esa versión, `pnpm-workspace.yaml` declara `sharp` mediante `onlyBuiltDependencies`; `allowBuilds` no corresponde a la versión fijada.

Vercel continúa mostrando la advertencia `Ignored build scripts: sharp` al restaurar un caché de dependencias previo y omitir la reinstalación. Los builds y el optimizador de imágenes administrado por Vercel siguen operativos. La advertencia no se considera cerrada hasta ejecutar una instalación limpia o cambiar deliberadamente la estrategia de dependencias con evidencia reproducible.

## Caché pública

Las lecturas agregadas del dashboard público usan `unstable_cache` con:

- TTL de respaldo de 300 segundos;
- etiquetas separadas para dashboard, directorios y registro eclesial;
- invalidación por etiqueta y ruta.

Las fichas públicas de personas, entidades y unidades organizativas comparten la etiqueta `public:directories`, aunque conservan un TTL de respaldo de 900 segundos. Esto evita que una mutación invalide el dashboard pero deje una ficha dinámica con datos anteriores.

Las rutas administrativas y los datos dependientes del usuario no usan caché compartida.

## Invalidación

`POST /api/admin/public-cache` exige:

1. usuario autenticado;
2. rol administrativo confirmado por Supabase;
3. ámbito de invalidación permitido.

Las operaciones de creación, edición y cierre de relaciones del registro eclesial solicitan invalidación del ámbito `registry`. Si la invalidación falla, la mutación permanece válida y el TTL limita la obsolescencia a cinco minutos; el cliente registra una advertencia sin exponer datos sensibles.

Las mutaciones administrativas de personas, nombramientos, entidades, jurisdicciones, países, nodos estructurales y unidades organizativas reutilizan `revalidatePublicContent()`, que delega en el ámbito consolidado `directories` y permite invalidar además slugs concretos.

## Contratos preventivos

- `pnpm audit:performance`: fuentes, imágenes, límites cliente y caché.
- `pnpm audit:bundles`: bundles reales posteriores al build.
- `tests/web-performance-contract.test.mjs`: arquitectura, imágenes, instalación, invalidación y presupuesto.
- `tests/public-detail-ssr.test.mjs`: SSR y caché consolidada de fichas públicas.
- `pnpm check`: documentación, auditorías, TypeScript, pruebas, build y bundles.

## Evidencia de cierre

La fase no se considera validada operativamente hasta reunir:

- ejecución de GitHub Actions para el HEAD correspondiente;
- build de Vercel no bloqueado por límite de frecuencia;
- comprobación de rutas públicas desplegadas y del endpoint `/_next/image`;
- medición de Core Web Vitals o Speed Insights con tráfico suficiente;
- revisión visual de imágenes y tipografía en móvil y escritorio.

## Advisors y riesgos

- `next/font/google` descarga la fuente durante el build; un bloqueo de red del entorno de compilación debe tratarse como fallo de infraestructura, no como razón para volver a una fuente remota en el navegador.
- La invalidación manual protege por rol administrativo. Debe evolucionar a permiso específico cuando exista un permiso operativo de caché en la matriz de autorización.
- Los presupuestos iniciales son límites de partida. Solo deben ajustarse con evidencia de bundle y una justificación documentada, nunca para ocultar una regresión.
- Los hosts de imágenes remotas deben permanecer restringidos; no debe abrirse un patrón global para resolver datos QA puntuales.
