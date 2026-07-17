# Sprint 7 · S7-08 — Responsive y accesibilidad transversal

> Estado: completada y validada
> Fecha: 2026-07-17
> Rama: `main`

## Alcance completado

- Barrido de estilos heredados y superficies claras fijas en capas públicas y administrativas.
- Migración de superficies, texto, bordes, estados y formularios a tokens semánticos compatibles con modo claro, oscuro y alto contraste.
- Política global de foco visible para controles, tarjetas, filas, tablas y componentes personalizados.
- Objetivos táctiles mínimos de 44 px en controles móviles relevantes.
- Corrección del modelo de foco de combobox públicos y administrativos.
- Progreso de asistentes con `aria-current`, regiones vivas y nombres accesibles.
- Puente temporal para asistentes administrativos heredados, mensajes dinámicos y navegación móvil.
- Diálogo móvil con foco inicial, trampa de tabulación, cierre con `Escape` y retorno de foco.
- Política global de reflujo, corte seguro de texto y desplazamiento horizontal localizado en tablas.
- Validación E2E a 390 px con tamaño de texto “Muy grande” sin desbordamiento horizontal global.
- Normalización de errores, éxito, advertencias, información, estados ocupados y asociaciones campo-error.
- Primer campo inválido marcado con `aria-invalid`, asociado mediante `aria-describedby` y enfocado sin destruir ayudas existentes.

## Contratos y pruebas

- `tests/public-dashboard-theme-surfaces.test.mjs`
- `tests/legacy-theme-surface-audit.test.mjs`
- `tests/focus-and-touch-targets.test.mjs`
- `tests/searchable-select-contract.test.mjs`
- `tests/admin-interaction-accessibility.test.mjs`
- `tests/legacy-admin-accessibility-enhancements.test.mjs`
- `tests/reflow-accessibility.test.mjs`
- `tests/admin-status-notice-accessibility.test.mjs`
- `e2e/public-accessibility.spec.mjs`

## Validación completada

Los bloques de contraste, foco, navegación por teclado, lectores de pantalla, reflujo, mensajes dinámicos y asociación campo-error fueron confirmados sucesivamente con CI y E2E en verde.

## Deuda trasladada a S7-09

`LegacyAdminAccessibilityEnhancements` y `admin-embedded-theme-cleanup.css` son capas de compatibilidad temporales. S7-09 debe sustituirlas progresivamente por componentes compartidos y estilos de módulo canónicos, comenzando por el conjunto de eventos administrativos que todavía usa cadenas `pageStyles`.

## Cierre

S7-08 queda cerrada. El siguiente bloque es S7-09: reducir duplicación visual y consolidar componentes reutilizables.