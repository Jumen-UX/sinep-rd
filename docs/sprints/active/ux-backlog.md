# Backlog UX activo

> Estado: backlog vigente
> Última revisión: 2026-08-01
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
| Evidencia y regresión visual | Parcial | Los shells públicos y de acceso tienen comparaciones bloqueantes de sus regiones estables en claro y oscuro, móvil, tableta y escritorio. Las páginas completas se conservan como evidencia diagnóstica; falta cubrir rutas autenticadas. |

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
| Resumen navegable de errores | Parcial | `FormErrorSummary` existe como contrato común y fue validado en el piloto laico; falta adoptarlo en los demás formularios críticos. |
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

1. Ejecutar revisión visual autenticada con cuentas protegidas y datos representativos.
2. Ampliar los baselines a superficies autenticadas estables, enmascarando datos personales y variables.
3. Migrar vistas heredadas a primitivas compartidas y retirar `LegacyAdminAccessibilityEnhancements` por secciones verificadas.
4. Implementar resumen navegable de errores y el patrón común de impacto.
5. Validar lector de pantalla, zoom 400 %, touch e impresión.
6. Ejecutar pruebas moderadas con usuarios representativos.


## Auditoría UX integral — diagnóstico formal 2026-08-01

### Alcance y límites de la evidencia

La auditoría cubrió propósito, perfiles inferidos, arquitectura de información, navegación, jerarquía visual, formularios, estados, prevención de errores, listados, responsive, accesibilidad, microcopy, rendimiento percibido y adopción de primitivas compartidas.

Se inspeccionaron el backlog vigente, la guía UX, el sistema de diseño y código representativo de componentes y pantallas. Los perfiles de público general, personal pastoral, administrador diocesano, administrador nacional, investigador y editor son inferencias que deben validarse con usuarios reales.

Esta auditoría no modifica procesos de negocio ni acredita resultados de CI, pruebas con tecnologías de asistencia o métricas de uso. Un estado **Diagnosticado** indica evidencia de revisión, no implementación ni validación operativa.

### Diagnóstico ejecutivo

SINEP RD cuenta con una base sólida de tokens, shell administrativo autorizado, encabezados, estados, tablas, botones, badges y pruebas iniciales. La deuda principal es convertir esa biblioteca visual parcialmente adoptada en un sistema de interacción consistente:

1. Preservar el contexto eclesial y administrativo.
2. Unificar prevención y recuperación de errores.
3. Diferenciar carga, vacío, sin resultados, permiso y sesión.
4. Mostrar impacto antes de operaciones sensibles.
5. Diseñar asistentes y listados con comportamiento móvil deliberado.
6. Completar adopción, validación autenticada y pruebas con usuarios.

No se recomienda un rediseño visual masivo. La implementación debe ser progresiva, basada en contratos compartidos y pilotos verificables.

### Hallazgos formalizados

| ID | Prioridad | Superficie | Problema y consecuencia | Solución propuesta | Riesgo | Esfuerzo | Estado |
|---|---|---|---|---|---|---|---|
| UX-AUD-001 | P0 | Transversal | La adopción de primitivas es desigual; una migración sin inventario puede duplicar contratos. | Mantener matriz ruta × shell × header × estado × tabla/formulario × pruebas. | Bajo | Medio | Diagnosticado |
| UX-FORM-001 | P0 | Formularios | La adopción del resumen común todavía no cubre todos los flujos críticos. | Ampliar progresivamente `FormErrorSummary`, ya validado en el piloto laico. | Medio | Medio | Parcial: contrato y piloto validados |
| UX-STATE-001 | P0 | Transversal | Carga, vacío y ausencia de resultados pueden compartir una presentación y recuperación ambiguas. | Definir contratos explícitos para carga, vacío, sin resultados y error recuperable. | Bajo | Medio | Pendiente |
| UX-STATE-002 | P1 | Administración | Sin rol, sin ámbito, permiso insuficiente, sesión vencida y configuración faltante requieren mensajes y acciones distintas. | Crear patrones específicos, sin convertirlos en variantes visuales indistinguibles. | Medio | Medio | Pendiente |
| UX-IMPACT-001 | P0 | Nombramientos, eventos, estructuras e importaciones | El resumen de impacto existe de forma especializada, no como contrato común. | Definir datos mínimos, consecuencias, registros afectados, fuente y confirmación. | Medio | Medio-alto | Parcial |
| UX-WIZ-001 | P0 | Asistentes | `AdminWizardProgress` es el patrón activo en cinco asistentes de personas; eventos mantiene una segunda familia y `WizardShell` no tiene consumidores detectados. | Consolidar sobre el patrón adoptado y evitar una tercera familia de asistentes. | Medio | Medio | Inventario completado |
| UX-WIZ-002 | P0 | Asistentes | La experiencia móvil compacta todavía no se adoptó en todos los asistentes. | Ampliar el modo compacto opt-in de `AdminWizardProgress`, validado contractualmente en el piloto laico, y completar revisión manual a 320 y 390 px. | Medio | Medio | Parcial: piloto automatizado validado |
| UX-DRAFT-001 | P0 | Formularios largos | No existe política general de borradores según sensibilidad. | Definir persistencia en sesión o servidor; no usar almacenamiento local para datos sensibles sin evaluación de seguridad. | Alto | Alto | Pendiente |
| UX-LIST-001 | P1 | Listados | El desplazamiento horizontal contenido no resuelve todos los listados móviles. | Clasificar cuándo usar tabla, lista responsive, tarjetas o detalle expandible. | Medio | Medio | Pendiente |
| UX-PERSON-001 | P0 | Personas | Filtros y accesos duplicados elevan carga cognitiva y tabulaciones. | Consolidar una representación adaptable y mantener una acción primaria. | Medio | Medio | Diagnosticado |
| UX-PERSON-002 | P0 | Personas | Búsqueda y filtros locales pueden perderse al recargar o volver desde una ficha. | Sincronizar filtros relevantes con URL y preservar contexto. | Medio | Medio | Diagnosticado |
| UX-PERSON-003 | P0 | Personas y calidad de datos | Inferir “activa” por “no fallecida” mezcla estado personal y ministerial. | Validar taxonomía canónica antes de cambiar etiquetas o filtros. | Alto | Medio-alto | Requiere validación funcional |
| UX-SHELL-001 | P1 | Shell administrativo | Existe un shell residual sin consumidor detectado. | Confirmar por búsqueda, build y pruebas; eliminarlo solo con evidencia. | Medio | Bajo | Diagnosticado |
| UX-A11Y-001 | P0 | Navegación móvil | El diálogo administrativo demuestra foco inicial y retorno, pero falta evidencia de ciclo completo de Tab y Shift+Tab. | Verificar o implementar focus trap y añadir prueba. | Bajo | Bajo-medio | Pendiente |
| UX-VALID-001 | P0 | Rutas autenticadas | La evidencia automática no cubre todos los estados, roles y datos representativos. | Ejecutar matriz autenticada, Axe, teclado, 320 px, zoom 400 %, touch y revisión manual. | Bajo | Alto | Pendiente |
| UX-RESEARCH-001 | P0 antes de cierre UX | Producto | Los perfiles y tareas frecuentes aún no están validados con usuarios representativos. | Pruebas moderadas con perfiles nacional, diocesano, consulta y operación restringida. | Bajo | Alto | Pendiente |

### Flujos prioritarios

| Flujo | Situación observada | Objetivo verificable |
|---|---|---|
| Buscar y administrar una persona | La ruta combina dashboard, accesos, filtros y listado; el contexto no está garantizado en URL. | Encontrar un registro sin duplicación de controles y regresar desde su ficha conservando búsqueda y filtros. |
| Crear una persona | Los asistentes comparten partes del dominio, pero no se ha demostrado un shell interactivo común. | Prevenir duplicados, conservar datos válidos, resumir errores y revisar antes de crear. |
| Registrar un nombramiento | Cargo, titular, vigencia e impacto histórico requieren explicación previa. | Mostrar titular vigente, consecuencia de sustitución, fechas y fuente antes de confirmar. |
| Configurar estructura | Árbol, propiedades y operaciones históricas tienen distinta gravedad. | Separar edición ordinaria de reorganización y operar completamente por teclado. |
| Importar datos | Errores, advertencias, duplicados y aplicación parcial no son equivalentes. | Corregir o reintentar filas fallidas y obtener un reporte verificable. |
| Consultar ficha pública | La confianza depende de contexto, vigencia y procedencia. | Distinguir dato vigente, histórico, no verificado y no publicado cerca del dato afectado. |

### Matriz de adopción inicial

| Primitiva | Adopción observada | Decisión |
|---|---|---|
| `PageHeader` | Media-alta en módulos prioritarios. | Conservar; gobernar breadcrumbs, metadata y jerarquía de acciones. |
| `PageState` | Media. | Corregir contrato antes de ampliar adopción. |
| `DataTable` | Baja y localizada. | Mantener como tabla semántica; no forzarla en listados orientados a registros. |
| `WizardShell` | Sin consumidores detectados mediante búsqueda de código. | No extender hasta comparar asistentes reales. |
| `Button` | Base madura. | Preparar estado loading e `IconButton` accesible en un lote posterior o compatible. |
| `Alert` | Base madura. | Separar tono visual de comportamiento de anuncio. |
| `StatusBadge` | Base madura. | Definir catálogo semántico de estados y tonos. |

## Lote UX-1 — contratos compartidos (preparación)

### Objetivo

Preparar contratos transversales verificables antes de migrar pantallas completas. La preparación no autoriza cambios de negocio ni migraciones masivas.

### Alcance propuesto

| ID | Contrato | Archivos candidatos | Dependencias | Criterios de aceptación |
|---|---|---|---|---|
| UX1-01 | Resumen navegable de errores | `src/components/ui/form-error-summary.tsx` y formulario piloto por definir | Inventario de asistentes | Cuenta errores; enlaces únicos; mueve foco; conserva datos; mensaje junto al campo; anuncio accesible; prueba de teclado. |
| UX1-02 | Estados explícitos | `src/components/ui/page-state.tsx` y componentes hermanos si corresponde | Ninguna | Carga no parece vacío; sin resultados conserva filtros; error explica recuperación; API no favorece mensajes genéricos. |
| UX1-03 | Botón en carga | `src/components/ui/button.tsx` | Compatibilidad con consumidores | `loading`, etiqueta accesible, `aria-busy`, evita doble envío y conserva ancho razonable. |
| UX1-04 | Alertas anunciables | `src/components/ui/alert.tsx` | UX1-02 | El tono no fuerza región viva; anuncio `off/polite/assertive`; acciones estructuradas cuando apliquen. |
| UX1-05 | Asistente común | `src/components/ui/wizard-shell.tsx` o contrato real que resulte de UX-WIZ-001 | UX-WIZ-001, UX1-01 | Indicadores no interactivos no son botones deshabilitados; pasos bloqueados explican razón; móvil compacto; resumen editable; errores integrables. |
| UX1-06 | Evidencia de accesibilidad | pruebas unitarias/contractuales y E2E afectadas | UX1-01 a UX1-05 | Teclado, Axe, 320/390 px, claro/oscuro; resultados registrados sin extrapolar a toda la aplicación. |


### Resultado del inventario de asistentes actuales

#### Familia A — asistentes de personas

Los asistentes de sacerdote, obispo, diácono, vida consagrada y laico usan el componente compartido `src/components/admin/AdminWizardProgress.tsx`. El patrón real incluye:

- estado de paso controlado por cada página;
- progreso porcentual y semántica `progressbar`;
- pasos alcanzables mediante `maxReachableStep`;
- pasos no alcanzables renderizados como contenido no interactivo;
- navegación hacia pasos permitidos;
- reutilización de `PersonIdentityStep` para buscar una identidad antes de crear otra;
- validación y mensajes de error locales en cada página;
- resumen y layout especializados por dominio;
- guardado de borrador en `localStorage` únicamente en el asistente de sacerdote.

Consumidores confirmados:

- `src/features/clero/priest/admin/PriestWizardPage.tsx`;
- `src/features/clero/bishop/admin/BishopWizardPage.tsx`;
- `src/features/clero/deacon/admin/DeaconWizardPage.tsx`;
- `src/features/vida-consagrada/religious/admin/ReligiousWizardPage.tsx`;
- `src/features/personas/lay/admin/LayPersonWizardPage.tsx`.

#### Familia B — asistente de eventos

`src/features/events/admin/EventDraftPage.tsx` implementa pasos, navegación, impacto y previsualización con clases y estado locales (`assistant-stepper`, `step-card`). No consume `AdminWizardProgress` ni `WizardShell`.

#### Primitiva no adoptada

`src/components/ui/wizard-shell.tsx` define navegación, layout y resumen, pero no se encontraron consumidores. Parte de su contrato está superpuesto por `AdminWizardProgress`, que ya resuelve mejor:

- progreso explícito;
- máximo paso alcanzable;
- elementos no interactivos cuando un paso no puede abrirse;
- evidencia automática específica.

#### Decisión de preparación

El Lote UX-1 no debe extender `WizardShell` de forma aislada. La dirección propuesta es:

1. conservar `AdminWizardProgress` como base de navegación adoptada;
2. extraer contratos composables para resumen de errores, estados, resumen editable y footer;
3. decidir mediante un piloto si `WizardShell` se convierte en layout compuesto alrededor de `AdminWizardProgress` o se retira posteriormente;
4. migrar eventos solo después de demostrar compatibilidad, sin mezclar esa migración con los contratos base;
5. evaluar seguridad antes de generalizar el borrador de sacerdote, porque contiene datos personales.

### Lote UX-1 listo para implementación

#### Corte 1A — contratos sin migración de dominio

> Estado: implementado y validado mediante `pnpm check` en CI.

- `FormErrorSummary` compartido en `src/components/ui/form-error-summary.tsx`.
- Estados explícitos `loading`, `error`, `empty` y `no-results` en `PageState`.
- Estado `loading` compatible en `Button`, con prevención de doble envío para botones nativos.
- Anuncios `off`, `polite` y `assertive` configurables en `Alert`, independientes del tono.
- Acciones estructuradas en errores de página y alertas.
- Pruebas contractuales en `tests/ux-shared-contracts.test.mjs` y actualización de la jerarquía de estados.

La ejecución posterior de `pnpm check` completó documentación, auditorías, TypeScript, pruebas, build y auditoría de bundles. Esta evidencia valida los contratos automatizados de UX-1A, pero no sustituye revisión manual autenticada, lector de pantalla, zoom ni touch.

#### Corte 1B — piloto en un asistente de personas

> Estado: implementado y validado mediante `pnpm check` en CI; validación manual autenticada pendiente.

El piloto usa `LayPersonWizardPage`, porque consume la familia canónica, no contiene la bifurcación diaconal/sacerdotal y permite probar identidad existente o nueva, validación, servicio y revisión.

Implementado:

- `FormErrorSummary` para persona existente, primer nombre y primer apellido;
- identificadores estables y navegación de foco hacia controles inválidos;
- limpieza del resumen cuando el usuario corrige datos;
- estado loading común en el envío final;
- progreso móvil compacto opt-in mediante `AdminWizardProgress`;
- resumen editable mediante las acciones “Cambiar” ya existentes;
- persistencia y servicios canónicos sin cambios;
- pruebas contractuales actualizadas para el piloto y el progreso móvil.

La ejecución CI del commit `1dbfe4de` finalizó satisfactoriamente el 2026-08-01 en 1 min 37 s. La evidencia observada confirma la canalización aplicable después de actualizar las pruebas contractuales del callback de identidad. Esta evidencia automatizada no sustituye la revisión manual autenticada, lector de pantalla, zoom ni touch.

Validación manual pendiente:

- recorrido completo con identidad existente y nueva;
- foco real al primer campo inválido con teclado y lector de pantalla;
- reflujo a 320 y 390 px;
- temas claro y oscuro;
- conservación de datos válidos durante corrección y retorno entre pasos.

No se introdujo persistencia de borrador; esa capacidad continúa condicionada al cierre de UX-DRAFT-001.

#### Corte 1C — decisión de convergencia

Con evidencia del piloto:

- mantener `WizardShell` como layout compuesto, o
- retirar `WizardShell` si no aporta un contrato diferencial.

La decisión se documentará antes de migrar los otros cuatro asistentes o el flujo de eventos.

#### Comandos de verificación previstos

La implementación futura deberá ejecutar, como mínimo, los chequeos afectados que determine el repositorio, además de typecheck y las pruebas específicas de asistentes. `pnpm check` solo podrá declararse verde si se ejecuta completo y termina satisfactoriamente. La revisión manual autenticada, lector de pantalla, zoom y touch permanecen como evidencia separada.

### Exclusiones del lote

- Cambios de taxonomía o reglas de negocio.
- Persistencia de borradores sensibles.
- Rediseño completo de personas, nombramientos o estructuras.
- Eliminación del shell residual.
- Declaración de CI verde sin ejecutar y observar la canalización aplicable.
- Aceptación operativa basada únicamente en pruebas automáticas.

### Secuencia interna condicionada

1. Identificar asistentes reales y elegir piloto.
2. Definir el contrato de errores y estados.
3. Implementar contratos compatibles de botón y alerta.
4. Adaptar o sustituir `WizardShell` según la evidencia del inventario.
5. Integrar un formulario piloto.
6. Ejecutar pruebas afectadas y documentar resultados.
7. Solo entonces ampliar adopción.


## Regla de prioridad

UX 0.1 sigue siendo P0 para ampliar la beta. Los bloques posteriores pueden coordinarse con el sprint funcional activo cuando exista una dependencia concreta, pero no deben fragmentar nuevamente el sistema de diseño ni convertir una comprobación automática parcial en aceptación operativa.
