alter function public.admin_review_access_request(jsonb) security invoker;
alter function public.cancel_my_access_request(uuid) security invoker;
alter function public.get_my_account_context() security invoker;
alter function public.save_my_account_profile(jsonb) security invoker;
alter function public.submit_my_access_request(jsonb) security invoker;

revoke all on function app_private.admin_review_access_request(jsonb) from public, anon, authenticated;
revoke all on function app_private.cancel_my_access_request(uuid) from public, anon, authenticated;
revoke all on function app_private.get_my_account_context() from public, anon, authenticated;
revoke all on function app_private.save_my_account_profile(jsonb) from public, anon, authenticated;
revoke all on function app_private.submit_my_access_request(jsonb) from public, anon, authenticated;

grant execute on function app_private.admin_review_access_request(jsonb) to authenticated;
grant execute on function app_private.cancel_my_access_request(uuid) to authenticated;
grant execute on function app_private.get_my_account_context() to authenticated;
grant execute on function app_private.save_my_account_profile(jsonb) to authenticated;
grant execute on function app_private.submit_my_access_request(jsonb) to authenticated;

revoke all on function public.admin_review_access_request(jsonb) from public, anon;
revoke all on function public.cancel_my_access_request(uuid) from public, anon;
revoke all on function public.get_my_account_context() from public, anon;
revoke all on function public.save_my_account_profile(jsonb) from public, anon;
revoke all on function public.submit_my_access_request(jsonb) from public, anon;

grant execute on function public.admin_review_access_request(jsonb) to authenticated;
grant execute on function public.cancel_my_access_request(uuid) to authenticated;
grant execute on function public.get_my_account_context() to authenticated;
grant execute on function public.save_my_account_profile(jsonb) to authenticated;
grant execute on function public.submit_my_access_request(jsonb) to authenticated;
