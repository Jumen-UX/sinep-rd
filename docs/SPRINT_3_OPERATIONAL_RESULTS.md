# Sprint 3 — resultados operativos de acceso

> Entorno autorizado: Supabase no productivo `hrvgpceqaxujlttpimdz`  
> Fecha: 2026-07-15  
> Estado: contrato de base validado; recorrido web con cuentas diferenciadas pendiente

## Migraciones aplicadas

Se aplicaron en orden y como entradas independientes del historial remoto:

| Versión remota | Migración |
|---|---|
| `20260715121326` | `user_onboarding_contract` |
| `20260715121336` | `admin_entry_access_contract` |
| `20260715121345` | `validate_admin_invitation_role_scope` |
| `20260715121354` | `admin_user_onboarding_progress` |

La comprobación posterior confirmó:

- columnas `profiles.onboarding_step` y `profiles.onboarding_completed_at` presentes;
- lectores y escritores públicos de onboarding disponibles;
- contrato único de entrada administrativa disponible;
- validación previa de rol y alcance disponible;
- lector administrativo del progreso disponible;
- `anon` sin ejecución sobre entrada ni escritura de onboarding;
- `authenticated` con ejecución únicamente sobre las fachadas previstas;
- cero perfiles activos con onboarding incompleto después del backfill.

## Matriz transaccional ejecutada

Se utilizó la cuenta superadministradora existente exclusivamente para simular estados dentro de una transacción terminada con `ROLLBACK`. No se conservaron cambios de perfil ni de asignaciones.

Resultados comprobados mediante `get_my_admin_entry_context()`:

| Perfil simulado | Resultado |
|---|---|
| Activo, onboarding completo y rol vigente | `ready` |
| Activo, onboarding incompleto | `onboarding` |
| Suspendido | `blocked` |
| Activo, onboarding completo y sin rol vigente | `no_role` |

Después del rollback, la cuenta original volvió a `ready` con su rol vigente.

También se verificó que `validate_admin_role_scope`:

- acepta `super_admin` con alcance nacional cuando el actor es superadministrador;
- acepta `diocesan_admin` con una diócesis dentro del alcance del actor;
- rechaza un alcance nacional acompañado de una entidad concreta.

`admin_list_user_onboarding_progress` devolvió la cuenta visible con estado efectivo `ready`.

## Asesores

El asesor de seguridad reporta como advertencias las fachadas `SECURITY DEFINER` nuevas. Su exposición es intencional: `anon` no tiene ejecución, cada implementación privada valida `auth.uid()` y permisos, y los helpers privados permanecen revocados a clientes. Referencia del linter: [Signed-In Users Can Execute SECURITY DEFINER Function](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Continúa pendiente habilitar la [protección contra contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) en la configuración de Auth.

Los avisos de índices sin uso son informativos en este entorno de poco tráfico; no justifican eliminar índices antes de observar una carga representativa.

## Pendientes operativos

Todavía no se declara cerrado S3-06. Faltan:

1. configurar las URL exactas permitidas para onboarding y recuperación;
2. crear o suministrar cuentas separadas de la matriz operativa;
3. ejecutar el recorrido real de invitación, onboarding, login y recuperación en navegador;
4. demostrar aislamiento bidireccional entre dos diócesis;
5. guardar evidencias de auditoría sin secretos;
6. ejecutar integración y E2E aplicables contra este entorno.

La creación de cuentas debe realizarse mediante Supabase Auth Admin o la interfaz administrativa de SINEP; no se insertan usuarios directamente en tablas del esquema `auth`.
