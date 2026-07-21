# Hoja de ruta de SINEP RD

> Estado: vigente
> Actualizada: 2026-07-20
> Rama operativa: `main`
> Propietario: producto y arquitectura

## Estado consolidado

SINEP RD es candidata a beta interna. Los Sprints 0–6 están cerrados técnicamente. Sprint 7 completó S7-01 a S7-09; S7-10 permanece diferido por decisión operativa y conserva separadas sus validaciones autenticadas, visuales y de cierre.

La aplicación cuenta con identidad canónica de personas, dimensiones clericales, estructuras configurables, organización interna separada, permisos por alcance, auditoría, importaciones controladas, eventos históricos, portal público, portal administrativo consolidado, tema claro/oscuro/automático y compuertas de calidad en CI.

## Sprint activo

[Sprint 8 — Rendimiento, indexación y salida mantenible](../sprints/active/sprint-8.md).

Estado: S8-01 a S8-10 completados y validados técnicamente. El documento de Sprint 8 permanece como referencia activa hasta autorizar el siguiente frente. Este cierre no absorbe S7-10 ni los controles operativos de beta.

## Sprint 7

[Sprint 7 — Portal administrativo y experiencia de usuario](../sprints/active/sprint-7.md).

- S7-01 a S7-09: completadas y confirmadas por CI.
- S7-10: diferida.
- La deuda operativa autenticada y de cierre se mantiene explícita y no se considera resuelta por iniciar Sprint 8.

## Controles operativos de beta diferidos

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

El portal público y su accesibilidad conservan cobertura E2E. El workflow separa los contratos de beta privada e indexación habilitada; ambas variantes quedaron aprobadas en [E2E / Public accessibility #79](https://github.com/Jumen-UX/sinep-rd/actions/runs/29866854822). El mismo estado quedó respaldado por [CI #1773](https://github.com/Jumen-UX/sinep-rd/actions/runs/29866854893). La matriz autenticada permanece diferida y no debe ejecutarse contra producción.

## Orden vigente de ejecución

1. Mantener S7-10 diferido hasta nueva instrucción y conservar separados los controles operativos de beta hasta contar con evidencia real.
2. Definir el siguiente frente técnico u operativo antes de iniciar otro sprint.

## Importación controlada

El motor actual persiste lotes y filas, valida catálogos, alcance, duplicados y relaciones, permite corrección, revisión y revalidación y aplica personas, estructuras, nombramientos y eventos mediante contratos transaccionales e idempotentes.

Pendientes posteriores al cierre técnico de Sprint 6:

1. Evaluar lectura XLSX cuando exista una dependencia mantenida, segura y compatible.
2. Ampliar E2E al recorrido autenticado preparar → corregir → aprobar → aplicar.
3. Mantener bloqueada la reversión automática de creaciones que requieran semántica canónica específica.

## Condiciones para versión pública

No se promoverá una candidata pública mientras exista una incidencia P0/P1 abierta, una operación crítica sin auditoría o control de alcance, una migración pendiente en el entorno público, un flujo crítico sin prueba autenticada, un bloqueo de accesibilidad o ausencia de procedimientos de respaldo, restauración y respuesta a incidentes.

## Historial

Los cierres y evidencias terminados se mantienen en `docs/archive/sprints` o en documentos de sprint marcados como completados. No deben usarse como estado actual ni duplicar esta hoja de ruta.
