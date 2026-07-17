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

## Primer bloque implementado

- Se creó `src/styles/admin-event-workflows.css` como capa compartida para formularios, asistentes, tarjetas, steppers, pestañas y layouts de eventos.
- La hoja se carga desde el layout administrativo antes de las capas de compatibilidad temática.
- `EventDraftPage.tsx` dejó de declarar `pageStyles` y de inyectar una etiqueta `<style>`.
- El asistente de eventos declara directamente navegación de pasos, `aria-current`, nombres accesibles, `aria-pressed`, errores assertivos y estado de guardado ocupado.
- `tests/admin-event-workflow-consolidation.test.mjs` protege la extracción y evita regresar al patrón embebido.

## Criterio del siguiente bloque

Migrar `EventRegistryPage.tsx` y las pantallas de revisión, plan, contrato, verificación y pendientes a la hoja compartida; después retirar de la capa de compatibilidad los selectores que ya no sean necesarios.