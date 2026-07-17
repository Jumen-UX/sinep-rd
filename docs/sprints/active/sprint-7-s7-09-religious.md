# Sprint 7 · S7-09 — Consolidación del asistente de vida consagrada

> Estado: implementado; CI pendiente
> Fecha: 2026-07-17
> Rama: `main`

## Dependencia validada

- El decimoquinto bloque de S7-09, correspondiente a `LayPersonWizardPage`, fue confirmado con CI en verde.

## Decimosexto bloque implementado

- `ReligiousWizardPage.tsx` dejó de depender de la inferencia de etapas por DOM y controla seis etapas explícitas mediante `AdminWizardProgress`.
- El layout de la ruta ya no monta `AutoSectionWizard`; conserva `PersonWizardContextRail` y carga `person-registration-wizard.css` después de la base visual.
- La hoja compartida cubre ahora los flujos controlados de persona laica y vida consagrada sin duplicar reglas por rol.
- Las seis etapas permanecen montadas mediante `hidden`, preservando `FormData`, payload y servicios canónicos.
- El tipo de vida consagrada usa un grupo de botones con `aria-pressed`.
- El caso de sacerdote religioso conserva la redirección a `/admin/nuevo/sacerdote`, limita el progreso al primer paso y no introduce una segunda ruta de persistencia sacerdotal.
- Carga, error, confirmación, contenido, formulario y guardado declaran estados accesibles propios.
- Se eliminaron controles identificados solo mediante `placeholder`; identidad, documentos, contacto, comunidad, profesión, estado, servicio, cargo, visibilidad y revisión usan etiquetas explícitas.
- Identidad, contacto, asignación y datos no encontrados se agrupan mediante `fieldset` y `legend`.
- Servicio actual, entidad del cargo y filtro de cargos se anuncian como estados dinámicos.
- La revisión usa artículos semánticos y la barra inferior expone navegación y submit nativos, sin `MutationObserver` ni `requestSubmit`.
- Se conservaron reutilización de identidad, fotografía con reversión, visibilidad, filtrado por nivel y limpieza de cargos incompatibles.
- `tests/religious-wizard-accessibility-consolidation.test.mjs` protege estructura, semántica, redirección sacerdotal y contratos canónicos.

## Verificación previa a CI

- El contrato dedicado fue ejecutado de forma aislada: 8 de 8 pruebas aprobadas.
- La revisión sintáctica y de formato del JSX fue satisfactoria.

## Deuda transferida

- `AutoSectionWizard` ya no tiene consumidores funcionales conocidos, pero su eliminación física se realizará en el siguiente bloque, junto con sus reglas CSS y la actualización de contratos históricos.
- El registro principal `sprint-7-s7-09.md` se reconciliará durante el cierre de S7-09.

## Criterio del siguiente bloque

Validar este bloque con CI. Después retirar `AutoSectionWizard`, sus reglas en `person-wizard-ui.css` y cualquier contrato que todavía exija su existencia, antes de reducir nuevamente `LegacyAdminAccessibilityEnhancements`.
