revoke all on function internal.admin_generate_event_action_plan(jsonb)
from public,anon,authenticated;

revoke all on function public.get_event_application_plan(uuid)
from public,anon;

revoke all on function public.get_event_review(uuid)
from public,anon;

revoke all on function public.get_event_application_contract(uuid)
from public,anon;

grant execute on function public.get_event_application_plan(uuid)
to authenticated,service_role;

grant execute on function public.get_event_review(uuid)
to authenticated,service_role;

grant execute on function public.get_event_application_contract(uuid)
to authenticated,service_role;
