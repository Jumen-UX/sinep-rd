-- Sanea datos públicos de personas y evita nuevas inconsistencias.

-- 1. Ocultar y archivar el registro de prueba sin destruir sus relaciones.
update public.persons
set visibility = 'private',
    status = 'archived',
    notes_internal = concat_ws(E'\n', notes_internal, 'Registro de prueba archivado durante el saneamiento de datos públicos del 2026-07-13.'),
    updated_at = now()
where slug = 'p-juan-perez-garcia-prueba';

update public.clergy_profiles
set canonical_status = 'inactive',
    updated_at = now()
where person_id = (
  select id from public.persons where slug = 'p-juan-perez-garcia-prueba'
);

update public.clerical_status_history
set is_current = false,
    end_date = coalesce(end_date, current_date),
    notes_internal = concat_ws(E'\n', notes_internal, 'Estado cerrado al archivar el registro de prueba.'),
    updated_at = now()
where person_id = (
  select id from public.persons where slug = 'p-juan-perez-garcia-prueba'
)
  and is_current = true
  and record_status = 'active';

insert into public.clerical_status_history (
  person_id, status_type, start_date, is_current, reason,
  verification_status, visibility, record_status, record_origin,
  notes_internal
)
select
  p.id, 'inactive', current_date, true, 'Registro de prueba archivado',
  'pending_review', 'internal', 'active', 'data_cleanup',
  'Creado por el saneamiento de datos públicos del 2026-07-13.'
from public.persons p
where p.slug = 'p-juan-perez-garcia-prueba'
  and not exists (
    select 1
    from public.clerical_status_history csh
    where csh.person_id = p.id
      and csh.is_current = true
      and csh.record_status = 'active'
  );

-- 2. Sincronizar el estado de la persona fallecida en todas las dimensiones clericales.
update public.persons
set status = 'deceased',
    updated_at = now()
where slug = 'rafael-leonidas-felipe-y-nunez'
  and death_date is not null;

update public.clergy_profiles
set canonical_status = 'deceased',
    updated_at = now()
where person_id = (
  select id from public.persons where slug = 'rafael-leonidas-felipe-y-nunez'
);

update public.clerical_status_history
set is_current = false,
    end_date = coalesce(end_date, (
      select death_date from public.persons where slug = 'rafael-leonidas-felipe-y-nunez'
    )),
    notes_internal = concat_ws(E'\n', notes_internal, 'Estado cerrado al sincronizar el fallecimiento registrado.'),
    updated_at = now()
where person_id = (
  select id from public.persons where slug = 'rafael-leonidas-felipe-y-nunez'
)
  and is_current = true
  and record_status = 'active'
  and status_type <> 'deceased';

insert into public.clerical_status_history (
  person_id, status_type, start_date, is_current, reason,
  verification_status, visibility, record_status, record_origin,
  notes_internal
)
select
  p.id, 'deceased', p.death_date, true, 'Fallecimiento registrado en la ficha de la persona',
  'pending_review', 'internal', 'active', 'data_cleanup',
  'Creado por el saneamiento de datos públicos del 2026-07-13.'
from public.persons p
where p.slug = 'rafael-leonidas-felipe-y-nunez'
  and p.death_date is not null
  and not exists (
    select 1
    from public.clerical_status_history csh
    where csh.person_id = p.id
      and csh.status_type = 'deceased'
      and csh.is_current = true
      and csh.record_status = 'active'
  );

-- 3. Corregir únicamente los slugs inequívocamente dañados por caracteres acentuados.
update public.persons
set slug = case slug
  when 'alexander-b-ez' then 'alexander-baez'
  when 'andr-s-mateo' then 'andres-mateo'
  when 'andr-s-ricardo-cruz-rodr-guez' then 'andres-ricardo-cruz-rodriguez'
  when 'ngel-yorky-de-le-n-b-ez' then 'angel-yorky-de-leon-baez'
  when 'candelario-mej-a-brito' then 'candelario-mejia-brito'
  when 'confesol-reyes-rodr-guez' then 'confesol-reyes-rodriguez'
  when 'dar-o-bencosme' then 'dario-bencosme'
  when 'dorian-antonio-grull-n' then 'dorian-antonio-grullon'
  when 'edison-capell-n' then 'edison-capellan'
  when 'elias-nu-ez-paulino' then 'elias-nunez-paulino'
  else slug
end,
updated_at = now()
where slug in (
  'alexander-b-ez',
  'andr-s-mateo',
  'andr-s-ricardo-cruz-rodr-guez',
  'ngel-yorky-de-le-n-b-ez',
  'candelario-mej-a-brito',
  'confesol-reyes-rodr-guez',
  'dar-o-bencosme',
  'dorian-antonio-grull-n',
  'edison-capell-n',
  'elias-nu-ez-paulino'
);

-- 4. Impedir que una persona con fecha de fallecimiento vuelva a quedar activa u otro estado incompatible.
alter table public.persons
  drop constraint if exists persons_death_requires_deceased_status;

alter table public.persons
  add constraint persons_death_requires_deceased_status
  check (death_date is null or status = 'deceased')
  not valid;

alter table public.persons
  validate constraint persons_death_requires_deceased_status;

-- 5. Generar los slugs de nuevas personas desde sus nombres, no desde texto manual defectuoso.
create or replace function internal.normalize_person_slug_before_insert()
returns trigger
language plpgsql
set search_path = 'public', 'pg_temp'
as $$
declare
  v_base text;
  v_candidate text;
  v_suffix integer := 2;
begin
  v_base := trim(both '-' from regexp_replace(
    regexp_replace(
      lower(public.unaccent(concat_ws(' ',
        nullif(btrim(new.first_name), ''),
        nullif(btrim(new.middle_name), ''),
        nullif(btrim(new.last_name), ''),
        nullif(btrim(new.second_last_name), '')
      ))),
      '[^a-z0-9]+', '-', 'g'
    ),
    '-+', '-', 'g'
  ));

  if v_base is null or v_base = '' then
    raise exception 'No se pudo generar el slug de la persona' using errcode = '22023';
  end if;

  -- Conserva el sufijo numérico que el motor canónico haya calculado.
  if new.slug is not null and new.slug ~ ('^' || v_base || '(-[0-9]+)?$') then
    v_candidate := new.slug;
  else
    v_candidate := v_base;
  end if;

  if exists (select 1 from public.persons p where p.slug = v_candidate) then
    v_candidate := v_base;
    while exists (select 1 from public.persons p where p.slug = v_candidate) loop
      v_candidate := v_base || '-' || v_suffix::text;
      v_suffix := v_suffix + 1;
    end loop;
  end if;

  new.slug := v_candidate;
  return new;
end;
$$;

drop trigger if exists trg_persons_normalize_slug_before_insert on public.persons;
create trigger trg_persons_normalize_slug_before_insert
before insert on public.persons
for each row
execute function internal.normalize_person_slug_before_insert();
