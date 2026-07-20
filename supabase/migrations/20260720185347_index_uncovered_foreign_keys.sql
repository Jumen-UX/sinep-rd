create index if not exists canonical_event_revisions_changed_by_idx
  on public.canonical_event_revisions (changed_by);

create index if not exists import_batch_reversals_audit_log_id_idx
  on public.import_batch_reversals (audit_log_id);

create index if not exists import_batch_reversals_processed_by_idx
  on public.import_batch_reversals (processed_by);

create index if not exists import_batch_reversals_requested_by_idx
  on public.import_batch_reversals (requested_by);
