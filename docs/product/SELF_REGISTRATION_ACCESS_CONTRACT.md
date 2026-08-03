# Contrato de autorregistro y solicitud de acceso

Estado: Propuesto
Fecha: 2026-08-03
Responsable funcional: Producto / Acceso
Responsable técnico: Arquitectura / Seguridad

## Objetivo

Definir el contrato mínimo para permitir autorregistro controlado sin duplicar la infraestructura existente de perfiles, onboarding, roles y ámbitos.

## Capacidades existentes que se reutilizan

- `auth.users` como identidad de autenticación.
- `public.profiles` como perfil de acceso.
- Trigger `app_private.handle_new_auth_user_profile()` para crear o sincronizar el perfil.
- Estados administrativos existentes: `pending_invitation`, `active`, `suspended`, `inactive`.
- Onboarding existente en `profiles`: `onboarding_step`, `onboarding_completed_at`, `onboarding_updated_at`.
- `public.user_role_assignments` como única fuente de roles y ámbitos.
- `public.user_country_memberships` para contexto nacional.
- `public.audit_logs` para operaciones relevantes.

No se crearán tablas paralelas de usuario, rol, ámbito ni persona.

## Separación de dominios

### Cuenta de autenticación

Responsable de correo, contraseña, verificación y sesiones. Vive en `auth.users`.

### Perfil de acceso

Responsable de nombre mostrado, teléfono, estado de la cuenta y avance de onboarding. Vive en `public.profiles`.

### Persona eclesial

Responsable de identidad canónica, trayectoria, nombramientos y datos eclesiales. Vive en `public.persons`.

### Colaborador editorial

Se representa mediante asignaciones de rol y ámbito. No será una tabla separada.

### Solicitud de acceso

Representa la petición del usuario para recibir acceso y contexto editorial. Debe ser independiente de la asignación efectiva.

## Extensiones mínimas de `profiles`

Se propone añadir únicamente:

- `person_id uuid null references public.persons(id)`
- `registration_source text not null default 'invitation'`
- `preferred_locale text null`
- `timezone text null`
- `avatar_url text null`
- `terms_accepted_at timestamptz null`
- `privacy_accepted_at timestamptz null`

Reglas:

- `person_id` debe ser único cuando no sea nulo.
- El propio usuario no puede vincularse directamente a una persona.
- La vinculación debe pasar por revisión administrativa.
- `registration_source` admite inicialmente `invitation`, `self_registration` y `admin_created`.
- Los datos de autenticación no se duplican en `profiles` salvo el correo ya existente por compatibilidad operativa.

## Nueva tabla `access_requests`

Campos mínimos:

- `id uuid primary key`
- `user_id uuid not null references public.profiles(id)`
- `request_type text not null`
- `status text not null`
- `country_id uuid null`
- `requested_scope_type text null`
- `requested_scope_entity_id uuid null`
- `requested_role_key text null`
- `requested_person_id uuid null`
- `organization_name text null`
- `position_title text null`
- `reason text not null`
- `reference_name text null`
- `reference_email text null`
- `review_notes text null`
- `reviewed_by uuid null`
- `reviewed_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Tipos iniciales:

- `initial_access`
- `person_link`
- `scope_change`
- `role_change`
- `account_closure`

Estados iniciales:

- `draft`
- `submitted`
- `under_review`
- `information_required`
- `approved`
- `rejected`
- `cancelled`

## Reglas de seguridad

- El usuario autenticado puede leer únicamente sus propias solicitudes.
- Puede crear una solicitud propia en `draft` o `submitted`.
- Puede editar únicamente solicitudes propias en `draft` o `information_required`.
- Puede cancelar solicitudes propias no resueltas.
- No puede aprobar, rechazar ni asignar roles, ámbitos o personas.
- Los revisores requieren permiso explícito de gestión de usuarios o acceso.
- La aprobación de una solicitud no asigna automáticamente rol ni ámbito desde un trigger genérico; debe llamar un contrato administrativo explícito y auditado.
- Ninguna función de escritura será ejecutable por `anon`.
- El autorregistro no crea personas, roles, ámbitos ni membresías nacionales.

## Flujo de autorregistro

1. El usuario crea su cuenta mediante Supabase Auth.
2. Confirma el correo.
3. El trigger crea `profiles` con `registration_source = 'self_registration'` y estado pendiente.
4. Entra a `/cuenta` aunque no tenga rol administrativo.
5. Completa perfil básico y aceptación legal.
6. Envía una solicitud `initial_access`.
7. El revisor valida identidad, posible persona existente, país, rol y ámbito.
8. La vinculación con persona, si corresponde, se realiza explícitamente.
9. La asignación efectiva reutiliza `user_role_assignments` y `user_country_memberships`.
10. El usuario completa onboarding y puede entrar a Administración cuando el contexto resulte `ready`.

## Estados visibles para el usuario

La interfaz debe traducir los estados técnicos a mensajes claros:

- Correo pendiente de confirmación.
- Perfil básico incompleto.
- Acceso aún no solicitado.
- Solicitud recibida.
- Solicitud en revisión.
- Información adicional requerida.
- Acceso aprobado, pendiente de onboarding.
- Solicitud rechazada.
- Cuenta suspendida o inactiva.

## Contratos públicos autenticados propuestos

- `get_my_account_context()`
- `save_my_account_profile(payload jsonb)`
- `list_my_access_requests()`
- `submit_my_access_request(payload jsonb)`
- `update_my_access_request(payload jsonb)`
- `cancel_my_access_request(request_id uuid)`

Todos deben ejecutar con privilegios del llamador o mediante fachada `security invoker` sobre implementaciones privadas cuando sea necesario. Ninguno debe concederse a `anon`.

## Contratos administrativos propuestos

- `list_access_requests(filters jsonb)`
- `review_access_request(payload jsonb)`
- `link_user_to_person(payload jsonb)`
- `apply_access_request(payload jsonb)`

La aplicación debe permanecer idempotente, validar país y ámbito, y escribir auditoría.

## Decisiones descartadas

- Crear otra tabla de usuarios.
- Crear automáticamente una persona por cada cuenta.
- Conceder un rol por defecto.
- Permitir que el usuario elija un ámbito global.
- Mezclar solicitud y asignación en una sola fila.
- Implementar mensajería antes del flujo básico de solicitud.

## Criterios de aceptación

- Una persona puede crear y verificar su cuenta sin recibir permisos administrativos.
- Puede entrar a `/cuenta` y conocer su estado.
- Puede completar perfil y enviar una solicitud.
- No puede ver información interna ni escalar permisos.
- Un revisor puede pedir información, aprobar o rechazar.
- La aprobación reutiliza los contratos canónicos de roles, ámbitos y país.
- La vinculación cuenta-persona no crea duplicados.
- Todas las operaciones sensibles quedan auditadas.
- El flujo funciona en móvil y con teclado.
