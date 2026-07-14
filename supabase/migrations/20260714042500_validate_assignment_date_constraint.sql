begin;

alter table public.position_assignments
  validate constraint position_assignments_actual_end_not_before_start;

commit;
