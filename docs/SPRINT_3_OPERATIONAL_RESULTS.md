# Sprint 3 — resultados operativos de acceso

> Entorno autorizado: Supabase no productivo `hrvgpceqaxujlttpimdz`  
> Fecha de actualización: 2026-08-01  
> Estado: matriz y aislamiento completados; recorrido integral de invitación y recuperación pendiente

## Base técnica validada

Se aplicaron y verificaron las migraciones de onboarding, entrada administrativa, validación de rol y alcance y consulta de progreso. La comprobación confirmó:

- `profiles.onboarding_step` y `profiles.onboarding_completed_at` disponibles;
- contratos de lectura y escritura de onboarding operativos;
- entrada administrativa única mediante `get_my_admin_entry_context()`;
- validación previa de rol y alcance;
- consulta administrativa de progreso;
- `anon` sin permisos sobre entrada ni escritura de onboarding;
- `authenticated` limitado a las fachadas previstas.

La matriz transaccional original validó los estados `ready`, `onboarding`, `blocked` y `no_role` sin persistir cambios.

## Evidencia operativa completada posteriormente

S7-10 completó los componentes de S3-06 que dependían de cuentas diferenciadas y navegador real:

- aprovisionamiento protegido de cinco cuentas QA mediante Supabase Auth Admin;
- matriz autenticada con administrador, consulta, onboarding, sin rol y suspendido;
- aislamiento territorial bidireccional entre la Arquidiócesis del Ozama y la Diócesis de Monte Azul;
- validación de navegación y alcance;
- KPIs contextuales restringidos;
- evidencia visual administrativa en claro y oscuro;
- accesibilidad autenticada con Axe, teclado, foco y menú móvil;
- suspensión posterior de cuentas QA y retirada de roles;
- auditoría del ciclo de vida sin guardar contraseñas.

La evidencia canónica se conserva en `docs/sprints/active/sprint-7-s7-10-evidence.md`.

## Pendiente real de S3-06

S3-06 no requiere repetir la matriz ni conservar permanentemente `E2E_ACCESS_PROFILES_JSON`. El pendiente actual es el recorrido integral del ciclo de acceso:

1. confirmar las URL autorizadas de la aplicación para invitación, confirmación, onboarding y recuperación;
2. crear o reactivar cuentas QA diferenciadas con correos controlados;
3. enviar una invitación real y completar el alta desde el enlace recibido;
4. validar prevalidación de contraseña, establecimiento de contraseña y primer acceso;
5. completar onboarding y comprobar el estado administrativo resultante;
6. cerrar sesión y volver a iniciar sesión;
7. solicitar recuperación de contraseña, abrir el enlace recibido y establecer una contraseña nueva;
8. comprobar que los enlaces vencidos, reutilizados o manipulados fallen de forma segura;
9. conservar evidencia sin tokens, enlaces firmados, correos completos ni contraseñas;
10. suspender nuevamente las cuentas QA y retirar el secreto temporal al finalizar.

## Condiciones de seguridad

- No se insertan usuarios directamente en `auth.users`.
- Las cuentas técnicas usan dominio `.test` o `.invalid` y metadatos E2E.
- `SUPABASE_SERVICE_ROLE_KEY` permanece únicamente en el entorno protegido `qa`.
- `E2E_ACCESS_PROFILES_JSON` se crea solo durante una ronda de prueba y se elimina después.
- Las pruebas mutantes no se ejecutan contra producción.
- Las URL autorizadas deben coincidir exactamente con el entorno de beta que se valide.

## Criterio de cierre

S3-06 quedará completado cuando exista evidencia del recorrido invitación → contraseña → onboarding → login → recuperación en el entorno autorizado, incluyendo escenarios negativos de enlaces inválidos y limpieza posterior de cuentas y secretos.
