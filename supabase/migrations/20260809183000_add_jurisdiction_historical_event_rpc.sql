-- Documented institutional events. A historical event may drive one supported
-- structural change atomically, while the structural operation remains an internal audit record.

create or replace function public.admin_preview_jurisdiction_historical_event(
  p_event_type_key text,
  p_effective_date date,
  p_public_title text,
  p_public_summary text,
  p_source_document_id uuid,
  p_structural_action text default 'none',
  p_primary_account_id uuid default null,
  p_structural_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_actor uuid:=auth.uid();
  v_event public.jurisdiction_event_types%rowtype;
  v_action text:=coalesce(nullif(btrim(p_structural_action),''),'none');
  v_errors jsonb:='[]'::jsonb;
  v_structural_preview jsonb;
  v_expected_event_key text;
begin
  if v_actor is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para registrar historia jurisdiccional' using errcode='42501';
  end if;

  select * into v_event from public.jurisdiction_event_types
  where key=nullif(btrim(p_event_type_key),'') and status='active' limit 1;

  if v_event.id is null then v_errors:=v_errors||jsonb_build_array('El tipo de acontecimiento no existe o no está activo.'); end if;
  if p_effective_date is null then v_errors:=v_errors||jsonb_build_array('La fecha del acontecimiento es obligatoria.'); end if;
  if nullif(btrim(p_public_title),'') is null then v_errors:=v_errors||jsonb_build_array('El título público es obligatorio.'); end if;
  if nullif(btrim(p_public_summary),'') is null then v_errors:=v_errors||jsonb_build_array('El resumen público es obligatorio.'); end if;
  if p_source_document_id is null then v_errors:=v_errors||jsonb_build_array('Todo acontecimiento histórico requiere una fuente documental.'); end if;
  if v_event.id is not null and not v_event.supports_publication then v_errors:=v_errors||jsonb_build_array('Este tipo de acontecimiento no admite publicación pública.'); end if;
  if v_action not in ('none','creation','dependency_change','suppression','restoration') then v_errors:=v_errors||jsonb_build_array('La acción estructural solicitada no está soportada.'); end if;

  v_expected_event_key:=case v_action
    when 'creation' then 'erection'
    when 'dependency_change' then 'dependency_change'
    when 'suppression' then 'suppression'
    when 'restoration' then 'restoration'
    else null
  end;

  if v_action='none' and v_event.id is not null and v_event.affects_organigram then
    v_errors:=v_errors||jsonb_build_array('Este tipo de acontecimiento exige un efecto estructural sobre el organigrama.');
  elsif v_expected_event_key is not null and v_event.id is not null and v_event.key<>v_expected_event_key then
    v_errors:=v_errors||jsonb_build_array('El tipo de acontecimiento no coincide con la acción estructural seleccionada.');
  end if;

  if jsonb_array_length(v_errors)=0 then
    if v_action='none' then
      if p_primary_account_id is null or not exists(select 1 from public.jurisdiction_accounts where id=p_primary_account_id) then
        v_errors:=v_errors||jsonb_build_array('Selecciona la jurisdicción principal del acontecimiento.');
      end if;
    elsif v_action='creation' then
      v_structural_preview:=public.admin_preview_jurisdiction_creation(
        p_structural_payload->>'entity_type_key',
        p_structural_payload->>'name',
        p_structural_payload->>'official_name',
        p_structural_payload->>'latin_name',
        p_structural_payload->>'slug',
        (p_structural_payload->>'parent_account_id')::uuid,
        p_structural_payload->>'relationship_type',
        p_effective_date,
        coalesce(p_structural_payload->>'visibility','internal'),
        p_public_summary,
        p_source_document_id
      );
    elsif v_action='dependency_change' then
      v_structural_preview:=public.admin_preview_jurisdiction_dependency_change(
        p_primary_account_id,
        (p_structural_payload->>'new_parent_account_id')::uuid,
        p_structural_payload->>'relationship_type',
        p_effective_date,
        p_public_summary,
        p_source_document_id
      );
    elsif v_action='suppression' then
      v_structural_preview:=public.admin_preview_jurisdiction_suppression(
        p_primary_account_id,p_effective_date,p_public_summary,p_source_document_id
      );
    elsif v_action='restoration' then
      v_structural_preview:=public.admin_preview_jurisdiction_restoration(
        p_primary_account_id,
        (p_structural_payload->>'parent_account_id')::uuid,
        p_structural_payload->>'relationship_type',
        p_effective_date,
        p_public_summary,
        p_source_document_id
      );
    end if;

    if v_action<>'none' and not coalesce((v_structural_preview->>'valid')::boolean,false) then
      v_errors:=v_errors||coalesce(v_structural_preview->'errors','[]'::jsonb);
    end if;
  end if;

  return jsonb_build_object(
    'valid',jsonb_array_length(v_errors)=0,
    'errors',v_errors,
    'event_type',case when v_event.id is null then null else jsonb_build_object(
      'id',v_event.id,'key',v_event.key,'name',v_event.name,'affects_organigram',v_event.affects_organigram
    ) end,
    'effective_date',p_effective_date,
    'title',nullif(btrim(p_public_title),''),
    'summary',nullif(btrim(p_public_summary),''),
    'source_document_id',p_source_document_id,
    'structural_action',v_action,
    'structural_preview',v_structural_preview
  );
end;
$$;

create or replace function public.admin_apply_jurisdiction_historical_event(
  p_event_type_key text,
  p_effective_date date,
  p_public_title text,
  p_public_summary text,
  p_source_document_id uuid,
  p_structural_action text default 'none',
  p_primary_account_id uuid default null,
  p_structural_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_actor uuid:=auth.uid();
  v_preview jsonb;
  v_event_id uuid;
  v_action text:=coalesce(nullif(btrim(p_structural_action),''),'none');
  v_structure jsonb;
  v_primary uuid:=p_primary_account_id;
  v_structural_operation uuid;
  v_expected_edge uuid;
  v_history_operation uuid;
  v_audit uuid;
begin
  if v_actor is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para registrar historia jurisdiccional' using errcode='42501';
  end if;

  v_preview:=public.admin_preview_jurisdiction_historical_event(
    p_event_type_key,p_effective_date,p_public_title,p_public_summary,p_source_document_id,
    v_action,p_primary_account_id,p_structural_payload
  );
  if not coalesce((v_preview->>'valid')::boolean,false) then
    raise exception 'Acontecimiento histórico inválido: %',v_preview->'errors' using errcode='22023';
  end if;

  if v_action='creation' then
    v_structure:=public.admin_apply_jurisdiction_creation(
      p_structural_payload->>'entity_type_key',p_structural_payload->>'name',
      p_structural_payload->>'official_name',p_structural_payload->>'latin_name',p_structural_payload->>'slug',
      (p_structural_payload->>'parent_account_id')::uuid,p_structural_payload->>'relationship_type',
      p_effective_date,coalesce(p_structural_payload->>'visibility','internal'),p_public_summary,p_source_document_id
    );
    v_primary:=(v_structure->>'account_id')::uuid;
  elsif v_action='dependency_change' then
    v_expected_edge:=nullif(v_preview->'structural_preview'->'current_dependency'->>'edge_id','')::uuid;
    v_structure:=public.admin_apply_jurisdiction_dependency_change(
      p_primary_account_id,(p_structural_payload->>'new_parent_account_id')::uuid,
      p_structural_payload->>'relationship_type',p_effective_date,p_public_summary,p_source_document_id,v_expected_edge
    );
  elsif v_action='suppression' then
    v_expected_edge:=nullif(v_preview->'structural_preview'->'current_dependency'->>'edge_id','')::uuid;
    v_structure:=public.admin_apply_jurisdiction_suppression(
      p_primary_account_id,p_effective_date,p_public_summary,p_source_document_id,v_expected_edge
    );
  elsif v_action='restoration' then
    v_structure:=public.admin_apply_jurisdiction_restoration(
      p_primary_account_id,(p_structural_payload->>'parent_account_id')::uuid,
      p_structural_payload->>'relationship_type',p_effective_date,p_public_summary,p_source_document_id
    );
  end if;

  if v_structure is not null then
    v_structural_operation:=nullif(v_structure->>'operation_id','')::uuid;
  end if;

  select id into v_event_id from public.jurisdiction_event_types
  where key=btrim(p_event_type_key) and status='active';

  insert into public.jurisdiction_change_operations(
    origin,status,publication_status,primary_account_id,event_type_id,effective_date,reason,
    public_title,public_summary,source_document_id,external_reference,operation_source,
    created_by,applied_by,created_at,applied_at,updated_at
  ) values (
    'historical_event','applied','published',v_primary,v_event_id,p_effective_date,btrim(p_public_summary),
    btrim(p_public_title),btrim(p_public_summary),p_source_document_id,
    case when v_structural_operation is null then null else v_structural_operation::text end,
    'admin_detail',v_actor,v_actor,now(),now(),now()
  ) returning id into v_history_operation;

  v_audit:=public.admin_write_audit_log(
    'jurisdiction.historical_event','jurisdiction_accounts',v_primary,
    jsonb_build_object(
      'kind','historical_event','historical_operation_id',v_history_operation,
      'structural_operation_id',v_structural_operation,'event_type_key',btrim(p_event_type_key),
      'effective_date',p_effective_date,'title',btrim(p_public_title),
      'source_document_id',p_source_document_id,'structural_action',v_action
    )
  );

  return jsonb_build_object(
    'status','published','historical_operation_id',v_history_operation,
    'structural_operation_id',v_structural_operation,'audit_id',v_audit,
    'primary_account_id',v_primary,'structural_result',v_structure
  );
end;
$$;

revoke execute on function public.admin_preview_jurisdiction_historical_event(text,date,text,text,uuid,text,uuid,jsonb) from public,anon;
grant execute on function public.admin_preview_jurisdiction_historical_event(text,date,text,text,uuid,text,uuid,jsonb) to authenticated;
revoke execute on function public.admin_apply_jurisdiction_historical_event(text,date,text,text,uuid,text,uuid,jsonb) from public,anon;
grant execute on function public.admin_apply_jurisdiction_historical_event(text,date,text,text,uuid,text,uuid,jsonb) to authenticated;
