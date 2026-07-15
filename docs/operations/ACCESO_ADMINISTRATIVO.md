# Operación del acceso administrativo

> Estado: vigente
> Última revisión: 2026-07-15
> Propietario: operación y seguridad

## Propósito

Verificar invitación, onboarding, recuperación, revocación y entrada administrativa sin depender de una lista rígida de migraciones históricas.

## Precondiciones

1. Confirmar que el entorno objetivo es no productivo o está autorizado para la prueba.
2. Confirmar que no existen migraciones pendientes para ese entorno.
3. Verificar la presencia de los contratos vigentes de onboarding, entrada administrativa, validación de rol y alcance y progreso de onboarding.
4. Confirmar las URL permitidas de invitación, onboarding y recuperación.
5. Preparar cuentas de prueba separadas; no reutilizar credenciales personales.

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

## Automatización

`pnpm test:e2e:access` ejecuta la matriz autenticada cuando existe `E2E_ACCESS_PROFILES_JSON`. La prueba es de solo lectura y debe ejecutarse contra una URL autorizada. Los secretos se configuran fuera del repositorio y nunca se copian a documentación o artefactos públicos.

## Evidencia

Conservar:

- fecha y entorno;
- commit probado;
- perfiles lógicos utilizados, sin contraseñas;
- resultado por escenario;
- referencias de auditoría no sensibles;
- reporte E2E;
- incidencias abiertas.

El cierre técnico de Sprint 3 no sustituye este recorrido operativo.
