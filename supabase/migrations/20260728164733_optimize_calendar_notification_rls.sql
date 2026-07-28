drop policy if exists event_notification_logs_select_scoped on public.event_notification_logs;

create policy event_notification_logs_select_scoped
on public.event_notification_logs
for select
to authenticated
using (
  recipient_user_id = (select auth.uid())
  or app_private.current_user_can_manage_calendar_record('events.view', 'event_notification_logs', id)
);
