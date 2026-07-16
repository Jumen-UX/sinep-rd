revoke all on function public.admin_create_compensating_event(jsonb) from public, anon;
grant execute on function public.admin_create_compensating_event(jsonb) to authenticated;

create or replace function internal.admin_create_compensating_event(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'internal', 'auth', 'pg_temp'
as $function$
declare
  v_original_id uuid := nullif(payload->>'original_event_id','')::uuid;
  v_original record;
  v_new_id uuid;
  v_reason text := nullif(trim(payload->>'reason'),'');
  v_kind text := coalesce(nullif(payload->>'correction_kind',''),'correction');
  v_title text;
begin
  if not internal.current_user_has_admin_role() then
    raise exception 'not_authorized';
  end if;

  if v_original_id is null then raise exception 'original_event_required'; end if;
  if v_reason is null then raise exception 'compensation_reason_required'; end if;
  if v_kind not in ('reversal','correction','supersession') then raise exception 'invalid_correction_kind'; end if;

  select ce.*, cet.is_compensable, cet.key as event_type_key
  into v_original
  from public.canonical_events ce
  join public.canonical_event_types cet on cet.id = ce.event_type_id
  where ce.id = v_original_id
  for update of ce;

  if not found then raise exception 'original_event_not_found'; end if;
  if v_original.status <> 'applied' then raise exception 'original_event_not_applied'; end if;
  if not v_original.is_compensable then raise exception 'event_type_not_compensable'; end if;

  if exists (
    select 1
    from public.canonical_events
    where compensates_event_id = v_original_id
      and status <> 'cancelled'
  ) then
    raise exception 'active_compensation_already_exists';
  end if;

  v_title := coalesce(
    nullif(trim(payload->>'title'),''),
    case v_kind
      when 'reversal' then 'Reversión de: '
      when 'supersession' then 'Sustitución de: '
      else 'Corrección de: '
    end || v_original.title
  );

  insert into public.canonical_events(
    event_type_id,title,description,event_date,effective_date,authority_entity_id,
    status,created_by,load_mode,evidence_status,source_name_text,source_url_text,
    source_checked_at,verification_status,notes_json,compensates_event_id,
    compensation_reason,correction_kind
  )
  values(
    v_original.event_type_id,v_title,nullif(payload->>'description',''),
    nullif(payload->>'event_date','')::date,
    coalesce(nullif(payload->>'effective_date','')::date,nullif(payload->>'event_date','')::date),
    v_original.authority_entity_id,'draft',auth.uid(),'evento_nuevo','pendiente_documento',
    nullif(trim(payload->>'source_name'),''),nullif(trim(payload->>'source_url'),''),
    nullif(payload->>'source_checked_at','')::date,'pending_review',
    jsonb_build_object('created_from','compensating_event','original_event_id',v_original_id,'raw_payload',payload),
    v_original_id,v_reason,v_kind
  )
  returning id into v_new_id;

  insert into public.canonical_event_participants(
    event_id,entity_id,organization_unit_id,role,before_state,after_state
  )
  select v_new_id,cep.entity_id,cep.organization_unit_id,cep.role,
         cep.after_state,cep.before_state
  from public.canonical_event_participants cep
  where cep.event_id = v_original_id;

  return v_new_id;
exception
  when unique_violation then
    if exists (
      select 1
      from public.canonical_events
      where compensates_event_id = v_original_id
        and status <> 'cancelled'
    ) then
      raise exception 'active_compensation_already_exists';
    end if;
    raise;
end;
$function$;

revoke all on function internal.admin_create_compensating_event(jsonb) from public, anon, authenticated;
