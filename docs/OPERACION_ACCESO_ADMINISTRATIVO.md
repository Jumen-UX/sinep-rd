# Operación del acceso administrativo

Este procedimiento cubre invitación, primer acceso, recuperación, revocación y soporte. Debe ejecutarse primero en un proyecto Supabase no productivo con cuentas dedicadas; nunca se reutilizan credenciales personales ni se almacenan contraseñas en el repositorio.

## Preparación del entorno

1. Confirmar que `APP_BASE_URL` apunta al despliegue no productivo.
2. Autorizar en Supabase Auth las redirecciones hacia `/admin/onboarding` y `/admin/recuperar` para ese origen.
3. Aplicar y verificar, en este orden, las migraciones:
   - `20260714051000_user_onboarding_contract.sql`;
   - `20260714052000_admin_entry_access_contract.sql`;
   - `20260714053000_validate_admin_invitation_role_scope.sql`;
   - `20260714054000_admin_user_onboarding_progress.sql`.
4. Ejecutar `pnpm check` antes de iniciar la prueba autenticada.
5. Confirmar que el proyecto no productivo tiene dos diócesis o jurisdicciones independientes disponibles para la prueba de aislamiento.

La prueba se detiene si falta una migración, una URL de redirección, una cuenta diferenciada o un respaldo verificable del entorno.

## Matriz de cuentas

Preparar cuentas separadas para:

- superadministrador;
- administrador nacional;
- administrador diocesano A;
- administrador diocesano B;
- usuario restringido a parroquia o unidad;
- usuario autenticado sin rol;
- usuario suspendido o inactivo;
- invitado con onboarding incompleto.

Cada cuenta debe tener correo exclusivo, rol y alcance conocidos, y un responsable de la evidencia. Las cuentas A y B no pueden compartir asignaciones territoriales.

## Recorrido de invitación y primer acceso

1. Desde `/admin/usuarios/invitar`, elegir el rol y el alcance iniciales.
2. Revisar el resumen y marcar la confirmación explícita antes de enviar.
3. Abrir el enlace de invitación en una sesión de navegador aislada.
4. Confirmar que el destino es `/admin/onboarding`.
5. Completar perfil y contraseña inicial; cerrar sesión a mitad del flujo y verificar que el paso se reanuda.
6. Finalizar el onboarding y confirmar que una cuenta con rol llega a `/admin`.
7. Confirmar que una cuenta sin rol llega a `/admin/acceso` y no puede navegar a otras rutas administrativas.
8. Revisar en `/admin/usuarios` el estado de onboarding y el acceso efectivo.

## Aislamiento por alcance

Con los administradores diocesanos A y B:

1. consultar el mismo catálogo administrativo;
2. confirmar que A no puede leer ni mutar registros exclusivos de B;
3. confirmar la denegación inversa para B;
4. repetir una lectura y una escritura permitidas dentro de cada diócesis;
5. verificar que la auditoría conserva actor, permiso y entidad de alcance.

El administrador nacional y el superadministrador deben superar únicamente los controles previstos por sus roles; la prueba no debe otorgarles permisos adicionales de forma temporal.

## Recuperación y soporte

1. Iniciar recuperación desde `/admin/recuperar/solicitar`.
2. Confirmar que la respuesta no revela si el correo existe.
3. Abrir el enlace permitido y establecer una contraseña nueva de al menos 12 caracteres.
4. Confirmar el cierre de la sesión de recuperación y el acceso posterior mediante login normal.
5. Si el enlace expiró, reenviarlo desde administración; nunca comunicar una contraseña temporal por correo o mensajería.

El soporte puede confirmar estado, onboarding y asignaciones, pero no puede pedir contraseñas, copiar tokens ni alterar directamente tablas de Auth.

## Revocación y reactivación

Para retirar acceso:

1. cerrar la asignación activa del rol cuando el retiro sea por alcance o función;
2. usar `suspended` para un bloqueo reversible o `inactive` para una baja administrativa;
3. cerrar las sesiones desde Supabase Auth cuando el incidente lo requiera;
4. confirmar que la cuenta termina en `/admin/acceso` aunque conserve una cookie anterior;
5. revisar el registro auditado de la asignación, el cambio de estado y el actor.

La reactivación exige revisar primero el estado de la cuenta y después crear o restaurar una asignación válida. Nunca se reactiva modificando directamente `profiles` o `user_role_assignments` desde el cliente.

## Evidencia y criterio de cierre

Registrar por cada caso: fecha, entorno, commit, cuenta de prueba, rol, alcance, ruta esperada, ruta observada, operación permitida, operación denegada y referencias de auditoría. No incluir secretos ni tokens.

S3-06 se considera operativo solo cuando:

- el recorrido autenticado completo pasa en Supabase no productivo;
- se demuestra el aislamiento entre dos diócesis;
- recuperación, revocación y soporte quedan registrados;
- `pnpm check`, integración y E2E aplicables están en verde;
- las cuentas y datos temporales se eliminan o desactivan de forma auditada.
