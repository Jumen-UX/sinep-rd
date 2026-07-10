update public.clergy_profiles cp
set canonical_status = 'emeritus', updated_at = now()
where canonical_status <> 'emeritus'
  and exists (
    select 1
    from public.appointments a
    join public.offices o on o.id = a.office_id
    where a.person_id = cp.person_id
      and a.is_current = true
      and a.status = 'active'
      and lower(unaccent(o.name)) like '%emerit%'
  );

insert into public.clerical_incardinations (
  person_id, incardination_entity_id, institute_name, incardination_kind,
  acquisition_method, start_date, is_current, verification_status,
  visibility, record_status, record_origin, notes_internal, created_by
)
select
  cp.person_id,
  cp.incardination_entity_id,
  cp.religious_institute_name,
  case when cp.priest_type = 'religious' then 'religious_institute' else 'diocesan' end,
  case when cp.priest_type = 'religious' and cp.incardination_entity_id is null then 'profession' else 'ordination' end,
  coalesce(cp.diaconal_ordination_date, cp.priestly_ordination_date),
  true,
  'pending_review',
  'internal',
  'active',
  'legacy_backfill',
  'Migrado desde clergy_profiles. La fecha inicial puede permanecer desconocida.',
  p.created_by
from public.clergy_profiles cp
join public.persons p on p.id = cp.person_id
where (cp.incardination_entity_id is not null
   or (cp.priest_type = 'religious' and nullif(btrim(cp.religious_institute_name), '') is not null))
  and not exists (
    select 1 from public.clerical_incardinations ci
    where ci.person_id = cp.person_id and ci.is_current and ci.record_status = 'active'
  );

insert into public.clerical_status_history (
  person_id, status_type, is_current, verification_status,
  visibility, record_status, record_origin, notes_internal, created_by
)
select
  cp.person_id,
  case
    when cp.canonical_status in ('transferred','excardinated','incardinated') then 'active'
    else cp.canonical_status
  end,
  true,
  'pending_review',
  'internal',
  'active',
  'legacy_backfill',
  case when cp.canonical_status in ('transferred','excardinated','incardinated')
    then 'El estado heredado fue normalizado; el movimiento debe registrarse como incardinación.'
    else 'Migrado desde clergy_profiles.' end,
  p.created_by
from public.clergy_profiles cp
join public.persons p on p.id = cp.person_id
where not exists (
  select 1 from public.clerical_status_history csh
  where csh.person_id = cp.person_id and csh.is_current and csh.record_status = 'active'
);

insert into public.episcopal_roles (
  person_id, role_type, jurisdiction_entity_id, start_date, end_date,
  is_current, has_right_of_succession, source_appointment_id,
  verification_status, visibility, record_status, record_origin,
  notes_internal, created_by
)
select
  a.person_id,
  case
    when lower(unaccent(o.name)) = 'obispo diocesano' then 'diocesan'
    when lower(unaccent(o.name)) = 'obispo auxiliar' then 'auxiliary'
    when lower(unaccent(o.name)) in ('obispo coadjutor','arzobispo coadjutor') then 'coadjutor'
    when lower(unaccent(o.name)) = 'obispo emerito' then 'emeritus'
    when lower(unaccent(o.name)) = 'administrador apostolico' then 'apostolic_administrator'
    when lower(unaccent(o.name)) = 'arzobispo metropolitano' then 'diocesan'
  end,
  a.entity_id,
  a.start_date,
  a.end_date,
  a.is_current and a.status = 'active',
  lower(unaccent(o.name)) in ('obispo coadjutor','arzobispo coadjutor'),
  a.id,
  'pending_review',
  coalesce(a.visibility, 'public'),
  case when a.status = 'archived' then 'archived' else 'active' end,
  'legacy_appointment_backfill',
  'Derivado de un nombramiento episcopal histórico registrado en appointments.',
  a.created_by
from public.appointments a
join public.offices o on o.id = a.office_id
join public.person_ecclesial_state pes on pes.id = a.person_id and pes.has_episcopate = true
where lower(unaccent(o.name)) in (
  'obispo diocesano','obispo auxiliar','obispo coadjutor','obispo emerito',
  'administrador apostolico','arzobispo metropolitano','arzobispo coadjutor'
)
on conflict (source_appointment_id) do nothing;

insert into public.person_ecclesiastical_dignities (
  person_id, dignity_type, title_text, start_date, end_date, is_current,
  source_appointment_id, verification_status, visibility, record_status,
  record_origin, notes_internal, created_by
)
select
  a.person_id,
  'archbishop',
  o.name,
  a.start_date,
  a.end_date,
  a.is_current and a.status = 'active',
  a.id,
  'pending_review',
  coalesce(a.visibility, 'public'),
  case when a.status = 'archived' then 'archived' else 'active' end,
  'legacy_appointment_backfill',
  'Dignidad derivada de un nombramiento histórico.',
  a.created_by
from public.appointments a
join public.offices o on o.id = a.office_id
where lower(unaccent(o.name)) in ('arzobispo metropolitano','arzobispo coadjutor')
on conflict do nothing;

insert into public.person_ecclesiastical_dignities (
  person_id, dignity_type, title_text, start_date, end_date, is_current,
  source_appointment_id, verification_status, visibility, record_status,
  record_origin, notes_internal, created_by
)
select
  a.person_id,
  'metropolitan',
  o.name,
  a.start_date,
  a.end_date,
  a.is_current and a.status = 'active',
  a.id,
  'pending_review',
  coalesce(a.visibility, 'public'),
  case when a.status = 'archived' then 'archived' else 'active' end,
  'legacy_appointment_backfill',
  'Condición metropolitana derivada de un nombramiento histórico.',
  a.created_by
from public.appointments a
join public.offices o on o.id = a.office_id
where lower(unaccent(o.name)) = 'arzobispo metropolitano'
on conflict do nothing;