-- Verifies the territorial contract for self-service account requests.
do $verify$
declare
  v_review_definition text;
  v_submit_definition text;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'access_requests'
      and column_name = 'requested_country_iso2'
  ) then
    raise exception 'access_requests.requested_country_iso2 is missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'access_requests_requested_country_iso2_fkey'
      and conrelid = 'public.access_requests'::regclass
  ) then
    raise exception 'Country FK is missing from access_requests';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'list_account_request_scopes'
      and p.prosecdef
  ) then
    raise exception 'Public scope-list facade must remain SECURITY INVOKER';
  end if;

  if has_function_privilege('anon', 'public.list_account_request_scopes(character,text)', 'EXECUTE') then
    raise exception 'anon must not execute list_account_request_scopes';
  end if;

  select pg_get_functiondef(p.oid) into v_review_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app_private'
    and p.proname = 'admin_review_access_request'
  limit 1;

  if v_review_definition not like '%current_user_can_manage_country%users.manage%'
     or v_review_definition not like '%super_admin%'
     or v_review_definition not like '%requested_country_iso2%' then
    raise exception 'admin_review_access_request is missing territorial authorization';
  end if;

  select pg_get_functiondef(p.oid) into v_submit_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app_private'
    and p.proname = 'submit_my_access_request'
  limit 1;

  if v_submit_definition like '%''person_link''%scope_change%role_change%account_closure%' then
    raise exception 'person_link appears to remain in the self-service allow-list';
  end if;

  if v_submit_definition not like '%requested_country_iso2%'
     or v_submit_definition not like '%is_requestable_account_scope%' then
    raise exception 'Self-service request validation is missing country/scope enforcement';
  end if;
end;
$verify$;
