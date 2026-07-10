create or replace function internal.prepare_current_clerical_incardination()
returns trigger
language plpgsql
set search_path = public, internal, pg_temp
as $$
begin
  if new.is_current and new.record_status = 'active' then
    update public.clerical_incardinations
    set is_current = false,
        end_date = coalesce(end_date, case when new.start_date is not null then new.start_date - 1 else current_date end),
        end_reason = coalesce(end_reason, 'transfer'),
        updated_at = now()
    where person_id = new.person_id
      and id <> new.id
      and is_current = true
      and record_status = 'active';
  end if;
  return new;
end;
$$;

create trigger clerical_incardinations_prepare_current
before insert or update of is_current, record_status, start_date
on public.clerical_incardinations
for each row execute function internal.prepare_current_clerical_incardination();

create or replace function internal.sync_current_incardination_to_legacy_profile()
returns trigger
language plpgsql
set search_path = public, internal, pg_temp
as $$
begin
  if new.is_current and new.record_status = 'active' then
    update public.clergy_profiles
    set incardination_entity_id = new.incardination_entity_id,
        updated_at = now()
    where person_id = new.person_id
      and incardination_entity_id is distinct from new.incardination_entity_id;
  end if;
  return new;
end;
$$;

create trigger clerical_incardinations_sync_legacy
after insert or update of is_current, record_status, incardination_entity_id
on public.clerical_incardinations
for each row execute function internal.sync_current_incardination_to_legacy_profile();

create or replace function internal.prepare_current_clerical_status()
returns trigger
language plpgsql
set search_path = public, internal, pg_temp
as $$
begin
  if new.is_current and new.record_status = 'active' then
    update public.clerical_status_history
    set is_current = false,
        end_date = coalesce(end_date, case when new.start_date is not null then new.start_date - 1 else current_date end),
        updated_at = now()
    where person_id = new.person_id
      and id <> new.id
      and is_current = true
      and record_status = 'active';
  end if;
  return new;
end;
$$;

create trigger clerical_status_history_prepare_current
before insert or update of is_current, record_status, start_date
on public.clerical_status_history
for each row execute function internal.prepare_current_clerical_status();

create or replace function internal.apply_current_clerical_status()
returns trigger
language plpgsql
set search_path = public, internal, pg_temp
as $$
declare
  v_legacy_status text;
  v_end_date date := coalesce(new.start_date, current_date);
begin
  if not new.is_current or new.record_status <> 'active' then
    return new;
  end if;

  v_legacy_status := case new.status_type
    when 'lost_clerical_state' then 'inactive'
    when 'restricted' then 'suspended'
    else new.status_type
  end;

  update public.clergy_profiles
  set canonical_status = v_legacy_status,
      updated_at = now()
  where person_id = new.person_id
    and canonical_status is distinct from v_legacy_status;

  if new.status_type in ('deceased', 'lost_clerical_state') then
    update public.position_assignments
    set is_current = false,
        assignment_status = 'ended',
        actual_end_date = coalesce(actual_end_date, v_end_date),
        notes_internal = concat_ws(E'\n', notes_internal, 'Cargo cerrado automáticamente por cambio de estado canónico: ' || new.status_type || '.'),
        updated_at = now()
    where person_id = new.person_id
      and is_current = true
      and assignment_status in ('active','term_expired_still_serving')
      and record_status = 'active';

    update public.appointments
    set is_current = false,
        status = 'ended',
        end_date = coalesce(end_date, v_end_date),
        notes_internal = concat_ws(E'\n', notes_internal, 'Nombramiento cerrado automáticamente por cambio de estado canónico: ' || new.status_type || '.'),
        updated_at = now()
    where person_id = new.person_id
      and is_current = true
      and status = 'active';
  end if;

  return new;
end;
$$;

create trigger clerical_status_history_apply_current
after insert or update of is_current, record_status, status_type, start_date
on public.clerical_status_history
for each row execute function internal.apply_current_clerical_status();

create or replace function internal.prepare_episcopal_role()
returns trigger
language plpgsql
set search_path = public, internal, pg_temp
as $$
begin
  if new.role_type = 'coadjutor' then
    new.has_right_of_succession := true;
  end if;

  if new.is_current and new.record_status = 'active' and new.jurisdiction_entity_id is not null then
    update public.episcopal_roles
    set is_current = false,
        end_date = coalesce(end_date, case when new.start_date is not null then new.start_date - 1 else current_date end),
        updated_at = now()
    where person_id = new.person_id
      and jurisdiction_entity_id = new.jurisdiction_entity_id
      and id <> new.id
      and is_current = true
      and record_status = 'active'
      and role_type in ('diocesan','auxiliary','coadjutor','emeritus');
  end if;

  return new;
end;
$$;

create trigger episcopal_roles_prepare
before insert or update of role_type, jurisdiction_entity_id, is_current, record_status, start_date
on public.episcopal_roles
for each row execute function internal.prepare_episcopal_role();

create or replace function internal.prepare_current_dignity()
returns trigger
language plpgsql
set search_path = public, internal, pg_temp
as $$
begin
  if new.is_current and new.record_status = 'active' then
    update public.person_ecclesiastical_dignities
    set is_current = false,
        end_date = coalesce(end_date, case when new.start_date is not null then new.start_date - 1 else current_date end),
        updated_at = now()
    where person_id = new.person_id
      and dignity_type = new.dignity_type
      and id <> new.id
      and is_current = true
      and record_status = 'active';
  end if;
  return new;
end;
$$;

create trigger person_ecclesiastical_dignities_prepare_current
before insert or update of dignity_type, is_current, record_status, start_date
on public.person_ecclesiastical_dignities
for each row execute function internal.prepare_current_dignity();

create or replace function internal.sync_clergy_profile_dimensions()
returns trigger
language plpgsql
set search_path = public, internal, pg_temp
as $$
declare
  v_status text;
  v_kind text;
  v_incardination_changed boolean;
  v_status_changed boolean;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_incardination_changed := true;
    v_status_changed := true;
  else
    v_incardination_changed := old.incardination_entity_id is distinct from new.incardination_entity_id
      or old.priest_type is distinct from new.priest_type
      or old.religious_institute_name is distinct from new.religious_institute_name;
    v_status_changed := old.canonical_status is distinct from new.canonical_status;
  end if;

  if v_incardination_changed and new.incardination_entity_id is not null then
    v_kind := case when new.priest_type = 'religious' then 'religious_institute' else 'diocesan' end;

    insert into public.clerical_incardinations (
      person_id, incardination_entity_id, institute_name, incardination_kind,
      acquisition_method, start_date, is_current, verification_status,
      visibility, record_status, record_origin, notes_internal
    ) values (
      new.person_id, new.incardination_entity_id, new.religious_institute_name, v_kind,
      case when exists (select 1 from public.clerical_incardinations ci where ci.person_id = new.person_id) then 'transfer' else 'ordination' end,
      coalesce(new.diaconal_ordination_date, new.priestly_ordination_date), true, 'pending_review',
      'internal', 'active', 'legacy_profile_sync',
      'Sincronizado temporalmente desde clergy_profiles durante la transición al historial canónico.'
    );
  elsif v_incardination_changed
        and new.incardination_entity_id is null
        and new.priest_type = 'religious'
        and nullif(btrim(new.religious_institute_name), '') is not null then
    insert into public.clerical_incardinations (
      person_id, institute_name, incardination_kind, acquisition_method,
      start_date, is_current, verification_status, visibility,
      record_status, record_origin, notes_internal
    ) values (
      new.person_id, new.religious_institute_name, 'religious_institute', 'profession',
      coalesce(new.diaconal_ordination_date, new.priestly_ordination_date), true, 'pending_review', 'internal',
      'active', 'legacy_profile_sync',
      'Sincronizado temporalmente desde clergy_profiles durante la transición al historial canónico.'
    );
  end if;

  if v_status_changed then
    v_status := case new.canonical_status
      when 'transferred' then 'active'
      when 'excardinated' then 'active'
      when 'incardinated' then 'active'
      else new.canonical_status
    end;

    insert into public.clerical_status_history (
      person_id, status_type, start_date, is_current,
      verification_status, visibility, record_status, record_origin, notes_internal
    ) values (
      new.person_id, v_status, null, true,
      'pending_review', 'internal', 'active', 'legacy_profile_sync',
      case when new.canonical_status in ('transferred','excardinated','incardinated')
        then 'El valor heredado ' || new.canonical_status || ' fue normalizado como estado activo; el movimiento pertenece al historial de incardinación.'
        else 'Sincronizado temporalmente desde clergy_profiles durante la transición al historial canónico.' end
    );
  end if;

  return new;
end;
$$;

create trigger clergy_profiles_sync_dimensions_insert
after insert on public.clergy_profiles
for each row execute function internal.sync_clergy_profile_dimensions();

create trigger clergy_profiles_sync_dimensions_update
after update of incardination_entity_id, canonical_status, priest_type, religious_institute_name
on public.clergy_profiles
for each row execute function internal.sync_clergy_profile_dimensions();

revoke all on function internal.prepare_current_clerical_incardination() from public, anon, authenticated;
revoke all on function internal.sync_current_incardination_to_legacy_profile() from public, anon, authenticated;
revoke all on function internal.prepare_current_clerical_status() from public, anon, authenticated;
revoke all on function internal.apply_current_clerical_status() from public, anon, authenticated;
revoke all on function internal.prepare_episcopal_role() from public, anon, authenticated;
revoke all on function internal.prepare_current_dignity() from public, anon, authenticated;
revoke all on function internal.sync_clergy_profile_dimensions() from public, anon, authenticated;