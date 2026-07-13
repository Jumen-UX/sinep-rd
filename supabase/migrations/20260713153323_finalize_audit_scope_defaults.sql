update public.audit_logs
set scope_type = 'unknown'
where scope_type is null;

alter table public.audit_logs alter column scope_type set default 'unknown';
alter table public.audit_logs alter column scope_type set not null;
