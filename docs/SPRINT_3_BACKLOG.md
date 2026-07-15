# Sprint 3 — Autenticación, acceso y onboarding

> Estado: en ejecución  
> Inicio: 2026-07-14  
> Dependencia: Sprint 2 cerrado técnicamente  
> Rama operativa: `main`

## Objetivo

Completar el ciclo de acceso administrativo desde la invitación hasta una sesión útil y restringida por rol y alcance, sin crear un sistema de identidad paralelo a Supabase Auth.

## Línea base comprobada

- Supabase Auth gestiona credenciales, invitaciones y sesiones.
- El dominio `features/access` contiene login, invitación, recuperación y administración de usuarios.
- Los roles, permisos y alcances se resuelven desde contratos canónicos y auditados.
- `middleware.ts` protege las rutas bajo `/admin`.
- Falta un primer acceso reanudable que confirme perfil, rol y ámbito antes de entrar al portal.
- Falta completar el cambio de contraseña posterior a recuperación.
- Faltan pruebas autenticadas por perfiles representativos.

## Bloques

### S3-01 — Primer acceso reanudable

- [x] Persistir el paso y la fecha de finalización del onboarding.
- [x] Redirigir invitaciones al onboarding.
- [x] Permitir completar nombre y teléfono propios.
- [x] Establecer la contraseña inicial de perfiles invitados.
- [x] Mostrar el rol y alcance efectivos sin permitir autoasignación.
- [x] Impedir completar el onboarding sin un rol activo.
- [x] Reanudar el flujo después de cerrar sesión.
- [x] Auditar la finalización.

### S3-02 — Recuperación completa de credenciales

- [x] Crear una ruta segura para establecer la nueva contraseña.
- [x] Validar el contexto de recuperación antes de mostrar el formulario.
- [x] Aplicar requisitos de contraseña y mensajes no enumerables.
- [x] Redirigir al destino administrativo correcto tras el cambio.

### S3-03 — Protección de rutas y estado de cuenta

- [ ] Centralizar la resolución de entrada administrativa.
- [ ] Bloquear perfiles suspendidos o inactivos aunque conserven una sesión.
- [ ] Evitar que usuarios sin rol naveguen fuera de su estado de acceso.
- [ ] Mantener `next` limitado a rutas locales seguras.

### S3-04 — Invitación y administración de acceso

- [ ] Hacer explícito el estado invitado → onboarding → activo.
- [ ] Confirmar rol y alcance antes de enviar la invitación cuando corresponda.
- [ ] Mostrar avance de onboarding en la lista de usuarios.
- [ ] Mantener asignación, cierre de rol y cambios de estado auditados.

### S3-05 — Matriz automatizada por perfil

- [ ] Superadministrador.
- [ ] Administrador nacional.
- [ ] Administrador diocesano.
- [ ] Usuario restringido a parroquia o unidad.
- [ ] Usuario autenticado sin rol.
- [ ] Usuario suspendido o inactivo.
- [ ] Invitado con onboarding incompleto.

### S3-06 — Validación operativa y cierre

- [ ] Ejecutar el recorrido autenticado en Supabase no productivo.
- [ ] Confirmar aislamiento entre dos diócesis.
- [ ] Documentar recuperación, revocación y soporte de acceso.
- [ ] Mantener `pnpm check`, integración y E2E aplicables en verde.

## Reglas del sprint

- Ningún usuario puede asignarse su propio rol o alcance.
- El onboarding solo confirma datos visibles; la autoridad proviene de asignaciones administrativas.
- Suspensión e inactivación prevalecen sobre una sesión válida.
- Las operaciones sensibles deben ser transaccionales, acotadas al usuario autenticado y auditadas.
- Los pendientes operativos de beta continúan separados del cierre técnico de cada bloque.

## Primer bloque activo

S3-01 está validado por CI. S3-02 está implementado en código y pendiente de validación CI. El próximo bloque es S3-03: protección de rutas y estado de cuenta.

