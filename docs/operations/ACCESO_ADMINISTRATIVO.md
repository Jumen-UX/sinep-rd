# Operación del acceso administrativo

> Estado: vigente
> Última revisión: 2026-07-27
> Propietario: operación y seguridad

## Propósito

Verificar invitación, onboarding, recuperación, revocación y entrada administrativa sin depender de una lista rígida de migraciones históricas.

## Precondiciones

1. Confirmar que el entorno objetivo es no productivo o está autorizado para la prueba.
2. Confirmar que no existen migraciones pendientes para ese entorno.
3. Verificar la presencia de los contratos vigentes de onboarding, entrada administrativa, validación de rol y alcance y progreso de onboarding.
4. Confirmar las URL permitidas de invitación, onboarding y recuperación.
5. Preparar cuentas de prueba separadas; no reutilizar credenciales personales.
6. Confirmar el estado de los controles externos de Supabase Auth antes de registrar la evidencia.

## Matriz mínima

- usuario `ready` con rol vigente;
- usuario con onboarding incompleto;
- usuario autenticado sin rol;
- usuario suspendido o inactivo;
- administrador nacional;
- administrador diocesano A;
- administrador diocesano B con alcance mutuamente excluyente respecto de A;
- usuario restringido a parroquia o unidad cuando aplique.

## Recorrido

1. Enviar una invitación mediante el contrato o interfaz administrativa autorizada.
2. Abrir el enlace y completar onboarding.
3. Confirmar que el usuario ve rol y alcance efectivos sin poder modificarlos.
4. Cerrar sesión y verificar reanudación o entrada correcta.
5. Ejecutar recuperación de credenciales y establecer una nueva contraseña.
6. Verificar los estados `ready`, `onboarding`, `no_role` y `blocked`.
7. Demostrar que cada administrador diocesano puede operar dentro de su alcance y es rechazado fuera de él.
8. Confirmar auditoría de las operaciones sensibles.
9. Revocar o cerrar el rol de una cuenta de prueba y confirmar que la sesión ya no concede acceso administrativo útil.

## Política de contraseña

La aplicación aplica validación previa de longitud, variedad, espacios seguros, confirmación y fortaleza visual. Estos controles de interfaz no sustituyen las protecciones del proveedor de identidad.

Supabase Auth ofrece protección contra contraseñas conocidas como filtradas mediante la API de Pwned Passwords, pero la función solo está disponible en el plan Pro o superior. La organización que aloja `sinep-rd` se encuentra actualmente en plan Free; por eso el advisor mantiene la advertencia `auth_leaked_password_protection`.

Para cerrar este control debe ejecutarse una de estas decisiones:

1. actualizar la organización a Pro o superior, abrir **Authentication → Providers → Email** y activar la prevención de contraseñas filtradas;
2. mantener temporalmente el plan Free y registrar una aceptación de riesgo con responsable, motivo, controles compensatorios y fecha de revisión.

La ausencia de esta función no debe ocultarse ni marcarse como resuelta por cambios de frontend. Los controles compensatorios mínimos mientras permanezca bloqueada son:

- contraseña mínima de 12 caracteres en la aplicación;
- indicador de fortaleza y validación previa;
- recuperación de contraseña verificada;
- suspensión y revocación administrativa;
- recomendación explícita de no reutilizar contraseñas;
- evaluación de MFA para perfiles privilegiados.

Referencia operativa: [Password security — Supabase](https://supabase.com/docs/guides/auth/password-security).

## Automatización

`pnpm test:e2e:access` ejecuta la matriz autenticada cuando existe `E2E_ACCESS_PROFILES_JSON`. La prueba es de solo lectura y debe ejecutarse contra una URL autorizada. Los secretos se configuran fuera del repositorio y nunca se copian a documentación o artefactos públicos.

## Evidencia

Conservar:

- fecha y entorno;
- commit probado;
- perfiles lógicos utilizados, sin contraseñas;
- resultado por escenario;
- referencias de auditoría no sensibles;
- estado del advisor de seguridad de Supabase;
- plan y decisión sobre protección de contraseñas filtradas;
- reporte E2E;
- incidencias abiertas.

El cierre técnico de Sprint 3 no sustituye este recorrido operativo.
