create or replace function internal.apply_office_canonical_rules(p_office_configuration_id uuid, payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_degree text := coalesce(nullif(payload->>'required_ordination_degree',''), 'none');
  v_cardinality text := coalesce(nullif(payload->>'holder_cardinality',''), 'single');
  v_max integer := nullif(payload->>'max_current_holders','')::integer;
  v_person_types text[];
  v_statuses text[];
  v_roles text[];
begin
  if v_degree not in ('none','diaconate','presbyterate','episcopate') then
    raise exception 'Grado mínimo del Orden no permitido' using errcode='22023';
  end if;
  if v_cardinality not in ('single','multiple') then
    raise exception 'Cardinalidad de titulares no permitida' using errcode='22023';
  end if;

  select coalesce(array_agg(value), '{}'::text[]) into v_person_types
  from jsonb_array_elements_text(coalesce(payload->'allowed_person_types','[]'::jsonb)) value;
  select coalesce(array_agg(value), '{}'::text[]) into v_statuses
  from jsonb_array_elements_text(coalesce(payload->'allowed_clerical_statuses','[]'::jsonb)) value;
  select coalesce(array_agg(value), '{}'::text[]) into v_roles
  from jsonb_array_elements_text(coalesce(payload->'allowed_episcopal_role_types','[]'::jsonb)) value;

  if exists (select 1 from unnest(v_person_types) x where x not in ('bishop','priest','deacon','religious','layperson')) then
    raise exception 'La lista contiene un tipo de persona no permitido' using errcode='22023';
  end if;
  if exists (select 1 from unnest(v_statuses) x where x not in ('active','retired','emeritus','suspended','restricted','inactive','deceased','lost_clerical_state','unknown')) then
    raise exception 'La lista contiene un estado canónico no permitido' using errcode='22023';
  end if;
  if exists (select 1 from unnest(v_roles) x where x not in ('diocesan','auxiliary','coadjutor','titular','emeritus','apostolic_administrator','apostolic_vicar','apostolic_prefect','other')) then
    raise exception 'La lista contiene una función episcopal no permitida' using errcode='22023';
  end if;

  if cardinality(v_person_types)=0 then
    v_person_types := array['bishop','priest','deacon','religious','layperson'];
  end if;
  if cardinality(v_statuses)=0 and v_degree <> 'none' then
    v_statuses := array['active','retired','emeritus','unknown'];
  end if;
  if v_cardinality='single' then
    v_max := 1;
  elsif v_max is not null and v_max < 2 then
    raise exception 'Un cargo con múltiples titulares debe permitir al menos dos' using errcode='22023';
  end if;

  update public.office_configurations
  set required_ordination_degree=v_degree,
      allowed_person_types=v_person_types,
      allowed_clerical_statuses=v_statuses,
      allowed_episcopal_role_types=v_roles,
      holder_cardinality=v_cardinality,
      max_current_holders=v_max,
      requires_clergy=(v_degree <> 'none') or coalesce((payload->>'requires_clergy')::boolean,false),
      updated_at=now()
  where id=p_office_configuration_id;
end;
$$;

create or replace function public.admin_save_office_configuration(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, internal, pg_temp
as $$
declare
  v_result jsonb;
  v_id uuid;
begin
  v_result := internal.admin_save_office_configuration(payload);
  v_id := nullif(v_result->>'office_configuration_id','')::uuid;
  perform internal.apply_office_canonical_rules(v_id,payload);
  return v_result || jsonb_build_object(
    'required_ordination_degree',coalesce(nullif(payload->>'required_ordination_degree',''),'none'),
    'holder_cardinality',coalesce(nullif(payload->>'holder_cardinality',''),'single')
  );
end;
$$;

revoke all on function internal.apply_office_canonical_rules(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.admin_save_office_configuration(jsonb) from public, anon;
grant execute on function public.admin_save_office_configuration(jsonb) to authenticated;
