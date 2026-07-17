# Sprint 7 · S7-09 — Consolidación del asistente de persona laica

> Estado: implementado; CI pendiente
> Fecha: 2026-07-17
> Rama: `main`

## Dependencia validada

- El decimocuarto bloque de S7-09, correspondiente a `DeaconWizardPage`, fue confirmado con CI en verde.

## Decimoquinto bloque implementado

- `LayPersonWizardPage.tsx` dejó de depender de la inferencia de etapas por DOM y controla cinco etapas explícitas mediante `AdminWizardProgress`.
- El layout de la ruta ya no monta `AutoSectionWizard`; conserva `PersonWizardContextRail` y carga `person-registration-wizard.css` después de la base compartida.
- Las cinco etapas permanecen montadas mediante `hidden`, de modo que el submit final conserva el mismo `FormData`, payload y servicio canónico.
- Carga, error, confirmación, contenido, formulario y guardado declaran estados accesibles propios.
- Se eliminaron controles identificados solo mediante `placeholder`; identidad, documentos, contacto, biografía, servicio, cargo, visibilidad y revisión usan etiquetas explícitas.
- Identificación, contacto y datos no encontrados se agrupan mediante `fieldset` y `legend`.
- Entidad seleccionada y filtro de cargos se anuncian como estados dinámicos.
- La revisión usa artículos semánticos y la barra inferior expone navegación y submit nativos, sin `MutationObserver` ni `requestSubmit`.
- Se conservaron la reutilización de identidad, la subida y reversión de fotografía, la visibilidad del servicio, el filtrado por nivel y la limpieza de cargos incompatibles.
- `tests/lay-person-wizard-accessibility-consolidation.test.mjs` protege estructura, semántica, estilos y contratos canónicos.

## Deuda controlada

- `AutoSectionWizard` permanece porque el asistente de vida consagrada todavía lo consume.
- `person-wizard-ui.css` conserva temporalmente las reglas de `.auto-section-wizard` hasta migrar ese último consumidor.
- El registro principal `sprint-7-s7-09.md` se reconciliará al validar este bloque o durante el cierre de S7-09.

## Criterio del siguiente bloque

Validar este bloque con CI. Después se consolidará `ReligiousWizardPage`, se retirará `AutoSectionWizard` si queda sin consumidores y se continuará con la reducción de `LegacyAdminAccessibilityEnhancements`.
