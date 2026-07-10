create or replace function internal.ensure_cumulative_ordination_sequence()
returns trigger
language plpgsql
set search_path = public, internal, pg_temp
as $$
declare
  v_diaconate_date date;
  v_presbyterate_date date;
  v_episcopate_date date;
begin
  if new.degree in ('presbyterate', 'episcopate') then
    insert into public.ordination_events (
      person_id, degree, visibility, record_status, record_origin, notes_internal, created_by
    ) values (
      new.person_id,
      'diaconate',
      new.visibility,
      'active',
      'derived_prerequisite',
      'Antecedente sacramental creado automáticamente para mantener la secuencia acumulativa del Orden.',
      new.created_by
    )
    on conflict (person_id, degree) do update set
      record_status = 'active',
      updated_at = now();
  end if;

  if new.degree = 'episcopate' then
    insert into public.ordination_events (
      person_id, degree, visibility, record_status, record_origin, notes_internal, created_by
    ) values (
      new.person_id,
      'presbyterate',
      new.visibility,
      'active',
      'derived_prerequisite',
      'Antecedente sacramental creado automáticamente para mantener la secuencia acumulativa del Orden.',
      new.created_by
    )
    on conflict (person_id, degree) do update set
      record_status = 'active',
      updated_at = now();
  end if;

  select oe.ordination_date into v_diaconate_date
  from public.ordination_events oe
  where oe.person_id = new.person_id and oe.degree = 'diaconate';

  select oe.ordination_date into v_presbyterate_date
  from public.ordination_events oe
  where oe.person_id = new.person_id and oe.degree = 'presbyterate';

  select oe.ordination_date into v_episcopate_date
  from public.ordination_events oe
  where oe.person_id = new.person_id and oe.degree = 'episcopate';

  if new.degree = 'diaconate' then
    v_diaconate_date := new.ordination_date;
  elsif new.degree = 'presbyterate' then
    v_presbyterate_date := new.ordination_date;
  elsif new.degree = 'episcopate' then
    v_episcopate_date := new.ordination_date;
  end if;

  if v_diaconate_date is not null and v_presbyterate_date is not null and v_presbyterate_date < v_diaconate_date then
    raise exception 'La ordenación presbiteral no puede ser anterior a la ordenación diaconal' using errcode = '23514';
  end if;

  if v_presbyterate_date is not null and v_episcopate_date is not null and v_episcopate_date < v_presbyterate_date then
    raise exception 'La ordenación episcopal no puede ser anterior a la ordenación presbiteral' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function internal.ensure_cumulative_ordination_sequence() from public, anon, authenticated;

create trigger ordination_events_enforce_cumulative_sequence
before insert or update of degree, ordination_date, record_status
on public.ordination_events
for each row execute function internal.ensure_cumulative_ordination_sequence();
