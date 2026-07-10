create or replace function internal.evaluate_position_assignment_eligibility(
  p_person_id uuid,
  p_office_configuration_id uuid,
  p_ecclesiastical_entity_id uuid default null,
  p_pending_episcopal_role_type text default null,
  p_check_episcopal_role boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, internal, pg_temp
as $$
declare
  v_office_name text;
  v_requires_clergy boolean;
  v_allowed_person_types text[];
  v_required_degree text;
  v_allowed_roles text[];
  v_allowed_statuses text[];
  v_link_requires_priest boolean;
  v_link_requires_bishop boolean;
  v_highest_degree text;
  v_has_diaconate boolean;
  v_has_presbyterate boolean;
  v_has_episcopate boolean;
  v_person_category text;
  v_is_religious boolean;
  v_status text;
  v_required_rank integer;
  v_person_rank integer;
  v_type_allowed boolean;
  v_role_allowed boolean := true;
begin
  select oc.display_name, oc.requires_clergy, oc.allowed_person_types,
         oc.required_ordination_degree, oc.allowed_episcopal_role_types,
         oc.allowed_clerical_statuses,
         coalesce(bool_or(cod.requires_priest) filter (where cod.id is not null), false),
         coalesce(bool_or(cod.requires_bishop) filter (where cod.id is not null), false)
  into v_office_name, v_requires_clergy, v_allowed_person_types,
       v_required_degree, v_allowed_roles, v_allowed_statuses,
       v_link_requires_priest, v_link_requires_bishop
  from public.office_configurations oc
  left join public.office_canonical_links ocl on ocl.office_configuration_id = oc.id
  left join public.canonical_office_definitions cod
    on cod.id = ocl.canonical_office_definition_id and cod.status = 'active'
  where oc.id = p_office_configuration_id and oc.status = 'active'
  group by oc.id;

  if not found then
    return jsonb_build_object('eligible',false,'reason_code','office_not_found','message','El cargo configurado no existe o no está activo.');
  end if;

  select pes.highest_ordination_degree, pes.has_diaconate, pes.has_presbyterate, pes.has_episcopate
  into v_highest_degree, v_has_diaconate, v_has_presbyterate, v_has_episcopate
  from public.person_ecclesial_state pes
  where pes.id = p_person_id and pes.status = 'active';

  if not found then
    return jsonb_build_object('eligible',false,'reason_code','person_not_found','message','La persona no existe o no está activa.');
  end if;

  v_person_category := case v_highest_degree
    when 'episcopate' then 'bishop'
    when 'presbyterate' then 'priest'
    when 'diaconate' then 'deacon'
    else 'layperson'
  end;

  select exists(
    select 1 from public.religious_profiles rp
    where rp.person_id = p_person_id
      and coalesce(rp.canonical_status,'active') <> 'deceased'
  ) into v_is_religious;

  select csh.status_type into v_status
  from public.clerical_status_history csh
  where csh.person_id = p_person_id
    and csh.is_current = true
    and csh.record_status = 'active'
  order by coalesce(csh.start_date,date '0001-01-01') desc, csh.created_at desc
  limit 1;

  v_status := coalesce(v_status,'unknown');

  if v_status in ('deceased','lost_clerical_state') then
    return jsonb_build_object(
      'eligible',false,'reason_code','terminal_clerical_status',
      'message','La persona tiene un estado canónico terminal y no puede recibir un cargo vigente.',
      'current_clerical_status',v_status,'person_category',v_person_category,'office_name',v_office_name
    );
  end if;

  v_required_rank := case v_required_degree
    when 'episcopate' then 3 when 'presbyterate' then 2 when 'diaconate' then 1 else 0 end;

  if v_link_requires_bishop then
    v_required_rank := greatest(v_required_rank,3);
    v_required_degree := 'episcopate';
  elsif v_link_requires_priest then
    v_required_rank := greatest(v_required_rank,2);
    if v_required_rank = 2 then v_required_degree := 'presbyterate'; end if;
  end if;

  v_person_rank := case v_highest_degree
    when 'episcopate' then 3 when 'presbyterate' then 2 when 'diaconate' then 1 else 0 end;

  if v_requires_clergy and not coalesce(v_has_diaconate,false) then
    return jsonb_build_object(
      'eligible',false,'reason_code','clergy_required',
      'message',format('El cargo %s requiere una persona ordenada.',v_office_name),
      'person_category',v_person_category,'required_ordination_degree',v_required_degree,'office_name',v_office_name
    );
  end if;

  if v_person_rank < v_required_rank then
    return jsonb_build_object(
      'eligible',false,'reason_code','ordination_degree_required',
      'message',format('El cargo %s requiere como mínimo el grado %s.',v_office_name,v_required_degree),
      'person_category',v_person_category,'highest_ordination_degree',v_highest_degree,
      'required_ordination_degree',v_required_degree,'office_name',v_office_name
    );
  end if;

  v_type_allowed := v_person_category = any(v_allowed_person_types)
    or (v_is_religious and 'religious' = any(v_allowed_person_types));

  if not coalesce(v_type_allowed,false) then
    return jsonb_build_object(
      'eligible',false,'reason_code','person_category_not_allowed',
      'message',format('La condición eclesial de la persona no es compatible con el cargo %s.',v_office_name),
      'person_category',v_person_category,'is_religious',v_is_religious,
      'allowed_person_types',v_allowed_person_types,'office_name',v_office_name
    );
  end if;

  if v_person_rank > 0 and not (v_status = any(v_allowed_statuses)) then
    return jsonb_build_object(
      'eligible',false,'reason_code','clerical_status_not_allowed',
      'message',format('El estado canónico %s no permite asumir el cargo %s.',v_status,v_office_name),
      'current_clerical_status',v_status,'allowed_clerical_statuses',v_allowed_statuses,'office_name',v_office_name
    );
  end if;

  if p_check_episcopal_role and cardinality(v_allowed_roles) > 0 then
    v_role_allowed := p_pending_episcopal_role_type = any(v_allowed_roles);

    if not coalesce(v_role_allowed,false) then
      select exists(
        select 1 from public.episcopal_roles er
        where er.person_id = p_person_id
          and er.is_current = true
          and er.record_status = 'active'
          and er.role_type = any(v_allowed_roles)
          and (p_ecclesiastical_entity_id is null or er.jurisdiction_entity_id is not distinct from p_ecclesiastical_entity_id)
      ) into v_role_allowed;
    end if;

    if not coalesce(v_role_allowed,false) then
      return jsonb_build_object(
        'eligible',false,'reason_code','episcopal_role_required',
        'message',format('El cargo %s requiere una función episcopal compatible en la misma jurisdicción.',v_office_name),
        'allowed_episcopal_role_types',v_allowed_roles,'office_name',v_office_name
      );
    end if;
  end if;

  return jsonb_build_object(
    'eligible',true,'reason_code','eligible',
    'message','La persona cumple las condiciones canónicas configuradas para el cargo.',
    'person_category',v_person_category,'highest_ordination_degree',v_highest_degree,
    'is_religious',v_is_religious,'current_clerical_status',v_status,
    'required_ordination_degree',v_required_degree,
    'allowed_episcopal_role_types',v_allowed_roles,'office_name',v_office_name
  );
end;
$$;

revoke all on function internal.evaluate_position_assignment_eligibility(uuid,uuid,uuid,text,boolean) from public, anon;
grant execute on function internal.evaluate_position_assignment_eligibility(uuid,uuid,uuid,text,boolean) to authenticated;

create or replace function public.admin_check_position_assignment_eligibility(
  p_person_id uuid,
  p_office_configuration_id uuid,
  p_ecclesiastical_entity_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, internal, pg_temp
as $$
begin
  if auth.uid() is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para consultar elegibilidad de cargos' using errcode = '42501';
  end if;

  return internal.evaluate_position_assignment_eligibility(
    p_person_id,p_office_configuration_id,p_ecclesiastical_entity_id,null,true
  );
end;
$$;

revoke all on function public.admin_check_position_assignment_eligibility(uuid,uuid,uuid) from public, anon;
grant execute on function public.admin_check_position_assignment_eligibility(uuid,uuid,uuid) to authenticated;
