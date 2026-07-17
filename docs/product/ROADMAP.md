# Hoja de ruta de SINEP RD

> Estado: vigente
> Actualizada: 2026-07-17
> Rama operativa: `main`
> Propietario: producto y arquitectura

## Estado consolidado

SINEP RD es candidata a beta interna. Los Sprints 0–6 están cerrados técnicamente. Sprint 3 conserva abierto únicamente el bloque operativo S3-06, que requiere cuentas diferenciadas y evidencia autenticada. El sprint funcional activo es Sprint 7 — Portal administrativo y experiencia de usuario.

La aplicación cuenta con identidad canónica de personas, dimensiones clericales, estructuras configurables, organización interna separada, permisos por alcance, auditoría, importaciones controladas, eventos históricos, portal público y compuertas de calidad en CI.

## Sprint activo

[Sprint 7 — Portal administrativo y experiencia de usuario](../sprints/active/sprint-7.md).

Estado: S7-01, S7-02, S7-03 y S7-04 están completados técnicamente. S7-05 está en progreso y normaliza encabezados, breadcrumbs, estados de carga/error/vacío, feedback y jerarquía visual de las pantallas administrativas. Las validaciones E2E autenticadas de navegación y la comprobación manual de KPIs con alcance restringido permanecen como deuda operativa explícita para S7-10.

## Programa transversal UX

[UX](./UX.md) define los criterios permanentes. [El backlog UX activo](../sprints/active/ux-backlog.md) mantiene la ejecución.

Los fundamentos P0 de UX —tokens, tema claro/oscuro/automático, acceso a herramientas de accesibilidad, contraste AA, componentes básicos y pruebas visuales de los shells— se ejecutan dentro de S7-05 a S7-10 y no como un sprint paralelo separado.

## Controles operativos de beta

Permanecen abiertos:

- [ ] Completar S3-06 con URL autorizada y cuentas diferenciadas.
- [ ] Reemplazar `E2E_ACCESS_PROFILES_JSON` por un arreglo JSON protegido, completo y válido.
- [ ] Ejecutar `E2E / Admin access matrix` y conservar evidencia sin secretos.
- [ ] Demostrar aislamiento bidireccional entre dos diócesis.
- [ ] Ejecutar el recorrido autenticado de invitación, onboarding, login y recuperación.
- [ ] Validar manualmente KPIs contextuales con al menos un perfil restringido real.
- [ ] Revisar funcionalmente las unidades organizativas antes de aprobarlas.
- [ ] Mantener publicación separada y selectiva después de la aprobación.
- [ ] Activar protección contra contraseñas filtradas en Supabase Auth.
- [ ] Verificar copias de seguridad y ejecutar una restauración documentada.
- [ ] Definir canal, severidad y responsables de incidentes de beta.
- [ ] Validar institucional y jurídicamente privacidad, cookies y aviso legal antes de apertura pública.

El portal público y su accesibilidad ya cuentan con una ejecución E2E verde sobre la línea actual de trabajo. La matriz autenticada no está fallando por código: su última ejecución se detuvo porque el secreto JSON estaba truncado. El workflow valida ahora ese formato antes de preparar el navegador.

## Orden vigente de ejecución

1. Continuar Sprint 7 desde S7-05 y cerrar la normalización visual representativa.
2. Completar S7-06 a S7-09: modo oscuro, herramientas de accesibilidad, responsive/teclado/foco/contraste y reducción de duplicación visual.
3. Reparar el secreto protegido y ejecutar la matriz E2E autenticada antes de S7-10.
4. Validar manualmente los KPIs restringidos y registrar la evidencia operativa.
5. Ejecutar S7-10 con pruebas visuales, accesibilidad, `pnpm check`, CI y cierre.
6. Revisar y aprobar de forma controlada unidades organizativas; publicar solo después y por separado.
7. Cerrar protección de credenciales, restauración y respuesta a incidentes.
8. Abrir una ronda limitada de beta interna con registro formal de incidencias.

## Importación controlada

El motor actual persiste lotes y filas, valida catálogos, alcance, duplicados y relaciones, permite corrección, revisión y revalidación y aplica personas, estructuras, nombramientos y eventos mediante contratos transaccionales e idempotentes.

Pendientes posteriores al cierre técnico de Sprint 6:

1. Evaluar lectura XLSX cuando exista una dependencia mantenida, segura y compatible.
2. Ampliar E2E al recorrido autenticado preparar → corregir → aprobar → aplicar.
3. Mantener bloqueada la reversión automática de creaciones que requieran semántica canónica específica.

## Condiciones para versión pública

No se promoverá una candidata pública mientras exista una incidencia P0/P1 abierta, una operación crítica sin auditoría o control de alcance, una migración pendiente en el entorno público, un flujo crítico sin prueba autenticada, un bloqueo de accesibilidad o ausencia de procedimientos de respaldo, restauración y respuesta a incidentes.

## Historial

Los cierres y evidencias terminados se mantienen en `docs/archive/sprints` o en los documentos de sprint marcados como completados. No deben usarse como estado actual ni duplicar esta hoja de ruta.
