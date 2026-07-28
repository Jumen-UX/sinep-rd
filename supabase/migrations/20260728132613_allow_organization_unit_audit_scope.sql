begin;

alter table public.audit_logs
  drop constraint if exists audit_logs_scope_type_check;

alter table public.audit_logs
  add constraint audit_logs_scope_type_check
  check (
    scope_type is null
    or scope_type in (
      'global',
      'national',
      'diocese',
      'vicariate',
      'zone',
      'parish',
      'entity',
      'pastoral_area',
      'pastoral_entity',
      'organization_unit',
      'unknown'
    )
  );

comment on constraint audit_logs_scope_type_check on public.audit_logs is
  'Allows canonical territorial and organizational audit scopes. organization_unit is the canonical replacement for legacy pastoral entity scope.';

commit;
