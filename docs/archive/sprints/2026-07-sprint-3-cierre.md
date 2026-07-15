# Sprint 3 — Cierre técnico y pendientes operativos

> Estado: archivado; cierre técnico completado
> Fecha de cierre técnico: 2026-07-15
> Rama: `main`

## Objetivo alcanzado

Sprint 3 completó técnicamente el ciclo de acceso administrativo desde invitación hasta una sesión útil y restringida por rol y alcance, manteniendo Supabase Auth como sistema de identidad.

Se implementaron onboarding reanudable, contraseña inicial, presentación de rol y alcance efectivos sin autoasignación, recuperación completa de credenciales, resolución centralizada de entrada administrativa, bloqueo de perfiles suspendidos o inactivos, estados explícitos de invitación y onboarding y una matriz automatizada de perfiles.

## Contrato aplicado en Supabase no productivo

Se aplicaron las migraciones remotas de onboarding, entrada administrativa, validación de rol y alcance y progreso de onboarding. La comprobación confirmó las columnas y contratos esperados, `anon` sin ejecución administrativa y cero perfiles activos con onboarding incompleto después del backfill.

La matriz transaccional verificó:

| Perfil simulado | Resultado |
|---|---|
| Activo, onboarding completo y rol vigente | `ready` |
| Activo, onboarding incompleto | `onboarding` |
| Suspendido | `blocked` |
| Activo, onboarding completo y sin rol | `no_role` |

La simulación terminó con `ROLLBACK` y no conservó cambios de perfil ni asignaciones.

## Automatización

La matriz autenticada está en `e2e/admin-access-matrix.spec.mjs` y se ejecuta mediante `pnpm test:e2e:access` cuando existe `E2E_ACCESS_PROFILES_JSON`. La ejecución es de solo lectura y no sustituye la creación segura de cuentas separadas.

## Cierre técnico

El operador confirmó CI verde después de las correcciones UTF-8 y de la prueba contractual del flujo autenticado. La validación técnica incluyó auditorías de límites, typecheck, pruebas unitarias y contractuales y build de producción.

## Pendiente operativo S3-06

S3-06 no se considera cerrado operativamente hasta:

1. disponer de una URL pública o de beta autorizada;
2. configurar las URL permitidas de onboarding y recuperación;
3. disponer de cuentas no productivas separadas para `ready`, `onboarding`, `no_role` y `blocked`;
4. disponer de dos cuentas diocesanas con alcances mutuamente excluyentes;
5. ejecutar Playwright contra el entorno autorizado;
6. demostrar aislamiento bidireccional entre diócesis;
7. conservar evidencia de auditoría sin credenciales ni secretos;
8. ejecutar integración y E2E aplicables contra el entorno.

La protección contra contraseñas filtradas en Supabase Auth también continúa pendiente como control operativo de beta.

## Decisión de continuidad

El bloqueo restante es operativo y externo al código. Por esa dependencia, Sprint 4 puede continuar sin declarar cerrado S3-06.
