# Sprint 7 · S7-09 — Reducción del puente heredado de accesibilidad

> Estado: implementado; CI pendiente
> Fecha: 2026-07-18
> Rama: `main`

## Dependencias validadas

- El decimoséptimo bloque, correspondiente a la retirada de `AutoSectionWizard`, fue confirmado con CI en verde.
- La auditoría de `.error-box` encontró pantallas administrativas no migradas que todavía no declaran semántica y asociación de errores de forma nativa.
- El diálogo móvil administrativo aún depende del puente para foco inicial, Escape, trampa de tabulación y retorno del foco.

## Decimoctavo bloque implementado

- `LegacyAdminAccessibilityEnhancements` dejó de excluir únicamente eventos y ahora reconoce todas las raíces administrativas modernizadas.
- El puente no modifica feedback, estados ocupados ni asociación de errores dentro de eventos, configuración estructural, selector jerárquico, sacerdote, diácono, obispo, vida consagrada y persona laica.
- La asociación automática entre error y primer control inválido permanece solo para formularios heredados fuera de esas raíces.
- La gestión del diálogo móvil permanece intacta: `aria-modal`, foco inicial, Escape, ciclo de tabulación y retorno al disparador.
- `tests/legacy-admin-accessibility-enhancements.test.mjs` protege el nuevo límite y evita que el puente vuelva a apropiarse de semántica ya declarada por componentes modernos.

## Deuda controlada

- El puente no puede retirarse por completo hasta migrar las pantallas administrativas restantes que aún dependen de `.error-box`, `.empty-state` y validación nativa sin asociaciones accesibles.
- El `MutationObserver` se mantiene temporalmente para sincronizar esos mensajes heredados y el estado del diálogo móvil.
- La responsabilidad del diálogo debe trasladarse finalmente a `AdminShell` o a un componente de diálogo reutilizable antes de eliminar el puente.

## Criterio del siguiente bloque

Validar este bloque con CI. Después se reconciliará la documentación principal de S7-09, se auditará CSS y duplicación residual, y se decidirá si S7-09 puede cerrarse dejando la migración de pantallas heredadas como deuda explícita para un sprint posterior.
