-- Controlled growth model: editors can suggest offices and administrators can review requests.
-- Applied to project hrvgpceqaxujlttpimdz on 2026-07-06.

create or replace function public.editor_suggest_office_configuration(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid;
  v_display_name text := nullif(btrim(payload->>'display_name'), '');
  v_title text;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión para sugerir cargos' using errcode = '42501';
  end if;

  if v_display_name is null then
    raise exception 'El nombre del cargo sugerido es obligatorio' using errcode = '22023';
  end if;

  v_title := 'Sugerencia de cargo: ' || v_display_name;

  insert into change_requests (
    target_table,
    target_id,
    action_type,
    title,
    description,
    proposed_data,
    status,
    created_by,
    submitted_by,
    submitted_at,
    scope_type,
    scope_entity_id,
    diocese_id,
    pastoral_area_id,
    pastoral_entity_id,
    priority,
    effective_date
  ) values (
    'office_configurations',
    null,
    'create',
    v_title,
    nullif(btrim(payload->>'reason'), ''),
    payload,
    'pending_review',
    v_user_id,
    v_user_id,
    now(),
    coalesce(nullif(payload->>'scope_type', ''), 'other'),
    nullif(payload->>'scope_entity_id', '')::uuid,
    nullif(payload->>'diocese_id', '')::uuid,
    nullif(payload->>'pastoral_area_id', '')::uuid,
    nullif(payload->>'pastoral_entity_id', '')::uuid,
    coalesce(nullif(payload->>'priority', ''), 'normal'),
    nullif(payload->>'effective_date', '')::date
  )
  returning id into v_request_id;

  insert into audit_logs (user_id, action, target_table, target_id, new_data, change_request_id)
  values (v_user_id, 'editor_suggest_office_configuration', 'change_requests', v_request_id, payload, v_request_id);

  return jsonb_build_object('change_request_id', v_request_id, 'status', 'pending_review', 'title', v_title);
end;
$$;

create or replace function public.admin_review_change_request(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid := nullif(payload->>'change_request_id', '')::uuid;
  v_decision text := coalesce(nullif(payload->>'decision', ''), 'approved');
  v_notes text := nullif(btrim(payload->>'review_notes'), '');
  v_request change_requests%rowtype;
  v_applied jsonb := null;
begin
  if v_user_id is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para revisar solicitudes' using errcode = '42501';
  end if;

  if v_request_id is null then
    raise exception 'Debes indicar la solicitud a revisar' using errcode = '22023';
  end if;

  if v_decision not in ('approved', 'rejected', 'needs_changes', 'archived', 'cancelled') then
    raise exception 'Decisión no permitida' using errcode = '22023';
  end if;

  select * into v_request
  from change_requests
  where id = v_request_id
  for update;

  if not found then
    raise exception 'Solicitud no encontrada' using errcode = '22023';
  end if;

  if v_decision = 'approved' and v_request.target_table = 'office_configurations' and v_request.action_type = 'create' then
    v_applied := public.admin_save_office_configuration(v_request.proposed_data);

    update change_requests
    set status = 'published',
        reviewed_by = v_user_id,
        reviewed_at = now(),
        approved_by = v_user_id,
        approved_at = now(),
        published_by = v_user_id,
        published_at = now(),
        correction_notes = v_notes,
        updated_at = now()
    where id = v_request_id;
  elsif v_decision = 'approved' then
    update change_requests
    set status = 'approved',
        reviewed_by = v_user_id,
        reviewed_at = now(),
        approved_by = v_user_id,
        approved_at = now(),
        correction_notes = v_notes,
        updated_at = now()
    where id = v_request_id;
  elsif v_decision = 'rejected' then
    update change_requests
    set status = 'rejected',
        reviewed_by = v_user_id,
        reviewed_at = now(),
        rejection_reason = coalesce(v_notes, 'Rechazada por revisión administrativa'),
        updated_at = now()
    where id = v_request_id;
  else
    update change_requests
    set status = v_decision,
        reviewed_by = v_user_id,
        reviewed_at = now(),
        correction_notes = v_notes,
        updated_at = now()
    where id = v_request_id;
  end if;

  insert into audit_logs (user_id, action, target_table, target_id, old_data, new_data, change_request_id)
  values (
    v_user_id,
    'admin_review_change_request',
    v_request.target_table,
    v_request.target_id,
    to_jsonb(v_request),
    jsonb_build_object('decision', v_decision, 'notes', v_notes, 'applied', v_applied),
    v_request_id
  );

  return jsonb_build_object('change_request_id', v_request_id, 'decision', v_decision, 'applied', v_applied);
end;
$$;

grant execute on function public.editor_suggest_office_configuration(jsonb) to authenticated;
grant execute on function public.admin_review_change_request(jsonb) to authenticated;
