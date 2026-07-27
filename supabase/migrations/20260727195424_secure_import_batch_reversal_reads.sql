begin;

revoke all on table public.import_batch_reversals from public, anon, authenticated;
grant select on table public.import_batch_reversals to authenticated;

drop policy if exists import_batch_reversals_select_scoped
  on public.import_batch_reversals;

create policy import_batch_reversals_select_scoped
on public.import_batch_reversals
for select
to authenticated
using (
  exists (
    select 1
    from public.import_batches batch
    where batch.id = import_batch_reversals.batch_id
  )
);

comment on policy import_batch_reversals_select_scoped
on public.import_batch_reversals is
  'Allows authenticated users to read a reversal only when the parent import batch is visible through its canonical scoped RLS policy. All writes remain restricted to the audited reversal RPC.';

commit;
