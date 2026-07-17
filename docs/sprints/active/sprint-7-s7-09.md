# Sprint 7 · S7-09 — Consolidación de componentes

> Estado: en progreso
> Fecha de inicio: 2026-07-17
> Rama: `main`

## Objetivo

Reducir duplicación visual, retirar estilos embebidos y sustituir progresivamente las capas de compatibilidad por componentes y hojas compartidas con semántica propia.

## Orden de migración

1. Flujos administrativos de eventos.
2. Configuración estructural y selector jerárquico.
3. Asistentes heredados de clero y personas.
4. Eliminación gradual de selectores ya innecesarios en `admin-embedded-theme-cleanup.css`.
5. Reducción y retiro de `LegacyAdminAccessibilityEnhancements` cuando las pantallas declaren semántica, feedback y validación de forma nativa.

## Primer bloque implementado y validado

- Se creó `src/styles/admin-event-workflows.css` como capa compartida para formularios, asistentes, tarjetas, steppers, pestañas y layouts de eventos.
- La hoja se carga desde el layout administrativo antes de las capas de compatibilidad temática.
- `EventDraftPage.tsx` dejó de declarar `pageStyles` y de inyectar una etiqueta `<style>`.
- El asistente de eventos declara directamente navegación de pasos, `aria-current`, nombres accesibles, `aria-pressed`, errores assertivos y estado de guardado ocupado.
- `tests/admin-event-workflow-consolidation.test.mjs` protege la extracción y evita regresar al patrón embebido.
- CI confirmó el bloque en verde.

## Segundo bloque implementado y validado

- `EventRegistryPage.tsx` dejó de declarar `pageStyles` y de inyectar CSS desde React.
- La hoja compartida incorporó barra de filtros, pestañas, tarjetas seleccionables, caja de fecha, badges semánticos y adaptación móvil del registro.
- Se eliminaron blancos y beiges literales del flujo migrado; las superficies y estados usan tokens de tema.
- Los modos de trabajo y eventos seleccionados declaran `aria-pressed`.
- Las tarjetas controlan el panel de detalle mediante `aria-controls` y el detalle se anuncia como región viva moderada.
- Carga, errores, resultados vacíos y cambios en el número de resultados exponen semántica accesible propia.
- El contrato de consolidación protege ambas pantallas y evita reintroducir estilos embebidos o superficies claras fijas.
- CI confirmó el bloque en verde.

## Tercer bloque implementado y validado

- `EventReviewPage.tsx` dejó de declarar `pageStyles` y de inyectar estilos desde React.
- La hoja compartida incorporó tarjetas de revisión, validaciones, participantes, nodos de impacto e incidencias con severidades semánticas.
- Los estados de éxito, advertencia y error usan `success-soft`, `warning-soft`, `danger-soft` y sus bordes canónicos.
- Las validaciones exponen nombres accesibles con resultado explícito y los iconos visuales se marcan como decorativos.
- Las incidencias bloqueantes se anuncian como alertas y las advertencias como estados moderados.
- Carga, evento inexistente, errores de acción, resumen y guardado declaran semántica propia.
- La nota de revisión usa asociación `label`/`textarea`, y la acción de aprobación referencia la guía de impacto mediante `aria-describedby`.
- El contrato de consolidación protege las tres pantallas migradas.
- CI confirmó el bloque en verde.

## Cuarto bloque implementado y validado

- `EventActionPlanPage.tsx` dejó de declarar `pageStyles` y de inyectar estilos desde React.
- Se creó `src/styles/admin-event-action-plan.css` como módulo del conjunto compartido de eventos para editor relacional, métricas, acciones y conflictos.
- Las superficies y severidades usan tokens semánticos compatibles con tema claro y oscuro.
- El editor relacional declara una región etiquetada y estado ocupado durante el guardado.
- Conflictos bloqueantes se anuncian como alertas y advertencias como estados moderados.
- Las acciones usan encabezados `h3` bajo la sección principal y los controles de estado declaran `role="group"` y `aria-pressed`.
- Carga, evento inexistente, errores, plan vacío, resumen y regeneración declaran semántica accesible propia.
- El contrato de consolidación protege estilos, estructura y comportamiento accesible del plan.
- CI confirmó el bloque en verde.

## Quinto bloque implementado y validado

- `EventApplicationContractPage.tsx` dejó de declarar `pageStyles` y de inyectar estilos desde React.
- `admin-event-action-plan.css` se amplió para compartir métricas, listas, badges y layouts entre plan y contrato sin duplicar una tercera hoja.
- Las tarjetas, resúmenes y condiciones usan superficies semánticas compatibles con tema claro y oscuro.
- La aplicación expone `aria-busy`, guía asociada mediante `aria-describedby` y resumen anunciado como región viva moderada.
- Errores y confirmaciones usan prioridades de anuncio diferenciadas.
- Las acciones del contrato usan encabezados `h3`, nombres accesibles con su estado contractual y un estado explícito cuando no existen acciones.
- Métricas, acciones y condiciones declaran nombres de región propios.
- El contrato de consolidación protege ausencia de estilos embebidos, tokens semánticos y comportamiento accesible.
- CI confirmó el bloque en verde.

## Sexto bloque implementado

- `EventWorkflowVerificationPage.tsx` dejó de declarar `pageStyles` y de inyectar estilos desde React.
- Se creó `src/styles/admin-event-verification.css` para mantener aisladas las reglas específicas del tablero de verificación.
- El módulo usa superficies y estados semánticos, sin colores claros codificados directamente, y adapta métricas y paneles a una columna.
- El resumen general se anuncia como región viva moderada.
- Las métricas declaran nombres de región diferenciados para volumen y estado operativo.
- El checklist técnico expone el resultado de cada condición mediante nombres accesibles y marca sus iconos como decorativos.
- El recorrido manual se representa como lista ordenada y declara un estado explícito cuando no existen pasos pendientes.
- Carga y errores usan `status` y `alert` con prioridad adecuada.
- El contrato de consolidación protege estilos, responsive, semántica y ausencia de CSS embebido.

## Criterio del siguiente bloque

Validar el sexto bloque con CI y migrar `PendingEventsPage.tsx`. Después se retirarán de `admin-embedded-theme-cleanup.css` los selectores de eventos que ya no sean necesarios.
