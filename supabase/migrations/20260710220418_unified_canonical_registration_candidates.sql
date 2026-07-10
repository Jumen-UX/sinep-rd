create or replace function internal.admin_list_canonical_registration_candidates(
  p_flow text,
  p_limit integer default 500
)
returns table (
  id uuid,
  first_name text,
  middle_name text,
  last_name text,
  second_last_name text,
  display_name text,
  slug text,
  gender text,
  birth_date date,
  birth_place text,
  photo_url text,
  biography_public text,
  highest_ordination_degree text,
  effective_person_type text,
  is_religious boolean,
  religious_life_type text
)
language plpgsql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_flow text := lower(nullif(btrim(p_flow), ''));
  v_limit integer := greatest(1, least(coalesce(p_limit, 500), 1000));
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  if not public.current_user_has_permission('people.create_proposal')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para consultar candidatos de registro' using errcode = '42501';
  end if;

  if v_flow not in ('layperson', 'religious', 'deacon', 'priest', 'bishop') then
    raise exception 'Flujo de registro canónico inválido' using errcode = '22023';
  end if;

  return query
  select
    pes.id,
    pes.first_name,
    pes.middle_name,
    pes.last_name,
    pes.second_last_name,
    pes.display_name,
    pes.slug,
    pes.gender,
    pes.birth_date,
    pes.birth_place,
    pes.photo_url,
    pes.biography_public,
    pes.highest_ordination_degree,
    pes.effective_person_type,
    (rp.person_id is not null) as is_religious,
    rp.religious_life_type
  from public.person_ecclesial_state pes
  left join public.religious_profiles rp on rp.person_id = pes.id
  where pes.status = 'active'
    and (
      public.current_user_is_super_or_national()
      or app_private.current_user_can_manage_person('people.create_proposal', pes.id)
    )
    and case v_flow
      when 'layperson' then not pes.has_diaconate and not pes.has_presbyterate and not pes.has_episcopate
      when 'religious' then rp.person_id is null
      when 'deacon' then not pes.has_diaconate and not pes.has_presbyterate and not pes.has_episcopate
      when 'priest' then pes.has_diaconate and not pes.has_presbyterate and not pes.has_episcopate
      when 'bishop' then pes.has_presbyterate and not pes.has_episcopate
      else false
    end
  order by pes.display_name
  limit v_limit;
end;
$$;

create or replace function public.admin_list_canonical_registration_candidates(
  p_flow text,
  p_limit integer default 500
)
returns table (
  id uuid,
  first_name text,
  middle_name text,
  last_name text,
  second_last_name text,
  display_name text,
  slug text,
  gender text,
  birth_date date,
  birth_place text,
  photo_url text,
  biography_public text,
  highest_ordination_degree text,
  effective_person_type text,
  is_religious boolean,
  religious_life_type text
)
language sql
stable
set search_path = public, internal, pg_temp
as $$
  select *
  from internal.admin_list_canonical_registration_candidates(p_flow, p_limit);
$$;

revoke all on function internal.admin_list_canonical_registration_candidates(text, integer) from public, anon;
grant execute on function internal.admin_list_canonical_registration_candidates(text, integer) to authenticated;

revoke all on function public.admin_list_canonical_registration_candidates(text, integer) from public, anon;
grant execute on function public.admin_list_canonical_registration_candidates(text, integer) to authenticated;

comment on function public.admin_list_canonical_registration_candidates(text, integer) is
  'Catálogo administrativo común de personas que pueden continuar por cada flujo canónico sin duplicar identidad.';
