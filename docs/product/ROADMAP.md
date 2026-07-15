# Hoja de ruta de SINEP RD

> Estado: vigente
> Actualizada: 2026-07-15
> Rama operativa: `main`
> Propietario: producto y arquitectura

## Estado consolidado

SINEP RD es candidata a beta interna. Los Sprints 0, 1 y 2 están cerrados técnicamente. Sprint 3 tiene cierre técnico completado y mantiene abierto el bloque operativo S3-06. El sprint funcional activo es Sprint 4 — Personas, cargos y nombramientos.

La aplicación cuenta con identidad canónica de personas, dimensiones clericales, estructuras configurables, organización interna separada, permisos por alcance, auditoría, importaciones controladas, eventos históricos, portal público y compuertas de calidad en CI.

## Sprint activo

[Sprint 4 — Personas, cargos y nombramientos](../sprints/active/sprint-4.md).

Estado: S4-01 y S4-02 completados. El siguiente bloque es S4-03: aplicar el asistente común de identidad a obispos, sacerdotes, diáconos, religiosos y laicos.

## Programa transversal UX

[UX](./UX.md) define los criterios permanentes. [El backlog UX activo](../sprints/active/ux-backlog.md) mantiene la ejecución.

UX 0.1 es P0 antes de ampliar la beta: tokens, tema claro/oscuro/automático, botón flotante de accesibilidad, contraste AA, componentes básicos y pruebas visuales de los shells.

## Controles operativos de beta

Permanecen abiertos:

- [ ] Ejecutar integración contra Supabase no productivo.
- [ ] Completar S3-06 con URL autorizada y cuentas diferenciadas.
- [ ] Demostrar aislamiento bidireccional entre dos diócesis.
- [ ] Ejecutar el recorrido autenticado de los flujos administrativos críticos.
- [ ] Revisar funcionalmente las 192 unidades organizativas antes de aprobarlas.
- [ ] Mantener publicación separada y selectiva después de la aprobación.
- [ ] Activar protección contra contraseñas filtradas en Supabase Auth.
- [ ] Verificar copias de seguridad y ejecutar una restauración documentada.
- [ ] Definir canal, severidad y responsables de incidentes de beta.
- [ ] Validar institucional y jurídicamente privacidad, cookies y aviso legal antes de apertura pública.

## Orden vigente de ejecución

1. Continuar Sprint 4 desde S4-03, sin reabrir Sprints 1–3 por trabajo ya cerrado técnicamente.
2. Ejecutar en paralelo UX 0.1 porque es condición P0 de ampliación de beta.
3. Resolver S3-06 cuando estén disponibles la URL autorizada y las cuentas diferenciadas.
4. Ejecutar integración y recorrido administrativo autenticado contra entorno no productivo.
5. Revisar y aprobar de forma controlada unidades organizativas; publicar solo después y por separado.
6. Cerrar protección de credenciales, restauración y respuesta a incidentes.
7. Abrir una ronda limitada de beta interna con registro formal de incidencias.
8. Retomar prioridades funcionales posteriores y operaciones `update` de importación según la cola vigente.

## Importación controlada

El motor actual persiste lotes y filas, valida catálogos, alcance, duplicados y relaciones, permite corrección, revisión y revalidación y aplica personas, estructuras, nombramientos y eventos mediante contratos transaccionales e idempotentes.

Pendientes:

1. Completar operaciones `update` con comparación visible y aprobación explícita en los dominios que deban admitir actualización.
2. Añadir un identificador estable para habilitar `noop` seguro en personas.
3. Evaluar lectura XLSX.
4. Ampliar E2E al recorrido autenticado preparar → corregir → aprobar → aplicar.

## Condiciones para versión pública

No se promoverá una candidata pública mientras exista una incidencia P0/P1 abierta, una operación crítica sin auditoría o control de alcance, una migración pendiente en el entorno público, un flujo crítico sin prueba autenticada, un bloqueo de accesibilidad o ausencia de procedimientos de respaldo, restauración y respuesta a incidentes.

## Historial

Los cierres y evidencias terminados se mantienen en `docs/archive/sprints`. No deben usarse como estado actual ni duplicar esta hoja de ruta.
