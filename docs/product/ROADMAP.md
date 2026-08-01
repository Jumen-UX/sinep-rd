# Hoja de ruta de SINEP RD

> Estado: vigente
> Actualizada: 2026-08-01
> Rama operativa: `main`
> Propietario: producto y arquitectura

## Estado consolidado

SINEP RD es candidata a beta interna. Los Sprints 0–7 están cerrados técnica y operativamente. Sprint 8 completó su alcance técnico de rendimiento, indexación, búsqueda, observabilidad y documentación.

La aplicación cuenta con identidad canónica de personas, dimensiones clericales, estructuras configurables, organización interna separada, permisos por alcance, auditoría, importaciones controladas, eventos históricos, portal público, portal administrativo consolidado, tema claro/oscuro/automático y compuertas de calidad en CI.

## Referencias vigentes

- [Sprint 7 — Portal administrativo y experiencia de usuario](../sprints/active/sprint-7.md): completado.
- [Evidencia S7-10](../sprints/active/sprint-7-s7-10-evidence.md): acceso, KPIs, visuales, accesibilidad y suspensión QA.
- [Sprint 8 — Rendimiento, indexación y salida mantenible](../sprints/active/sprint-8.md): alcance técnico completado.
- [Resultados operativos de Sprint 3](../SPRINT_3_OPERATIONAL_RESULTS.md): matriz completada; ciclo integral de acceso pendiente.

## Riesgo temporal aceptado

La protección automática frente a contraseñas filtradas no está disponible en el plan Free actual de Supabase. El riesgo fue aceptado temporalmente bajo controles compensatorios hasta el 2026-10-29 o hasta antes de cualquier apertura pública, lo que ocurra primero.

Registro canónico:

`docs/security/RISK_ACCEPTANCE_LEAKED_PASSWORD_PROTECTION.md`

## Controles operativos de beta pendientes

Permanecen abiertos:

- [ ] Completar S3-06 mediante el recorrido invitación → contraseña → onboarding → login → recuperación con URL autorizada y cuentas diferenciadas.
- [ ] Validar enlaces vencidos, reutilizados y manipulados con fallo seguro.
- [ ] Revisar funcionalmente las unidades organizativas antes de aprobarlas.
- [ ] Mantener publicación separada y selectiva después de la aprobación.
- [ ] Verificar copias de seguridad y ejecutar una restauración documentada.
- [ ] Definir canal, severidad y responsables de incidentes de beta.
- [ ] Validar institucional y jurídicamente privacidad, cookies y aviso legal antes de apertura pública.
- [ ] Revisar o resolver la aceptación temporal del riesgo de contraseñas filtradas.
- [ ] Confirmar post-despliegue metadata `noindex`, robots restrictivo y sitemap vacío durante beta.

La matriz administrativa autenticada, el aislamiento territorial, los KPIs restringidos, la evidencia visual, la accesibilidad administrativa y el ciclo de suspensión QA ya están cerrados con evidencia y no deben repetirse salvo regresión o nueva ronda planificada.

## Orden vigente de ejecución

1. Completar S3-06 y el ciclo real de acceso en el entorno de beta autorizado.
2. Verificar respaldo, restauración y respuesta a incidentes.
3. Completar validación institucional y jurídica.
4. Revisar funcionalmente las unidades organizativas y la publicación selectiva.
5. Resolver o revisar los riesgos temporales antes de la apertura pública.
6. Ejecutar una revisión final de beta con CI, E2E, salud, metadata, robots y sitemap.
7. Activar la publicación únicamente mediante aprobación explícita y verificación posterior al despliegue.

## Importación controlada

El motor actual persiste lotes y filas, valida catálogos, alcance, duplicados y relaciones, permite corrección, revisión y revalidación y aplica personas, estructuras, nombramientos y eventos mediante contratos transaccionales e idempotentes.

Pendientes posteriores al cierre técnico de Sprint 6:

1. Evaluar lectura XLSX cuando exista una dependencia mantenida, segura y compatible.
2. Ampliar E2E al recorrido autenticado preparar → corregir → aprobar → aplicar.
3. Mantener bloqueada la reversión automática de creaciones que requieran semántica canónica específica.

## Condiciones para versión pública

No se promoverá una candidata pública mientras exista una incidencia P0/P1 abierta, una operación crítica sin auditoría o control de alcance, una migración pendiente en el entorno público, un flujo crítico sin prueba autenticada, un bloqueo de accesibilidad o ausencia de procedimientos de respaldo, restauración y respuesta a incidentes.

La indexación pública requiere aprobación doble y verificación de metadata, robots, sitemap y canonical después del despliegue.

## Historial

Los cierres y evidencias terminados permanecen en los documentos de sprint marcados como completados o en `docs/archive/sprints`. No deben duplicar ni contradecir esta hoja de ruta.
