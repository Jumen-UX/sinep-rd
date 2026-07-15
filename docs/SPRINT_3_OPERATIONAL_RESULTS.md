# Sprint 3 â€” resultados operativos de acceso

> Entorno autorizado: Supabase no productivo `hrvgpceqaxujlttpimdz`  
> Fecha: 2026-07-15  
> Estado: contrato de base validado; recorrido web con cuentas diferenciadas pendiente

## Migraciones aplicadas

Se aplicaron en orden y como entradas independientes del historial remoto:

| VersiÃ³n remota | MigraciÃ³n |
|---|---|
| `20260715121326` | `user_onboarding_contract` |
| `20260715121336` | `admin_entry_access_contract` |
| `20260715121345` | `validate_admin_invitation_role_scope` |
| `20260715121354` | `admin_user_onboarding_progress` |

La comprobaciÃ³n posterior confirmÃ³:

- columnas `profiles.onboarding_step` y `profiles.onboarding_completed_at` presentes;
- lectores y escritores pÃºblicos de onboarding disponibles;
- contrato Ãºnico de entrada administrativa disponible;
- validaciÃ³n previa de rol y alcance disponible;
- lector administrativo del progreso disponible;
- `anon` sin ejecuciÃ³n sobre entrada ni escritura de onboarding;
- `authenticated` con ejecuciÃ³n Ãºnicamente sobre las fachadas previstas;
- cero perfiles activos con onboarding incompleto despuÃ©s del backfill.

## Matriz transaccional ejecutada

Se utilizÃ³ la cuenta superadministradora existente exclusivamente para simular estados dentro de una transacciÃ³n terminada con `ROLLBACK`. No se conservaron cambios de perfil ni de asignaciones.

Resultados comprobados mediante `get_my_admin_entry_context()`:

| Perfil simulado | Resultado |
|---|---|
| Activo, onboarding completo y rol vigente | `ready` |
| Activo, onboarding incompleto | `onboarding` |
| Suspendido | `blocked` |
| Activo, onboarding completo y sin rol vigente | `no_role` |

DespuÃ©s del rollback, la cuenta original volviÃ³ a `ready` con su rol vigente.

TambiÃ©n se verificÃ³ que `validate_admin_role_scope`:

- acepta `super_admin` con alcance nacional cuando el actor es superadministrador;
- acepta `diocesan_admin` con una diÃ³cesis dentro del alcance del actor;
- rechaza un alcance nacional acompaÃ±ado de una entidad concreta.

`admin_list_user_onboarding_progress` devolviÃ³ la cuenta visible con estado efectivo `ready`.

## Asesores

El asesor de seguridad reporta como advertencias las fachadas `SECURITY DEFINER` nuevas. Su exposiciÃ³n es intencional: `anon` no tiene ejecuciÃ³n, cada implementaciÃ³n privada valida `auth.uid()` y permisos, y los helpers privados permanecen revocados a clientes. Referencia del linter: [Signed-In Users Can Execute SECURITY DEFINER Function](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

ContinÃºa pendiente habilitar la [protecciÃ³n contra contraseÃ±as filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) en la configuraciÃ³n de Auth.

Los avisos de Ã­ndices sin uso son informativos en este entorno de poco trÃ¡fico; no justifican eliminar Ã­ndices antes de observar una carga representativa.

## Pendientes operativos

TodavÃ­a no se declara cerrado S3-06. Faltan:

1. configurar las URL exactas permitidas para onboarding y recuperaciÃ³n;
2. crear o suministrar cuentas separadas de la matriz operativa;
3. ejecutar el recorrido real de invitaciÃ³n, onboarding, login y recuperaciÃ³n en navegador;
4. demostrar aislamiento bidireccional entre dos diÃ³cesis;
5. guardar evidencias de auditorÃ­a sin secretos;
6. ejecutar integraciÃ³n y E2E aplicables contra este entorno.

## AutomatizaciÃ³n preparada

La matriz autenticada quedÃ³ automatizada en `e2e/admin-access-matrix.spec.mjs` y puede
ejecutarse mediante `pnpm test:e2e:access`. La ejecuciÃ³n es de solo lectura y queda
omitida si no existe `E2E_ACCESS_PROFILES_JSON`.

El workflow `CI` acepta ese valor Ãºnicamente como secreto del repositorio cuando se
ejecuta manualmente con una URL pÃºblica. Una matriz completa debe incluir, como mÃ­nimo:

- cuenta nacional lista;
- administrador diocesano A con la entidad B marcada como prohibida;
- administrador diocesano B con la entidad A marcada como prohibida;
- cuenta sin rol, bloqueada o con onboarding pendiente segÃºn el caso que se documente.

Esta automatizaciÃ³n no sustituye la creaciÃ³n segura de las cuentas ni convierte el
resultado transaccional previo en evidencia de navegador. S3-06 seguirÃ¡ abierto hasta
ejecutarla contra el entorno no productivo y conservar el reporte sin secretos.

La creaciÃ³n de cuentas debe realizarse mediante Supabase Auth Admin o la interfaz administrativa de SINEP; no se insertan usuarios directamente en tablas del esquema `auth`.

