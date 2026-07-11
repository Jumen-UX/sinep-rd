-- Give the canonical assignment review queue an explicit scoped read policy.

begin;

create index if not exists assignment_canonical_reviews_reviewed_by_idx
  on public.assignment_canonical_reviews (reviewed_by)
  where reviewed_by is not null;

drop policy if exists assignment_canonical_reviews_select_scoped
  on public.assignment_canonical_reviews;

create policy assignment_canonical_reviews_select_scoped
on public.assignment_canonical_reviews
for select
to authenticated
using (
  public.current_user_is_super_or_national()
  or exists (
    select 1
    from public.position_assignments assignment_row
    where assignment_row.id = assignment_canonical_reviews.assignment_id
      and assignment_row.ecclesiastical_entity_id is not null
      and public.current_user_can_manage_entity(
        'appointments.view',
        assignment_row.ecclesiastical_entity_id
      )
  )
);

comment on policy assignment_canonical_reviews_select_scoped
  on public.assignment_canonical_reviews is
  'Allows national administrators or scoped appointment viewers to read canonical assignment review state.';

commit;
