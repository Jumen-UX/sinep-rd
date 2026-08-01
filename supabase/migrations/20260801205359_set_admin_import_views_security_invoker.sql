alter view if exists public.admin_import_clergy_directory_review
  set (security_invoker = true);

alter view if exists public.admin_import_clergy_directory_review_summary
  set (security_invoker = true);

revoke all on table public.admin_import_clergy_directory_review
  from public, anon, authenticated;

revoke all on table public.admin_import_clergy_directory_review_summary
  from public, anon, authenticated;
