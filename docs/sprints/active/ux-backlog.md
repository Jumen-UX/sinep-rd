# Backlog UX activo

> Estado: vigente
> Última revisión: 2026-07-21
> Propietario: producto y frontend

## Convención de estado

- **Completado:** existe implementación y evidencia automatizada aplicable.
- **Parcial:** existe una base operativa, pero faltan rutas, estados o validación manual.
- **Pendiente:** no existe todavía una solución común verificable.

La cobertura visual se controla mediante la [matriz de validación UX](../../design/MATRIZ_VALIDACION_VISUAL_UX.md). Un resultado de CI verde no sustituye la revisión manual con cuentas y datos representativos.

## Sprint UX 0.1 — fundamentos visuales y accesibilidad

| Capacidad | Estado | Evidencia y trabajo restante |
|---|---|---|
| Tokens semánticos | Completado | `src/styles/ui-system.css`, `src/app/globals.css` y `docs/design/SINEP_UI_PARAMETERS.json`. |
| Tema claro, oscuro y automático sin destello inicial | Completado | Bootstrap previo a hidratación, `ThemeControl` y E2E de persistencia. |
| Herramientas de accesibilidad | Completado | Panel flotante, foco restaurado, tamaño de texto y alto contraste persistentes. |
| Contraste WCAG AA | Parcial | Axe cubre rutas públicas y existen tokens de contraste; falta revisión visual autenticada y comprobación manual de estados no alcanzables sin datos. |
| Componentes básicos compartidos | Parcial | `Button`, `PageHeader`, `DataTable`, estados vacíos y badges ya se usan en módulos prioritarios; quedan vistas antiguas por migrar. |
| Evidencia y regresión visual | Parcial | Se capturan shells públicos y de acceso administrativo por tema y viewport; falta promover las capturas aprobadas a baselines comparables y cubrir rutas autenticadas. |

## Sprint UX 0.2 — navegación y contexto

| Capacidad | Estado | Evidencia y trabajo restante |
|---|---|---|
| Navegación pública y administrativa coherente | Parcial | Comparten tokens, tema y reglas de accesibilidad, pero conservan arquitecturas de navegación adecuadas a cada audiencia. Falta revisión visual conjunta. |
| Breadcrumbs consistentes | Parcial | `PageHeader` ofrece el contrato común y ya fue adoptado por páginas prioritarias; quedan detalles y asistentes heredados. |
| Ámbito activo | Completado | El shell administrativo muestra alcance y la matriz E2E valida la etiqueta esperada por perfil. |
| Navegación móvil deliberada | Completado | Portal público y shell administrativo tienen navegación móvil propia, foco y cierre por teclado cubiertos. |
| Plantillas comunes de página | Parcial | Existe `PageHeader`, `data-ui="page-shell"` y primitivas de estado; falta migrar vistas heredadas y retirar el puente global de accesibilidad. |

## Sprint UX 0.3 — formularios y prevención de errores

| Capacidad | Estado | Evidencia y trabajo restante |
|---|---|---|
| Formularios y asistentes comunes | Parcial | Los asistentes de personas comparten progreso, servicios y estilos; no todos los formularios administrativos consumen las mismas primitivas. |
| Resumen navegable de errores | Pendiente | Hay mensajes locales y estados `role="alert"`, pero no un resumen común que lleve el foco al campo inválido. |
| Borradores reanudables | Pendiente | Los flujos conservan estado durante la sesión y los eventos tienen borrador canónico, pero no existe persistencia UX general de formularios incompletos. |
| Resumen de impacto | Parcial | Cargos, nombramientos y eventos muestran impacto en operaciones sensibles; falta el patrón compartido y su adopción total. |
| Personas y nombramientos en patrón común | Parcial | Servicios y fronteras de dominio están consolidados; la presentación todavía mezcla componentes comunes y estilos especializados. |

## Sprint UX 0.4 — directorios, fichas y confianza

| Capacidad | Estado | Evidencia y trabajo restante |
|---|---|---|
| Directorios y fichas coherentes | Parcial | Directorios y fichas públicas comparten contratos, metadata y navegación; falta revisión visual sistemática de todos los estados. |
| Búsqueda global | Parcial | Existe búsqueda canónica administrativa; falta definir el alcance de búsqueda pública para la primera versión. |
| Procedencia, actualización e historial | Parcial | Fichas y eventos exponen fuentes e historia canónica cuando existen; falta homogeneizar la presentación y los estados sin fuente. |
| Impresión y exportación básica | Pendiente | No existe todavía un contrato común de impresión ni exportación para fichas. |

## Sprint UX 0.5 — operación avanzada y validación

| Capacidad | Estado | Evidencia y trabajo restante |
|---|---|---|
| Tablas, revisión y centro de tareas | Parcial | `DataTable`, revisión y colas operativas existen; falta completar estados responsive y densidad de información. |
| Workspace de estructuras | Parcial | Configurador, árbol, detalle y servicios canónicos están implementados; falta validación visual y operativa multidiócesis. |
| Responsive, teclado y lector de pantalla | Parcial | Playwright cubre reflujo, teclado y Axe en rutas públicas; faltan lector de pantalla manual, zoom 400 %, touch y rutas autenticadas representativas. |
| Pruebas con usuarios representativos | Pendiente | Deben realizarse con perfiles nacional, diocesano, consulta y operación restringida. |

## Orden de cierre vigente

1. Capturar evidencia reproducible de los shells público y de acceso administrativo en claro y oscuro.
2. Aprobar baselines visuales y convertir la evidencia en comparaciones automáticas.
3. Ejecutar revisión visual autenticada con cuentas protegidas y datos representativos.
4. Migrar vistas heredadas a primitivas compartidas y retirar `LegacyAdminAccessibilityEnhancements` por secciones verificadas.
5. Implementar resumen navegable de errores y el patrón común de impacto.
6. Validar lector de pantalla, zoom 400 %, touch e impresión.
7. Ejecutar pruebas moderadas con usuarios representativos.

## Regla de prioridad

UX 0.1 sigue siendo P0 para ampliar la beta. Los bloques posteriores pueden coordinarse con el sprint funcional activo cuando exista una dependencia concreta, pero no deben fragmentar nuevamente el sistema de diseño ni convertir una comprobación automática parcial en aceptación operativa.
