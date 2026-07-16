# Plantillas de correo de autenticación — SINEP RD

Estas plantillas reproducen la línea gráfica aprobada para los correos de SINEP RD:

- encabezado negro `#111111`;
- acento amarillo `#ffbf00`;
- tarjeta blanca sobre fondo gris `#f4f4f5`;
- distintivo `SD`;
- tipografía Arial/Helvetica;
- contenido íntegramente en español.

## Plantillas de autenticación

| Archivo | Plantilla de Supabase | Asunto |
|---|---|---|
| `confirmation.html` | Confirm sign up | `SINEP RD | Confirma tu correo electrónico` |
| `invite.html` | Invite user | `SINEP RD | Invitación para crear tu cuenta` |
| `magic_link.html` | Magic link or OTP | `SINEP RD | Enlace seguro de acceso` |
| `email_change.html` | Change email address | `SINEP RD | Confirma tu nuevo correo electrónico` |
| `recovery.html` | Reset password | `SINEP RD | Restablece tu contraseña` |
| `reauthentication.html` | Reauthentication | `{{ .Token }} es tu código de verificación de SINEP RD` |

## Notificaciones de seguridad

| Archivo | Plantilla de Supabase | Asunto |
|---|---|---|
| `password_changed_notification.html` | Password changed | `SINEP RD | Tu contraseña fue cambiada` |
| `email_changed_notification.html` | Email address changed | `SINEP RD | Tu correo electrónico fue cambiado` |
| `phone_changed_notification.html` | Phone number changed | `SINEP RD | Tu número de teléfono fue cambiado` |
| `identity_linked_notification.html` | Sign-in method linked | `SINEP RD | Se vinculó un nuevo método de acceso` |
| `identity_unlinked_notification.html` | Sign-in method removed | `SINEP RD | Se eliminó un método de acceso` |
| `mfa_factor_enrolled_notification.html` | Verification method added | `SINEP RD | Se agregó un método de verificación` |
| `mfa_factor_unenrolled_notification.html` | Verification method removed | `SINEP RD | Se eliminó un método de verificación` |

## Instalación en el proyecto alojado

1. Abrir Supabase Dashboard.
2. Entrar a **Authentication → Email Templates**.
3. Seleccionar cada plantilla.
4. Copiar el asunto indicado en este documento.
5. Copiar el HTML del archivo correspondiente.
6. Guardar los cambios.
7. En **Security notifications**, habilitar individualmente las notificaciones que deban enviarse.

## Validación obligatoria

Probar cada flujo en Outlook y Gmail, escritorio y móvil. Verificar:

- asunto y remitente;
- nombre del usuario cuando `Data.full_name` esté disponible;
- enlaces y códigos;
- legibilidad en modo claro y oscuro;
- entrega fuera de correo no deseado;
- expiración y uso único de enlaces sensibles.

No debe habilitarse seguimiento de enlaces en el proveedor SMTP, porque puede reescribir los enlaces de autenticación. Algunos filtros de correo también pueden abrir enlaces antes que el usuario; si se detectan enlaces consumidos, el flujo deberá migrarse a OTP o a una página intermedia de confirmación.