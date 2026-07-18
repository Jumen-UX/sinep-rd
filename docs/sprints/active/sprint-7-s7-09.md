# Sprint 7 · S7-09 — Consolidación de componentes

> Estado: completada
> Inicio: 2026-07-17
> Cierre técnico: 2026-07-18
> Rama: `main`

## Objetivo

Reducir duplicación visual, retirar estilos y comportamientos embebidos, consolidar componentes reutilizables y limitar las capas de compatibilidad a las pantallas que todavía las necesitan.

## Resultado

S7-09 quedó completada y validada mediante CI. Los flujos migrados declaran su propia estructura, semántica, feedback, navegación y estados ocupados sin duplicar lógica de dominio.

## Bloques completados

1. `EventDraftPage` y base visual compartida de eventos.
2. `EventRegistryPage` y registro accesible.
3. `EventReviewPage` y revisión semántica.
4. `EventActionPlanPage` y editor relacional.
5. `EventApplicationContractPage` y contrato de aplicación.
6. `EventWorkflowVerificationPage` y tablero de verificación.
7. `PendingEventsPage` y cola administrativa.
8. Retirada de selectores de eventos de la capa temática heredada.
9. Reducción inicial de `LegacyAdminAccessibilityEnhancements` para excluir eventos.
10. Consolidación de configuración estructural y selector jerárquico; eliminación de `admin-embedded-theme-cleanup.css`.
11. Creación de `clergy-wizard-ui.css` y retirada de hojas específicas por rol.
12. Consolidación semántica de `BishopWizardPage`.
13. Consolidación semántica de `PriestWizardPage` y eliminación de su raíz duplicada.
14. Conversión de `DeaconWizardPage` a seis etapas explícitas.
15. Conversión de `LayPersonWizardPage` a cinco etapas explícitas.
16. Conversión de `ReligiousWizardPage` a seis etapas explícitas, conservando la delegación del sacerdote religioso al flujo sacerdotal.
17. Retirada física de `AutoSectionWizard`, sus selectores CSS, `MutationObserver` y `requestSubmit`; corrección del token de foco compartido.
18. Reducción del puente global de accesibilidad para excluir eventos, estructura, clero y asistentes de personas.

## Arquitectura consolidada

### Eventos

- `admin-event-workflows.css`
- `admin-event-action-plan.css`
- `admin-event-verification.css`

Las siete pantallas principales de eventos declaran estados, jerarquía, navegación y feedback de forma nativa.

### Estructura

- `admin-structure-workflows.css`
- `LevelOfficeConfigurationPage.tsx`
- `StructureHierarchySelector.tsx`

La configuración de cargos y la selección jerárquica ya no dependen de CSS embebido ni de la capa temporal retirada.

### Clero

- `person-wizard-ui.css` como base.
- `clergy-wizard-ui.css` como extensión común.
- `AdminWizardProgress` como navegación explícita.

Sacerdote, diácono y obispo conservan sus contratos canónicos, servicios y payloads sin hojas visuales específicas por rol.

### Personas y vida consagrada

- `person-registration-wizard.css` como extensión compartida.
- `AdminWizardProgress` como navegación explícita.
- `PersonWizardContextRail` como contexto lateral común.

Persona laica y vida consagrada mantienen identidad única, carga y reversión de fotografías, filtrado de cargos, visibilidad y persistencia canónica.

## Elementos retirados

- `admin-embedded-theme-cleanup.css`
- `priest-wizard-ui.css`
- `deacon-wizard-ui.css`
- `deacon-wizard-polish.css`
- `AutoSectionWizard.tsx`
- selectores `.auto-section-wizard*`
- navegación inferida mediante lectura del DOM
- ocultación imperativa de etapas
- submit indirecto mediante `requestSubmit`

La auditoría final no encontró imports ni selectores ejecutables de estos elementos. Las menciones restantes se limitan a historial documental y pruebas que protegen su ausencia.

## Compatibilidad heredada controlada

`LegacyAdminAccessibilityEnhancements` permanece temporalmente porque todavía existen formularios administrativos no migrados que dependen de:

- normalización de mensajes heredados;
- asociación del error con el primer control inválido;
- limpieza progresiva de `aria-invalid`;
- sincronización de estados heredados.

El puente también conserva la gestión del diálogo móvil administrativo: foco inicial, Escape, ciclo de tabulación y retorno del foco.

El puente ya no interviene en eventos, estructura, sacerdote, diácono, obispo, persona laica ni vida consagrada.

## Contratos relevantes

- `admin-event-workflow-consolidation.test.mjs`
- `admin-structure-consolidation.test.mjs`
- `clergy-wizard-style-consolidation.test.mjs`
- `bishop-wizard-accessibility-consolidation.test.mjs`
- `priest-wizard-accessibility-consolidation.test.mjs`
- `deacon-wizard-accessibility-consolidation.test.mjs`
- `lay-person-wizard-accessibility-consolidation.test.mjs`
- `religious-wizard-accessibility-consolidation.test.mjs`
- `auto-section-wizard-retirement.test.mjs`
- `legacy-admin-accessibility-enhancements.test.mjs`

## Deuda trasladada

No bloquea S7-09 y debe tratarse después de S7-10 o en un sprint específico:

- migrar los formularios administrativos heredados restantes;
- trasladar la gestión del diálogo móvil desde el puente hacia `AdminShell` o un componente de diálogo reutilizable;
- retirar completamente `LegacyAdminAccessibilityEnhancements` cuando no tenga consumidores reales.

## Criterios de cierre verificados

- No quedan estilos embebidos en los flujos incluidos en S7-09.
- No quedan hojas específicas de sacerdote o diácono.
- No queda navegación de asistentes inferida desde el DOM.
- Los asistentes migrados mantienen sus servicios y contratos canónicos.
- Los estados usan tokens compatibles con modo claro y oscuro.
- Navegación, foco, etiquetas y feedback tienen contratos de regresión.
- CI confirmó cada bloque en verde.

## Punto de continuación

S7-09 queda cerrada. El siguiente trabajo es S7-10: reconciliación operativa, pruebas autenticadas, validación visual, accesibilidad, seguridad y cierre completo del Sprint 7.
