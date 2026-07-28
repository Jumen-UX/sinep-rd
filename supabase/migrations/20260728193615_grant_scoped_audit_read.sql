grant select on table public.audit_logs to authenticated;
revoke insert, update, delete on table public.audit_logs from anon, authenticated;

comment on table public.audit_logs is 'Bitácora administrativa con lectura RLS territorial y escritura exclusiva mediante funciones auditadas.';