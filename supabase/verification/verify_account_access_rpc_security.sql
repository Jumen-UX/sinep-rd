-- Regression check for account/access RPC facade security.
-- Expected result: zero rows.
select
  p.proname,
  p.prosecdef as public_is_security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'admin_review_access_request',
    'cancel_my_access_request',
    'get_my_account_context',
    'save_my_account_profile',
    'submit_my_access_request'
  )
  and (
    p.prosecdef
    or has_function_privilege('anon', p.oid, 'EXECUTE')
    or not has_function_privilege('authenticated', p.oid, 'EXECUTE')
  );

-- Expected result: five rows, each SECURITY DEFINER, authenticated executable,
-- anon/PUBLIC not executable. These implementations remain outside the exposed API schema.
select
  p.proname,
  p.prosecdef as private_is_security_definer,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('public', p.oid, 'EXECUTE') as public_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app_private'
  and p.proname in (
    'admin_review_access_request',
    'cancel_my_access_request',
    'get_my_account_context',
    'save_my_account_profile',
    'submit_my_access_request'
  )
order by p.proname;
