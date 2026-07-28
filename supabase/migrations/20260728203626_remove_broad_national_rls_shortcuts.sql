drop policy if exists import_batches_select_scoped on public.import_batches;
create policy import_batches_select_scoped
on public.import_batches
for select
to authenticated
using (
  created_by = (select auth.uid())
  or (
    scope_entity_id is not null
    and app_private.current_user_can_manage_entity('imports.prepare',scope_entity_id)
  )
  or (
    scope_entity_id is not null
    and app_private.current_user_can_manage_entity('imports.review',scope_entity_id)
  )
  or (
    scope_entity_id is not null
    and app_private.current_user_can_manage_entity('imports.apply',scope_entity_id)
  )
);

drop policy if exists assignment_canonical_reviews_select_scoped on public.assignment_canonical_reviews;
create policy assignment_canonical_reviews_select_scoped
on public.assignment_canonical_reviews
for select
to authenticated
using (
  exists (
    select 1
    from public.position_assignments assignment_row
    where assignment_row.id=assignment_canonical_reviews.assignment_id
      and (
        assignment_row.ecclesiastical_entity_id is not null
        and app_private.current_user_can_manage_entity(
          'appointments.view',assignment_row.ecclesiastical_entity_id
        )
        or assignment_row.organization_unit_id is not null
        and app_private.current_user_can_manage_organization_unit(
          'appointments.view',assignment_row.organization_unit_id
        )
      )
  )
);

drop policy if exists phase0_user_role_assignments_select_5275828 on public.user_role_assignments;
create policy user_role_assignments_select_scoped
on public.user_role_assignments
for select
to authenticated
using (
  user_id = (select auth.uid())
  or app_private.current_user_can_manage_user(user_id)
);

drop policy if exists phase0_user_role_assignments_insert_dfbcb4c on public.user_role_assignments;
drop policy if exists phase0_user_role_assignments_update_689a95c on public.user_role_assignments;
drop policy if exists phase0_user_role_assignments_remove_93920af on public.user_role_assignments;
revoke insert,update,delete on table public.user_role_assignments from anon,authenticated;

drop policy if exists phase0_roles_insert_934331a on public.roles;
drop policy if exists phase0_roles_update_9f1cac0 on public.roles;
drop policy if exists phase0_roles_remove_4034b2a on public.roles;
revoke insert,update,delete on table public.roles from anon,authenticated;

drop policy if exists phase0_permissions_insert_9434783 on public.permissions;
drop policy if exists phase0_permissions_update_9b76afb on public.permissions;
drop policy if exists phase0_permissions_remove_930334c on public.permissions;
revoke insert,update,delete on table public.permissions from anon,authenticated;

drop policy if exists phase0_role_permissions_insert_f152d6e on public.role_permissions;
drop policy if exists phase0_role_permissions_update_a3a6ea7 on public.role_permissions;
drop policy if exists phase0_role_permissions_remove_1897d89 on public.role_permissions;
revoke insert,update,delete on table public.role_permissions from anon,authenticated;

comment on policy import_batches_select_scoped on public.import_batches
is 'Autoriza lotes propios o gestionables mediante permisos y entidad; national_admin no es un bypass global.';
comment on policy user_role_assignments_select_scoped on public.user_role_assignments
is 'Cada usuario ve sus asignaciones; los administradores solo ven usuarios gestionables por país.';