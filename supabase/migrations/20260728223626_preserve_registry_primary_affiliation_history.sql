create unique index if not exists ecclesiastical_place_affiliations_one_current_primary_idx
  on public.ecclesiastical_place_affiliations(place_id)
  where is_current = true
    and status = 'active'
    and relationship_type in ('belongs_to','seat_of');

create unique index if not exists ecclesial_institution_affiliations_one_current_primary_idx
  on public.ecclesial_institution_affiliations(institution_id)
  where is_current = true
    and status = 'active'
    and relationship_type = 'belongs_to';

create or replace function app_private.enforce_place_primary_affiliation_consistency()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth, pg_temp
as $$
declare
  v_primary_entity_id uuid;
  v_expected_type text;
begin
  select place.primary_entity_id,
         case when place.is_primary_seat then 'seat_of' else 'belongs_to' end
    into v_primary_entity_id, v_expected_type
  from public.ecclesiastical_places place
  where place.id = new.place_id;

  if v_primary_entity_id is null then
    raise exception 'Lugar eclesiástico no encontrado para la afiliación.' using errcode = 'P0002';
  end if;

  if new.is_current = true
     and new.status = 'active'
     and new.relationship_type in ('belongs_to','seat_of')
     and (
       new.ecclesiastical_entity_id is distinct from v_primary_entity_id
       or new.relationship_type is distinct from v_expected_type
       or new.organization_unit_id is not null
       or new.institution_id is not null
     ) then
    raise exception 'La afiliación primaria debe coincidir con la entidad principal y la condición de sede del lugar.'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
     and old.is_current = true
     and old.status = 'active'
     and old.relationship_type in ('belongs_to','seat_of')
     and old.ecclesiastical_entity_id = v_primary_entity_id
     and old.relationship_type = v_expected_type
     and (
       new.is_current is distinct from true
       or new.status is distinct from 'active'
       or new.relationship_type is distinct from old.relationship_type
       or new.ecclesiastical_entity_id is distinct from old.ecclesiastical_entity_id
       or new.organization_unit_id is not null
       or new.institution_id is not null
     )
     and not exists (
       select 1
       from public.ecclesiastical_place_affiliations other
       where other.place_id = old.place_id
         and other.id <> old.id
         and other.is_current = true
         and other.status = 'active'
         and other.relationship_type = v_expected_type
         and other.ecclesiastical_entity_id = v_primary_entity_id
     ) then
    raise exception 'La afiliación primaria no puede cerrarse directamente. Modifica la entidad principal o la condición de sede desde la ficha del lugar.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function app_private.enforce_institution_primary_affiliation_consistency()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth, pg_temp
as $$
declare
  v_primary_entity_id uuid;
begin
  select institution.primary_entity_id
    into v_primary_entity_id
  from public.ecclesial_institutions institution
  where institution.id = new.institution_id;

  if v_primary_entity_id is null then
    raise exception 'Institución eclesial no encontrada para la afiliación.' using errcode = 'P0002';
  end if;

  if new.is_current = true
     and new.status = 'active'
     and new.relationship_type = 'belongs_to'
     and (
       new.ecclesiastical_entity_id is distinct from v_primary_entity_id
       or new.organization_unit_id is not null
       or new.parent_institution_id is not null
     ) then
    raise exception 'La afiliación primaria debe coincidir con la entidad principal de la institución.'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
     and old.is_current = true
     and old.status = 'active'
     and old.relationship_type = 'belongs_to'
     and old.ecclesiastical_entity_id = v_primary_entity_id
     and (
       new.is_current is distinct from true
       or new.status is distinct from 'active'
       or new.relationship_type is distinct from 'belongs_to'
       or new.ecclesiastical_entity_id is distinct from old.ecclesiastical_entity_id
       or new.organization_unit_id is not null
       or new.parent_institution_id is not null
     )
     and not exists (
       select 1
       from public.ecclesial_institution_affiliations other
       where other.institution_id = old.institution_id
         and other.id <> old.id
         and other.is_current = true
         and other.status = 'active'
         and other.relationship_type = 'belongs_to'
         and other.ecclesiastical_entity_id = v_primary_entity_id
     ) then
    raise exception 'La afiliación primaria no puede cerrarse directamente. Modifica la entidad principal desde la ficha de la institución.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_place_primary_affiliation_consistency
  on public.ecclesiastical_place_affiliations;
create trigger trg_enforce_place_primary_affiliation_consistency
before insert or update on public.ecclesiastical_place_affiliations
for each row execute function app_private.enforce_place_primary_affiliation_consistency();

drop trigger if exists trg_enforce_institution_primary_affiliation_consistency
  on public.ecclesial_institution_affiliations;
create trigger trg_enforce_institution_primary_affiliation_consistency
before insert or update on public.ecclesial_institution_affiliations
for each row execute function app_private.enforce_institution_primary_affiliation_consistency();

create or replace function app_private.sync_ecclesiastical_place_primary_affiliation_history()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth, pg_temp
as $$
declare
  v_actor uuid := coalesce(auth.uid(), new.created_by);
  v_expected_type text := case when new.is_primary_seat then 'seat_of' else 'belongs_to' end;
  v_affiliation record;
  v_old_json jsonb;
  v_closed_json jsonb;
  v_new_id uuid;
  v_new_json jsonb;
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1
      from public.ecclesiastical_place_affiliations affiliation
      where affiliation.place_id = new.id
        and affiliation.is_current = true
        and affiliation.status = 'active'
        and affiliation.relationship_type = v_expected_type
        and affiliation.ecclesiastical_entity_id = new.primary_entity_id
    ) then
      insert into public.ecclesiastical_place_affiliations(
        place_id, relationship_type, ecclesiastical_entity_id,
        valid_from, is_current, status, created_by
      ) values (
        new.id, v_expected_type, new.primary_entity_id,
        current_date, true, 'active', v_actor
      ) returning id into v_new_id;

      select to_jsonb(affiliation) into v_new_json
      from public.ecclesiastical_place_affiliations affiliation
      where affiliation.id = v_new_id;

      perform public.create_audit_log(
        v_actor,
        'places.affiliation.created',
        'ecclesiastical_place_affiliations',
        v_new_id,
        null,
        jsonb_build_object(
          'scope_entity_id', new.primary_entity_id,
          'country_iso2', new.country_iso2,
          'record', v_new_json,
          'transition', 'primary_created'
        ),
        null
      );
    end if;
    return new;
  end if;

  if old.primary_entity_id is distinct from new.primary_entity_id
     or old.is_primary_seat is distinct from new.is_primary_seat then
    for v_affiliation in
      select affiliation.*
      from public.ecclesiastical_place_affiliations affiliation
      where affiliation.place_id = new.id
        and affiliation.is_current = true
        and affiliation.status = 'active'
        and affiliation.relationship_type in ('belongs_to','seat_of')
      for update
    loop
      if v_affiliation.valid_from is not null and current_date < v_affiliation.valid_from then
        raise exception 'La fecha de cierre de la afiliación primaria no puede preceder su inicio.' using errcode = '22007';
      end if;

      v_old_json := to_jsonb(v_affiliation);
      update public.ecclesiastical_place_affiliations affiliation
      set valid_to = current_date,
          is_current = false,
          status = 'inactive'
      where affiliation.id = v_affiliation.id;

      select to_jsonb(affiliation) into v_closed_json
      from public.ecclesiastical_place_affiliations affiliation
      where affiliation.id = v_affiliation.id;

      perform public.create_audit_log(
        v_actor,
        'places.affiliation.updated',
        'ecclesiastical_place_affiliations',
        v_affiliation.id,
        v_old_json,
        jsonb_build_object(
          'scope_entity_id', old.primary_entity_id,
          'country_iso2', old.country_iso2,
          'record', v_closed_json,
          'transition', 'primary_closed'
        ),
        null
      );
    end loop;

    insert into public.ecclesiastical_place_affiliations(
      place_id, relationship_type, ecclesiastical_entity_id,
      valid_from, is_current, status, created_by
    ) values (
      new.id, v_expected_type, new.primary_entity_id,
      current_date, true, 'active', v_actor
    ) returning id into v_new_id;

    select to_jsonb(affiliation) into v_new_json
    from public.ecclesiastical_place_affiliations affiliation
    where affiliation.id = v_new_id;

    perform public.create_audit_log(
      v_actor,
      'places.affiliation.created',
      'ecclesiastical_place_affiliations',
      v_new_id,
      null,
      jsonb_build_object(
        'scope_entity_id', new.primary_entity_id,
        'country_iso2', new.country_iso2,
        'record', v_new_json,
        'transition', 'primary_created'
      ),
      null
    );
  end if;

  return new;
end;
$$;

create or replace function app_private.sync_ecclesial_institution_primary_affiliation_history()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth, pg_temp
as $$
declare
  v_actor uuid := coalesce(auth.uid(), new.created_by);
  v_affiliation record;
  v_old_json jsonb;
  v_closed_json jsonb;
  v_new_id uuid;
  v_new_json jsonb;
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1
      from public.ecclesial_institution_affiliations affiliation
      where affiliation.institution_id = new.id
        and affiliation.is_current = true
        and affiliation.status = 'active'
        and affiliation.relationship_type = 'belongs_to'
        and affiliation.ecclesiastical_entity_id = new.primary_entity_id
    ) then
      insert into public.ecclesial_institution_affiliations(
        institution_id, relationship_type, ecclesiastical_entity_id,
        valid_from, is_current, status, created_by
      ) values (
        new.id, 'belongs_to', new.primary_entity_id,
        current_date, true, 'active', v_actor
      ) returning id into v_new_id;

      select to_jsonb(affiliation) into v_new_json
      from public.ecclesial_institution_affiliations affiliation
      where affiliation.id = v_new_id;

      perform public.create_audit_log(
        v_actor,
        'institutions.affiliation.created',
        'ecclesial_institution_affiliations',
        v_new_id,
        null,
        jsonb_build_object(
          'scope_entity_id', new.primary_entity_id,
          'country_iso2', new.country_iso2,
          'record', v_new_json,
          'transition', 'primary_created'
        ),
        null
      );
    end if;
    return new;
  end if;

  if old.primary_entity_id is distinct from new.primary_entity_id then
    for v_affiliation in
      select affiliation.*
      from public.ecclesial_institution_affiliations affiliation
      where affiliation.institution_id = new.id
        and affiliation.is_current = true
        and affiliation.status = 'active'
        and affiliation.relationship_type = 'belongs_to'
      for update
    loop
      if v_affiliation.valid_from is not null and current_date < v_affiliation.valid_from then
        raise exception 'La fecha de cierre de la afiliación primaria no puede preceder su inicio.' using errcode = '22007';
      end if;

      v_old_json := to_jsonb(v_affiliation);
      update public.ecclesial_institution_affiliations affiliation
      set valid_to = current_date,
          is_current = false,
          status = 'inactive'
      where affiliation.id = v_affiliation.id;

      select to_jsonb(affiliation) into v_closed_json
      from public.ecclesial_institution_affiliations affiliation
      where affiliation.id = v_affiliation.id;

      perform public.create_audit_log(
        v_actor,
        'institutions.affiliation.updated',
        'ecclesial_institution_affiliations',
        v_affiliation.id,
        v_old_json,
        jsonb_build_object(
          'scope_entity_id', old.primary_entity_id,
          'country_iso2', old.country_iso2,
          'record', v_closed_json,
          'transition', 'primary_closed'
        ),
        null
      );
    end loop;

    insert into public.ecclesial_institution_affiliations(
      institution_id, relationship_type, ecclesiastical_entity_id,
      valid_from, is_current, status, created_by
    ) values (
      new.id, 'belongs_to', new.primary_entity_id,
      current_date, true, 'active', v_actor
    ) returning id into v_new_id;

    select to_jsonb(affiliation) into v_new_json
    from public.ecclesial_institution_affiliations affiliation
    where affiliation.id = v_new_id;

    perform public.create_audit_log(
      v_actor,
      'institutions.affiliation.created',
      'ecclesial_institution_affiliations',
      v_new_id,
      null,
      jsonb_build_object(
        'scope_entity_id', new.primary_entity_id,
        'country_iso2', new.country_iso2,
        'record', v_new_json,
        'transition', 'primary_created'
      ),
      null
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_ecclesiastical_place_primary_affiliation_history
  on public.ecclesiastical_places;
create trigger trg_sync_ecclesiastical_place_primary_affiliation_history
after insert or update of primary_entity_id, is_primary_seat
on public.ecclesiastical_places
for each row execute function app_private.sync_ecclesiastical_place_primary_affiliation_history();

drop trigger if exists trg_sync_ecclesial_institution_primary_affiliation_history
  on public.ecclesial_institutions;
create trigger trg_sync_ecclesial_institution_primary_affiliation_history
after insert or update of primary_entity_id
on public.ecclesial_institutions
for each row execute function app_private.sync_ecclesial_institution_primary_affiliation_history();

revoke all on function app_private.enforce_place_primary_affiliation_consistency() from public, anon, authenticated;
revoke all on function app_private.enforce_institution_primary_affiliation_consistency() from public, anon, authenticated;
revoke all on function app_private.sync_ecclesiastical_place_primary_affiliation_history() from public, anon, authenticated;
revoke all on function app_private.sync_ecclesial_institution_primary_affiliation_history() from public, anon, authenticated;
