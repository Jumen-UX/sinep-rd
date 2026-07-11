create or replace function internal.resolve_assignment_canonical_incompatibility(payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,internal,pg_temp as $$
declare
  v_assignment_id uuid := nullif(payload->>'assignment_id','')::uuid;
  v_action text := coalesce(nullif(payload->>'action',''),'acknowledge');
  v_notes text := nullif(btrim(payload->>'notes'),'');
  v_result jsonb; v_status text; v_resolution text;
begin
  if auth.uid() is null or not public.current_user_has_admin_role() then raise exception 'No autorizado' using errcode='42501'; end if;
  if v_assignment_id is null then raise exception 'Nombramiento requerido' using errcode='22023'; end if;
  if v_action not in ('acknowledge','recheck','close_assignment','accept_exception') then raise exception 'Acción no permitida' using errcode='22023'; end if;
  select internal.evaluate_position_assignment_eligibility(pa.person_id,pa.office_configuration_id,pa.ecclesiastical_entity_id,null,true)
    into v_result from public.position_assignments pa where pa.id=v_assignment_id for update;
  if not found then raise exception 'Nombramiento no encontrado' using errcode='22023'; end if;
  if v_action='close_assignment' then
    update public.position_assignments set is_current=false,assignment_status='ended',actual_end_date=coalesce(actual_end_date,current_date),updated_at=now() where id=v_assignment_id;
    v_status:='closed'; v_resolution:='assignment_closed';
  elsif v_action='recheck' and coalesce((v_result->>'eligible')::boolean,false) then
    v_status:='resolved'; v_resolution:=coalesce(nullif(payload->>'resolution_type',''),'person_corrected');
  elsif v_action='accept_exception' then
    if v_notes is null then raise exception 'Debes justificar la excepción' using errcode='22023'; end if;
    v_status:='resolved'; v_resolution:='accepted_exception';
  else
    v_status:='acknowledged'; v_resolution:=null;
  end if;
  insert into public.assignment_canonical_reviews(assignment_id,review_status,resolution_type,review_notes,last_reason_code,last_message,reviewed_by,reviewed_at,updated_at)
  values(v_assignment_id,v_status,v_resolution,v_notes,v_result->>'reason_code',v_result->>'message',auth.uid(),now(),now())
  on conflict(assignment_id) do update set review_status=excluded.review_status,resolution_type=excluded.resolution_type,review_notes=coalesce(excluded.review_notes,assignment_canonical_reviews.review_notes),last_reason_code=excluded.last_reason_code,last_message=excluded.last_message,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,updated_at=now();
  insert into public.audit_logs(user_id,action,target_table,target_id,new_data)
  values(auth.uid(),'resolve_assignment_canonical_incompatibility','position_assignments',v_assignment_id,jsonb_build_object('action',v_action,'status',v_status,'resolution_type',v_resolution,'notes',v_notes,'eligibility',v_result));
  return jsonb_build_object('assignment_id',v_assignment_id,'review_status',v_status,'resolution_type',v_resolution,'eligibility',v_result);
end; $$;
create or replace function public.admin_resolve_assignment_canonical_incompatibility(payload jsonb)
returns jsonb language sql security invoker set search_path=public,internal,pg_temp as $$ select internal.resolve_assignment_canonical_incompatibility(payload); $$;
revoke all on function public.admin_resolve_assignment_canonical_incompatibility(jsonb) from public,anon;
grant execute on function public.admin_resolve_assignment_canonical_incompatibility(jsonb) to authenticated;
grant execute on function internal.resolve_assignment_canonical_incompatibility(jsonb) to authenticated;
