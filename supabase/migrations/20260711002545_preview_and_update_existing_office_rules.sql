create or replace function internal.evaluate_person_against_proposed_office_rules(
  p_person_id uuid,
  p_ecclesiastical_entity_id uuid,
  p_office_configuration_id uuid,
  payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, internal, pg_temp
as $$
declare
  v_degree text := coalesce(nullif(payload->>'required_ordination_degree',''), 'none');
  v_requires_clergy boolean := (v_degree <> 'none') or coalesce((payload->>'requires_clergy')::boolean,false);
  v_person_types text[];
  v_statuses text[];
  v_roles text[];
  v_highest_degree text;
  v_has_diaconate boolean;
  v_person_category text;
  v_is_religious boolean;
  v_status text;
  v_person_rank integer;
  v_required_rank integer;
  v_role_allowed boolean := true;
  v_link_requires_priest boolean := false;
  v_link_requires_bishop boolean := false;
begin
  select coalesce(array_agg(value), '{}'::text[]) into v_person_types
  from jsonb_array_elements_text(coalesce(payload->'allowed_person_types','[]'::jsonb)) value;
  select coalesce(array_agg(value), '{}'::text[]) into v_statuses
  from jsonb_array_elements_text(coalesce(payload->'allowed_clerical_statuses','[]'::jsonb)) value;
  select coalesce(array_agg(value), '{}'::text[]) into v_roles
  from jsonb_array_elements_text(coalesce(payload->'allowed_episcopal_role_types','[]'::jsonb)) value;

  if cardinality(v_person_types)=0 then
    v_person_types := array['bishop','priest','deacon','religious','layperson'];
  end if;
  if cardinality(v_statuses)=0 and v_degree <> 'none' then
    v_statuses := array['active','retired','emeritus','unknown'];
  end if;

  select coalesce(bool_or(cod.requires_priest) filter (where cod.id is not null), false),
         coalesce(bool_or(cod.requires_bishop) filter (where cod.id is not null), false)
  into v_link_requires_priest, v_link_requires_bishop
  from public.office_canonical_links ocl
  join public.canonical_office_definitions cod on cod.id=ocl.canonical_office_definition_id and cod.status='active'
  where ocl.office_configuration_id=p_office_configuration_id;

  select highest_ordination_degree, has_diaconate
  into v_highest_degree, v_has_diaconate
  from public.person_ecclesial_state
  where id=p_person_id and status='active';

  if not found then
    return jsonb_build_object('eligible',false,'reason_code','person_not_found','message','La persona no existe o no está activa.');
  end if;

  v_person_category := case v_highest_degree when 'episcopate' then 'bishop' when 'presbyterate' then 'priest' when 'diaconate' then 'deacon' else 'layperson' end;
  v_person_rank := case v_highest_degree when 'episcopate' then 3 when 'presbyterate' then 2 when 'diaconate' then 1 else 0 end;
  v_required_rank := case v_degree when 'episcopate' then 3 when 'presbyterate' then 2 when 'diaconate' then 1 else 0 end;

  if v_link_requires_bishop then v_required_rank:=greatest(v_required_rank,3); v_degree:='episcopate';
  elsif v_link_requires_priest then v_required_rank:=greatest(v_required_rank,2); if v_required_rank=2 then v_degree:='presbyterate'; end if;
  end if;

  select exists(select 1 from public.religious_profiles rp where rp.person_id=p_person_id and coalesce(rp.canonical_status,'active') <> 'deceased') into v_is_religious;
  select status_type into v_status from public.clerical_status_history
  where person_id=p_person_id and is_current=true and record_status='active'
  order by coalesce(start_date,date '0001-01-01') desc, created_at desc limit 1;
  v_status:=coalesce(v_status,'unknown');

  if v_status in ('deceased','lost_clerical_state') then
    return jsonb_build_object('eligible',false,'reason_code','terminal_clerical_status','message','La persona tiene un estado canónico terminal.');
  end if;
  if v_requires_clergy and not coalesce(v_has_diaconate,false) then
    return jsonb_build_object('eligible',false,'reason_code','clergy_required','message','El cargo requiere una persona ordenada.');
  end if;
  if v_person_rank < v_required_rank then
    return jsonb_build_object('eligible',false,'reason_code','ordination_degree_required','message',format('Requiere como mínimo el grado %s.',v_degree));
  end if;
  if not (v_person_category=any(v_person_types) or (v_is_religious and 'religious'=any(v_person_types))) then
    return jsonb_build_object('eligible',false,'reason_code','person_category_not_allowed','message','La condición eclesial de la persona no está permitida.');
  end if;
  if v_person_rank>0 and not (v_status=any(v_statuses)) then
    return jsonb_build_object('eligible',false,'reason_code','clerical_status_not_allowed','message',format('El estado canónico %s no está permitido.',v_status));
  end if;
  if cardinality(v_roles)>0 then
    select exists(
      select 1 from public.episcopal_roles er
      where er.person_id=p_person_id and er.is_current=true and er.record_status='active'
        and er.role_type=any(v_roles)
        and (p_ecclesiastical_entity_id is null or er.jurisdiction_entity_id is not distinct from p_ecclesiastical_entity_id)
    ) into v_role_allowed;
    if not v_role_allowed then
      return jsonb_build_object('eligible',false,'reason_code','episcopal_role_required','message','No posee una función episcopal compatible en la misma jurisdicción.');
    end if;
  end if;

  return jsonb_build_object('eligible',true,'reason_code','eligible','message','Compatible con las reglas propuestas.');
end;
$$;

create or replace function internal.preview_office_rule_change(p_office_configuration_id uuid, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, internal, pg_temp
as $$
declare
  v_user_id uuid:=auth.uid();
  v_total integer:=0;
  v_incompatible integer:=0;
  v_items jsonb:='[]'::jsonb;
  r record;
  v_result jsonb;
begin
  if v_user_id is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para revisar el impacto de cargos' using errcode='42501';
  end if;
  if not exists(select 1 from public.office_configurations where id=p_office_configuration_id and status='active') then
    raise exception 'Cargo no encontrado' using errcode='22023';
  end if;

  for r in
    select pa.id assignment_id, pa.person_id, pa.ecclesiastical_entity_id,
           p.display_name person_name, coalesce(e.name,'Sin entidad') entity_name
    from public.position_assignments pa
    join public.persons p on p.id=pa.person_id
    left join public.ecclesiastical_entities e on e.id=pa.ecclesiastical_entity_id
    where pa.office_configuration_id=p_office_configuration_id
      and pa.is_current=true and pa.record_status='active'
  loop
    v_total:=v_total+1;
    v_result:=internal.evaluate_person_against_proposed_office_rules(r.person_id,r.ecclesiastical_entity_id,p_office_configuration_id,payload);
    if not coalesce((v_result->>'eligible')::boolean,false) then
      v_incompatible:=v_incompatible+1;
      v_items:=v_items || jsonb_build_array(jsonb_build_object(
        'assignment_id',r.assignment_id,'person_id',r.person_id,'person_name',r.person_name,
        'entity_name',r.entity_name,'reason_code',v_result->>'reason_code','message',v_result->>'message'
      ));
    end if;
  end loop;

  return jsonb_build_object('office_configuration_id',p_office_configuration_id,'current_assignments',v_total,'incompatible_assignments',v_incompatible,'items',v_items);
end;
$$;

create or replace function public.admin_preview_office_rule_change(p_office_configuration_id uuid, payload jsonb)
returns jsonb
language sql
security invoker
set search_path=public,internal,pg_temp
as $$ select internal.preview_office_rule_change(p_office_configuration_id,payload); $$;

create or replace function internal.admin_update_office_configuration(p_office_configuration_id uuid, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,internal,auth,pg_temp
as $$
declare
  v_user_id uuid:=auth.uid();
  v_preview jsonb;
  v_confirm boolean:=coalesce((payload->>'confirm_incompatible_assignments')::boolean,false);
  v_display_name text:=nullif(btrim(payload->>'display_name'),'');
  v_description text:=nullif(btrim(payload->>'description'),'');
begin
  if v_user_id is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para editar cargos oficiales' using errcode='42501';
  end if;

  select internal.preview_office_rule_change(p_office_configuration_id,payload) into v_preview;
  if coalesce((v_preview->>'incompatible_assignments')::integer,0)>0 and not v_confirm then
    raise exception 'El cambio dejaría nombramientos vigentes incompatibles; confirma expresamente para continuar' using errcode='P0001';
  end if;

  update public.office_configurations
  set display_name=coalesce(v_display_name,display_name), description=v_description, updated_at=now()
  where id=p_office_configuration_id and status='active';
  if not found then raise exception 'Cargo no encontrado' using errcode='22023'; end if;

  perform internal.apply_office_canonical_rules(p_office_configuration_id,payload);

  insert into public.audit_logs(user_id,action,target_table,target_id,new_data)
  values(v_user_id,'admin_update_office_configuration','office_configurations',p_office_configuration_id,
    jsonb_build_object('payload',payload-'confirm_incompatible_assignments','impact',v_preview));

  return jsonb_build_object('office_configuration_id',p_office_configuration_id,'impact',v_preview,'updated',true);
end;
$$;

create or replace function public.admin_update_office_configuration(p_office_configuration_id uuid, payload jsonb)
returns jsonb
language sql
security invoker
set search_path=public,internal,pg_temp
as $$ select internal.admin_update_office_configuration(p_office_configuration_id,payload); $$;

revoke all on function internal.evaluate_person_against_proposed_office_rules(uuid,uuid,uuid,jsonb) from public,anon;
revoke all on function internal.preview_office_rule_change(uuid,jsonb) from public,anon;
revoke all on function internal.admin_update_office_configuration(uuid,jsonb) from public,anon;
grant execute on function internal.preview_office_rule_change(uuid,jsonb) to authenticated;
grant execute on function internal.admin_update_office_configuration(uuid,jsonb) to authenticated;
grant execute on function internal.evaluate_person_against_proposed_office_rules(uuid,uuid,uuid,jsonb) to authenticated;

revoke all on function public.admin_preview_office_rule_change(uuid,jsonb) from public,anon;
revoke all on function public.admin_update_office_configuration(uuid,jsonb) from public,anon;
grant execute on function public.admin_preview_office_rule_change(uuid,jsonb) to authenticated;
grant execute on function public.admin_update_office_configuration(uuid,jsonb) to authenticated;