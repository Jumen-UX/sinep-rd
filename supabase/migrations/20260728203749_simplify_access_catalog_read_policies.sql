drop policy if exists phase0_roles_select_d6abe45 on public.roles;
create policy roles_select_authenticated
on public.roles
for select
to authenticated
using (true);

drop policy if exists phase0_permissions_select_e0fe28f on public.permissions;
create policy permissions_select_authenticated
on public.permissions
for select
to authenticated
using (true);

drop policy if exists phase0_role_permissions_select_0af6217 on public.role_permissions;
create policy role_permissions_select_authenticated
on public.role_permissions
for select
to authenticated
using (true);

comment on policy roles_select_authenticated on public.roles
is 'Catálogo de roles legible por usuarios autenticados; las mutaciones directas permanecen revocadas.';
comment on policy permissions_select_authenticated on public.permissions
is 'Catálogo de permisos legible por usuarios autenticados; las mutaciones directas permanecen revocadas.';
comment on policy role_permissions_select_authenticated on public.role_permissions
is 'Matriz rol-permiso legible por usuarios autenticados; las mutaciones directas permanecen revocadas.';