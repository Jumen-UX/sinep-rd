-- Safe lifecycle operations for the current jurisdiction organigram.
-- Administrative suppression/restoration affects current organization and audit only.
-- Public institutional history is recorded separately by historical-event workflows.

create or replace function public.admin_preview_jurisdiction_suppression(
  p_account_id uuid,
  p_effective_date date,
  p_reason text,
  p_source_document_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_actor uuid:=auth.uid();
  v_account public.jurisdiction_accounts%rowtype;
  v_entity public.ecclesiastical_entities%rowtype;
  v_edge public.jurisdiction_account_edges%rowtype;
  v_type_key text;
  v_parent_name text;
  v_children integer:=0;
  v_errors jsonb:='[]'::jsonb;
  v_warnings jsonb:='[]'::jsonb;
begin
  if v_actor is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para suprimir jurisdicciones' using errcode='42501';
  end if;

  select * into v_account from public.jurisdiction_accounts where id=p_account_id;
  if not found then raise exception 'Cuenta jurisdiccional no encontrada' using errcode='P0002'; end if;
  select * into v_entity from public.ecclesiastical_entities where id=v_account.ecclesiastical_entity_id;
  select key into v_type_key from public.entity_types where id=v_entity.entity_type_id;

  select * into v_edge
  from public.jurisdiction_account_edges
  where child_account_id=p_account_id and is_current and status='active'
  order by created_at desc limit 1;
  if v_edge.id is not null then
    select entity.name into v_parent_name
    from public.jurisdiction_accounts account
    join public.ecclesiastical_entities entity on entity.id=account.ecclesiastical_entity_id
    where account.id=v_edge.parent_account_id;
  end if;

  select count(*)::integer into v_children
  from public.jurisdiction_account_edges
  where parent_account_id=p_account_id and is_current and status='active';

  if v_type_key='holy_see' then
    v_errors:=v_errors||jsonb_build_array('La Santa Sede no puede suprimirse desde el organigrama.');
  end if;
  if not v_account.is_current or v_account.status<>'active' then
    v_errors:=v_errors||jsonb_build_array('La jurisdicción no está activa en el organigrama vigente.');
  end if;
  if v_children>0 then
    v_errors:=v_errors||jsonb_build_array(format('La jurisdicción tiene %s dependencia(s) vigente(s). Deben resolverse antes de suprimirla.',v_children));
  end if;
  if p_effective_date is null then
    v_errors:=v_errors||jsonb_build_array('La fecha efectiva es obligatoria.');
  elsif v_account.valid_from is not null and p_effective_date<v_account.valid_from then
    v_errors:=v_errors||jsonb_build_array('La fecha de supresión no puede ser anterior al inicio de vigencia.');
  elsif v_edge.id is not null and p_effective_date<=v_edge.valid_from then
    v_errors:=v_errors||jsonb_build_array('La fecha de supresión debe ser posterior al inicio de la dependencia vigente.');
  end if;
  if nullif(btrim(p_reason),'') is null then
    v_errors:=v_errors||jsonb_build_array('Indica brevemente el motivo de la supresión.');
  end if;
  if p_source_document_id is null then
    v_warnings:=v_warnings||jsonb_build_array('No se ha asociado una fuente documental a este cambio organizativo.');
  end if;

  return jsonb_build_object(
    'valid',jsonb_array_length(v_errors)=0,
    'errors',v_errors,
    'warnings',v_warnings,
    'jurisdiction',jsonb_build_object(
      'account_id',v_account.id,'account_code',v_account.account_code,'entity_id',v_entity.id,
      'name',v_entity.name,'canonical_status',v_account.canonical_status,'valid_from',v_account.valid_from
    ),
    'current_dependency',case when v_edge.id is null then null else jsonb_build_object(
      'edge_id',v_edge.id,'parent_account_id',v_edge.parent_account_id,'parent_name',v_parent_name,
      'relationship_type',v_edge.relationship_type,'valid_from',v_edge.valid_from
    ) end,
    'active_children_count',v_children,
    'effective_date',p_effective_date,
    'source_document_id',p_source_document_id
  );
end;
$$;

create or replace function public.admin_apply_jurisdiction_suppression(
  p_account_id uuid,
  p_effective_date date,
  p_reason text,
  p_source_document_id uuid default null,
  p_expected_current_edge_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_actor uuid:=auth.uid();
  v_account public.jurisdiction_accounts%rowtype;
  v_entity public.ecclesiastical_entities%rowtype;
  v_edge public.jurisdiction_account_edges%rowtype;
  v_preview jsonb;
  v_operation uuid;
  v_audit uuid;
  v_before_account jsonb;
  v_after_account jsonb;
  v_before_edge jsonb;
  v_after_edge jsonb;
  v_sequence integer:=1;
begin
  if v_actor is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para suprimir jurisdicciones' using errcode='42501';
  end if;

  select * into v_account from public.jurisdiction_accounts where id=p_account_id for update;
  if not found then raise exception 'Cuenta jurisdiccional no encontrada' using errcode='P0002'; end if;
  select * into v_entity from public.ecclesiastical_entities where id=v_account.ecclesiastical_entity_id for update;
  perform id from public.jurisdiction_account_edges where parent_account_id=p_account_id and is_current and status='active' for update;
  select * into v_edge from public.jurisdiction_account_edges
  where child_account_id=p_account_id and is_current and status='active'
  order by created_at desc limit 1 for update;

  if v_edge.id is distinct from p_expected_current_edge_id then
    raise exception 'La dependencia vigente cambió desde la vista previa. Recarga antes de confirmar.' using errcode='40001';
  end if;

  v_preview:=public.admin_preview_jurisdiction_suppression(p_account_id,p_effective_date,p_reason,p_source_document_id);
  if not coalesce((v_preview->>'valid')::boolean,false) then
    raise exception 'Supresión jurisdiccional inválida: %',v_preview->'errors' using errcode='22023';
  end if;

  v_before_account:=jsonb_build_object(
    'account_id',v_account.id,'canonical_status',v_account.canonical_status,'status',v_account.status,
    'is_current',v_account.is_current,'valid_from',v_account.valid_from,'valid_to',v_account.valid_to,
    'entity_status',v_entity.status,'suppressed_at',v_entity.suppressed_at
  );

  if v_edge.id is not null then
    v_before_edge:=jsonb_build_object(
      'edge_id',v_edge.id,'parent_account_id',v_edge.parent_account_id,'child_account_id',v_edge.child_account_id,
      'relationship_type',v_edge.relationship_type,'valid_from',v_edge.valid_from,'valid_to',v_edge.valid_to,
      'is_current',v_edge.is_current,'status',v_edge.status
    );
    update public.jurisdiction_account_edges
    set valid_to=p_effective_date-1,is_current=false,status='inactive',updated_at=now()
    where id=v_edge.id;
    v_after_edge:=v_before_edge||jsonb_build_object('valid_to',p_effective_date-1,'is_current',false,'status','inactive');
  end if;

  update public.jurisdiction_accounts
  set canonical_status='suppressed',valid_to=p_effective_date,is_current=false,status='inactive',
      source_document_id=coalesce(p_source_document_id,source_document_id),updated_at=now()
  where id=p_account_id;
  update public.ecclesiastical_entities
  set status='suppressed',suppressed_at=p_effective_date,updated_at=now()
  where id=v_entity.id;

  v_after_account:=v_before_account||jsonb_build_object(
    'canonical_status','suppressed','status','inactive','is_current',false,'valid_to',p_effective_date,
    'entity_status','suppressed','suppressed_at',p_effective_date
  );

  insert into public.jurisdiction_change_operations(
    origin,status,publication_status,primary_account_id,effective_date,reason,source_document_id,
    operation_source,created_by,applied_by,created_at,applied_at,updated_at
  ) values (
    'organizational_change','applied','internal',p_account_id,p_effective_date,btrim(p_reason),p_source_document_id,
    'admin_organigram',v_actor,v_actor,now(),now(),now()
  ) returning id into v_operation;

  if v_edge.id is not null then
    insert into public.jurisdiction_change_operation_accounts(operation_id,account_id,role)
    values(v_operation,v_edge.parent_account_id,'origin') on conflict do nothing;
    insert into public.jurisdiction_change_effects(operation_id,sequence,target_type,target_id,action,before_state,after_state,applied_at)
    values(v_operation,v_sequence,'edge',v_edge.id,'close_dependency',v_before_edge,v_after_edge,now());
    v_sequence:=v_sequence+1;
  end if;
  insert into public.jurisdiction_change_effects(operation_id,sequence,target_type,target_id,action,before_state,after_state,applied_at)
  values(v_operation,v_sequence,'account',p_account_id,'deactivate_account',v_before_account,v_after_account,now());

  v_audit:=public.admin_write_audit_log(
    'jurisdiction.suppression','jurisdiction_accounts',p_account_id,
    jsonb_build_object(
      'kind','organizational_change','operation_id',v_operation,'reason',btrim(p_reason),
      'effective_date',p_effective_date,'source_document_id',p_source_document_id,
      'before',jsonb_build_object('account',v_before_account,'dependency',v_before_edge),
      'after',jsonb_build_object('account',v_after_account,'dependency',v_after_edge)
    )
  );

  return jsonb_build_object(
    'status','applied','operation_id',v_operation,'audit_id',v_audit,'account_id',p_account_id,
    'closed_edge_id',v_edge.id,'preview',v_preview
  );
end;
$$;

create or replace function public.admin_preview_jurisdiction_restoration(
  p_account_id uuid,
  p_parent_account_id uuid,
  p_relationship_type text,
  p_effective_date date,
  p_reason text,
  p_source_document_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_actor uuid:=auth.uid();
  v_account public.jurisdiction_accounts%rowtype;
  v_entity public.ecclesiastical_entities%rowtype;
  v_parent public.jurisdiction_accounts%rowtype;
  v_parent_entity public.ecclesiastical_entities%rowtype;
  v_rule public.jurisdiction_account_type_rules%rowtype;
  v_current_edge uuid;
  v_errors jsonb:='[]'::jsonb;
  v_warnings jsonb:='[]'::jsonb;
begin
  if v_actor is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para restaurar jurisdicciones' using errcode='42501';
  end if;

  select * into v_account from public.jurisdiction_accounts where id=p_account_id;
  if not found then raise exception 'Cuenta jurisdiccional no encontrada' using errcode='P0002'; end if;
  select * into v_entity from public.ecclesiastical_entities where id=v_account.ecclesiastical_entity_id;
  select * into v_parent from public.jurisdiction_accounts where id=p_parent_account_id;
  if not found then raise exception 'Cuenta jurisdiccional superior no encontrada' using errcode='P0002'; end if;
  select * into v_parent_entity from public.ecclesiastical_entities where id=v_parent.ecclesiastical_entity_id;

  select id into v_current_edge from public.jurisdiction_account_edges
  where child_account_id=p_account_id and is_current and status='active' limit 1;
  select * into v_rule from public.jurisdiction_account_type_rules
  where parent_entity_type_id=v_parent_entity.entity_type_id
    and child_entity_type_id=v_entity.entity_type_id
    and relationship_type=btrim(p_relationship_type)
    and status='active' and is_allowed limit 1;

  if v_account.is_current or v_account.status='active' then
    v_errors:=v_errors||jsonb_build_array('La jurisdicción ya está activa en el organigrama vigente.');
  end if;
  if not v_parent.is_current or v_parent.status<>'active' then
    v_errors:=v_errors||jsonb_build_array('La dependencia seleccionada no está activa.');
  end if;
  if p_account_id=p_parent_account_id then
    v_errors:=v_errors||jsonb_build_array('Una jurisdicción no puede depender de sí misma.');
  end if;
  if v_current_edge is not null then
    v_errors:=v_errors||jsonb_build_array('La jurisdicción ya tiene una dependencia vigente.');
  end if;
  if v_rule.id is null then
    v_errors:=v_errors||jsonb_build_array('La relación padre/hijo seleccionada no está permitida.');
  elsif v_rule.requires_source and p_source_document_id is null then
    v_errors:=v_errors||jsonb_build_array('Esta restauración requiere una fuente documental.');
  end if;
  if p_effective_date is null then
    v_errors:=v_errors||jsonb_build_array('La fecha efectiva es obligatoria.');
  elsif v_account.valid_to is not null and p_effective_date<=v_account.valid_to then
    v_errors:=v_errors||jsonb_build_array('La fecha de restauración debe ser posterior al cierre anterior.');
  end if;
  if nullif(btrim(p_reason),'') is null then
    v_errors:=v_errors||jsonb_build_array('Indica brevemente el motivo de la restauración.');
  end if;
  if v_account.canonical_status<>'suppressed' and v_entity.status<>'suppressed' then
    v_warnings:=v_warnings||jsonb_build_array('La cuenta no estaba marcada explícitamente como suprimida; se tratará como corrección organizativa.');
  end if;

  return jsonb_build_object(
    'valid',jsonb_array_length(v_errors)=0,'errors',v_errors,'warnings',v_warnings,
    'jurisdiction',jsonb_build_object(
      'account_id',v_account.id,'account_code',v_account.account_code,'entity_id',v_entity.id,
      'name',v_entity.name,'canonical_status',v_account.canonical_status,'valid_to',v_account.valid_to
    ),
    'proposed_dependency',jsonb_build_object(
      'parent_account_id',v_parent.id,'parent_name',v_parent_entity.name,
      'relationship_type',btrim(p_relationship_type),'effective_date',p_effective_date
    ),
    'requires_source',coalesce(v_rule.requires_source,false),
    'source_document_id',p_source_document_id
  );
end;
$$;

create or replace function public.admin_apply_jurisdiction_restoration(
  p_account_id uuid,
  p_parent_account_id uuid,
  p_relationship_type text,
  p_effective_date date,
  p_reason text,
  p_source_document_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_actor uuid:=auth.uid();
  v_account public.jurisdiction_accounts%rowtype;
  v_entity public.ecclesiastical_entities%rowtype;
  v_parent public.jurisdiction_accounts%rowtype;
  v_preview jsonb;
  v_edge uuid;
  v_operation uuid;
  v_audit uuid;
  v_before jsonb;
  v_after jsonb;
  v_after_edge jsonb;
  v_visibility text;
begin
  if v_actor is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para restaurar jurisdicciones' using errcode='42501';
  end if;

  select * into v_account from public.jurisdiction_accounts where id=p_account_id for update;
  if not found then raise exception 'Cuenta jurisdiccional no encontrada' using errcode='P0002'; end if;
  select * into v_entity from public.ecclesiastical_entities where id=v_account.ecclesiastical_entity_id for update;
  select * into v_parent from public.jurisdiction_accounts where id=p_parent_account_id for update;
  if not found then raise exception 'Cuenta jurisdiccional superior no encontrada' using errcode='P0002'; end if;
  perform id from public.jurisdiction_account_edges
  where child_account_id=p_account_id and is_current and status='active' for update;

  v_preview:=public.admin_preview_jurisdiction_restoration(
    p_account_id,p_parent_account_id,p_relationship_type,p_effective_date,p_reason,p_source_document_id
  );
  if not coalesce((v_preview->>'valid')::boolean,false) then
    raise exception 'Restauración jurisdiccional inválida: %',v_preview->'errors' using errcode='22023';
  end if;

  v_before:=jsonb_build_object(
    'account_id',v_account.id,'canonical_status',v_account.canonical_status,'status',v_account.status,
    'is_current',v_account.is_current,'valid_from',v_account.valid_from,'valid_to',v_account.valid_to,
    'entity_status',v_entity.status,'suppressed_at',v_entity.suppressed_at
  );

  update public.jurisdiction_accounts
  set canonical_status='restored',valid_to=null,is_current=true,status='active',
      source_document_id=coalesce(p_source_document_id,source_document_id),updated_at=now()
  where id=p_account_id;
  update public.ecclesiastical_entities
  set status='active',suppressed_at=null,updated_at=now()
  where id=v_entity.id;

  v_after:=v_before||jsonb_build_object(
    'canonical_status','restored','status','active','is_current',true,'valid_to',null,
    'entity_status','active','suppressed_at',null
  );
  v_visibility:=case when v_account.visibility='public' and v_parent.visibility='public' then 'public' else 'internal' end;

  insert into public.jurisdiction_account_edges(
    parent_account_id,child_account_id,relationship_type,valid_from,is_current,status,visibility,
    source_document_id,notes,created_by
  ) values (
    p_parent_account_id,p_account_id,btrim(p_relationship_type),p_effective_date,true,'active',v_visibility,
    p_source_document_id,nullif(btrim(p_reason),''),v_actor
  ) returning id into v_edge;

  v_after_edge:=jsonb_build_object(
    'edge_id',v_edge,'parent_account_id',p_parent_account_id,'child_account_id',p_account_id,
    'relationship_type',btrim(p_relationship_type),'valid_from',p_effective_date,'valid_to',null,
    'is_current',true,'status','active','source_document_id',p_source_document_id
  );

  insert into public.jurisdiction_change_operations(
    origin,status,publication_status,primary_account_id,effective_date,reason,source_document_id,
    operation_source,created_by,applied_by,created_at,applied_at,updated_at
  ) values (
    'organizational_change','applied','internal',p_account_id,p_effective_date,btrim(p_reason),p_source_document_id,
    'admin_organigram',v_actor,v_actor,now(),now(),now()
  ) returning id into v_operation;

  insert into public.jurisdiction_change_operation_accounts(operation_id,account_id,role)
  values(v_operation,p_parent_account_id,'destination') on conflict do nothing;
  insert into public.jurisdiction_change_effects(operation_id,sequence,target_type,target_id,action,before_state,after_state,applied_at)
  values
    (v_operation,1,'account',p_account_id,'activate_account',v_before,v_after,now()),
    (v_operation,2,'edge',v_edge,'create_dependency',null,v_after_edge,now());

  v_audit:=public.admin_write_audit_log(
    'jurisdiction.restoration','jurisdiction_accounts',p_account_id,
    jsonb_build_object(
      'kind','organizational_change','operation_id',v_operation,'reason',btrim(p_reason),
      'effective_date',p_effective_date,'source_document_id',p_source_document_id,
      'before',jsonb_build_object('account',v_before),
      'after',jsonb_build_object('account',v_after,'dependency',v_after_edge)
    )
  );

  return jsonb_build_object(
    'status','applied','operation_id',v_operation,'audit_id',v_audit,
    'account_id',p_account_id,'current_edge_id',v_edge,'preview',v_preview
  );
end;
$$;

revoke execute on function public.admin_preview_jurisdiction_suppression(uuid,date,text,uuid) from public,anon;
grant execute on function public.admin_preview_jurisdiction_suppression(uuid,date,text,uuid) to authenticated;
revoke execute on function public.admin_apply_jurisdiction_suppression(uuid,date,text,uuid,uuid) from public,anon;
grant execute on function public.admin_apply_jurisdiction_suppression(uuid,date,text,uuid,uuid) to authenticated;
revoke execute on function public.admin_preview_jurisdiction_restoration(uuid,uuid,text,date,text,uuid) from public,anon;
grant execute on function public.admin_preview_jurisdiction_restoration(uuid,uuid,text,date,text,uuid) to authenticated;
revoke execute on function public.admin_apply_jurisdiction_restoration(uuid,uuid,text,date,text,uuid) from public,anon;
grant execute on function public.admin_apply_jurisdiction_restoration(uuid,uuid,text,date,text,uuid) to authenticated;
