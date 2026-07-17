# Sprint 7 · S7-07 — Herramientas de accesibilidad

> Estado: completada y validada
> Fecha: 2026-07-17
> Rama: `main`

## Dependencia resuelta

S7-06 quedó técnicamente validada por CI y E2E público. La comprobación visual administrativa autenticada permanece registrada para S7-10 porque depende de reparar `E2E_ACCESS_PROFILES_JSON`; no bloquea S7-07.

## Implementación

- `AccessibilityTools` global para rutas públicas y administrativas.
- Botón flotante responsive, desplazado sobre la navegación administrativa móvil.
- Panel no modal con foco inicial, cierre con `Escape`, retorno de foco y cierre exterior.
- Tamaño de texto normal, grande y muy grande.
- Alto contraste compatible con tema claro y oscuro.
- Reducción explícita de movimiento.
- Subrayado reforzado de enlaces.
- Persistencia mediante `localStorage` y sincronización entre pestañas.
- Aplicación de preferencias antes del render para evitar destellos.
- Recuperación segura ante almacenamiento no disponible o datos inválidos.
- Región viva para anunciar cambios a tecnologías de asistencia.

## Validación completada

- `tests/accessibility-tools.test.mjs` protege montaje, semántica, persistencia, estilos y responsive.
- `e2e/public-accessibility.spec.mjs` valida apertura, teclado, tamaño, contraste, recarga, persistencia y Axe.
- `.github/workflows/e2e-public.yml` observa el layout raíz y `src/components/accessibility/**`.
- `pnpm check`, CI y `E2E / Public accessibility` confirmados en verde.

## Cierre

S7-07 queda cerrada. El siguiente bloque es S7-08: auditoría transversal de responsive, teclado, foco, contraste y lectores de pantalla.