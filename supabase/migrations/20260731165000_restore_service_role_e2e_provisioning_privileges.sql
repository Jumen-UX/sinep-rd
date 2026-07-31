-- El aprovisionador E2E se ejecuta únicamente con la clave server-side service_role.
-- Se restauran solo los privilegios directos necesarios para resolver catálogos,
-- crear perfiles de prueba, asignar roles y registrar auditoría.

grant select on table public.ecclesiastical_entities to service_role;
grant select on table public.roles to service_role;

grant select, insert, update on table public.profiles to service_role;
grant select, insert, update, delete on table public.user_role_assignments to service_role;
grant insert on table public.audit_logs to service_role;
