# Sprint 7 · S7-09 — Retirada de AutoSectionWizard

> Estado: implementado; CI pendiente
> Fecha: 2026-07-18
> Rama: `main`

## Dependencia validada

- El decimosexto bloque, correspondiente a `ReligiousWizardPage`, fue confirmado con CI en verde.
- Sacerdote, diácono, obispo, persona laica y vida consagrada controlan sus etapas mediante `AdminWizardProgress` y submit nativo.

## Decimoséptimo bloque implementado

- Se eliminó físicamente `src/components/admin/AutoSectionWizard.tsx`.
- Se retiraron de `person-wizard-ui.css` las reglas `.auto-section-wizard`, `.auto-section-wizard__content` y `.auto-section-wizard__actions`.
- La hoja compartida se compactó sin cambiar sus responsabilidades de superficies, formularios, riel contextual, responsive y reducción de movimiento.
- El foco dejó de usar `--focus-ring` como color de `outline`; ahora utiliza el token completo mediante `box-shadow`.
- `tests/auto-section-wizard-retirement.test.mjs` exige la ausencia física del componente y de sus selectores.
- El contrato confirma que los cinco asistentes migrados declaran `AdminWizardProgress`, etapas propias y ausencia de `MutationObserver`, `requestSubmit` e imports del wrapper retirado.

## Responsabilidades eliminadas

- Inferencia de etapas leyendo encabezados del DOM.
- Ocultación imperativa de secciones.
- Observación global mediante `MutationObserver`.
- Ocultación del submit original.
- Activación indirecta mediante `requestSubmit`.

## Riesgo y verificación

- La retirada no cambia servicios, payloads ni persistencia.
- Los contratos específicos de sacerdote, diácono, obispo, laico y vida consagrada permanecen activos.
- La eliminación completa queda pendiente de confirmación por CI antes de continuar con el puente global de accesibilidad.

## Criterio del siguiente bloque

Validar este bloque con CI. Después se auditará `LegacyAdminAccessibilityEnhancements` para retirar responsabilidades de formularios y asistentes que ya declaran semántica nativa, conservando únicamente la gestión del diálogo móvil mientras siga siendo necesaria.
