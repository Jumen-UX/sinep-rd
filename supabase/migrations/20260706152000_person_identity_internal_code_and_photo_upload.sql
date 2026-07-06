create sequence if not exists public.person_internal_code_seq;

create or replace function public.generate_person_internal_code()
returns text
language sql
as $$
  select 'SINEP-' || lpad(nextval('public.person_internal_code_seq')::text, 6, '0')
$$;

alter table public.persons
  add column if not exists internal_reference_code text,
  add column if not exists identity_document_type text,
  add column if not exists identity_document_number text,
  add column if not exists identity_document_country text;

alter table public.persons
  drop constraint if exists persons_identity_document_type_check;

alter table public.persons
  add constraint persons_identity_document_type_check
  check (
    identity_document_type is null
    or identity_document_type in ('cedula', 'passport', 'other')
  );

update public.persons
set internal_reference_code = public.generate_person_internal_code()
where internal_reference_code is null;

alter table public.persons
  alter column internal_reference_code set default public.generate_person_internal_code();

create unique index if not exists persons_internal_reference_code_key
  on public.persons (internal_reference_code);

create unique index if not exists persons_identity_document_unique
  on public.persons (identity_document_type, identity_document_country, identity_document_number)
  where identity_document_type is not null
    and identity_document_number is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'person-photos',
  'person-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'person_photos_authenticated_insert'
  ) then
    create policy person_photos_authenticated_insert
    on storage.objects for insert to authenticated
    with check (bucket_id = 'person-photos');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'person_photos_authenticated_update'
  ) then
    create policy person_photos_authenticated_update
    on storage.objects for update to authenticated
    using (bucket_id = 'person-photos')
    with check (bucket_id = 'person-photos');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'person_photos_public_select'
  ) then
    create policy person_photos_public_select
    on storage.objects for select to public
    using (bucket_id = 'person-photos');
  end if;
end $$;

create or replace function public.admin_save_priest(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_person_id uuid;
  v_clergy_profile_id uuid;
  v_slug text;
  v_first_name text := nullif(btrim(payload->>'first_name'), '');
  v_last_name text := nullif(btrim(payload->>'last_name'), '');
  v_display_name text := nullif(btrim(payload->>'display_name'), '');
  v_office_configuration_id uuid := nullif(payload->>'quick_office_configuration_id', '')::uuid;
  v_assignment_entity_id uuid;
  v_organization_chart_id uuid;
  v_start_date date := nullif(payload->>'quick_start_date', '')::date;
begin
  if v_user_id is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para guardar sacerdotes' using errcode = '42501';
  end if;

  v_display_name := coalesce(
    v_display_name,
    concat_ws(' ', v_first_name, nullif(btrim(payload->>'middle_name'), ''), v_last_name, nullif(btrim(payload->>'second_last_name'), ''))
  );
  v_slug := nullif(btrim(payload->>'slug'), '');
  v_slug := coalesce(v_slug, regexp_replace(lower(unaccent(v_display_name)), '[^a-z0-9]+', '-', 'g'));
  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');

  if v_first_name is null or v_last_name is null or v_display_name is null or v_slug is null then
    raise exception 'Nombre, apellido y nombre para mostrar son obligatorios' using errcode = '22023';
  end if;

  insert into public.persons (
    first_name,
    middle_name,
    last_name,
    second_last_name,
    display_name,
    slug,
    person_type,
    gender,
    birth_date,
    birth_place,
    photo_url,
    photo_path,
    biography_public,
    notes_internal,
    identity_document_type,
    identity_document_number,
    identity_document_country,
    status,
    visibility,
    created_by
  ) values (
    v_first_name,
    nullif(btrim(payload->>'middle_name'), ''),
    v_last_name,
    nullif(btrim(payload->>'second_last_name'), ''),
    v_display_name,
    v_slug,
    'priest',
    nullif(payload->>'gender', ''),
    nullif(payload->>'birth_date', '')::date,
    nullif(btrim(payload->>'birth_place'), ''),
    nullif(btrim(payload->>'photo_url'), ''),
    nullif(btrim(payload->>'photo_path'), ''),
    nullif(btrim(payload->>'biography_public'), ''),
    nullif(btrim(payload->>'notes_internal'), ''),
    nullif(payload->>'identity_document_type', ''),
    nullif(btrim(payload->>'identity_document_number'), ''),
    nullif(btrim(payload->>'identity_document_country'), ''),
    'active',
    'public',
    v_user_id
  )
  returning id, slug into v_person_id, v_slug;

  insert into public.clergy_profiles (
    person_id,
    incardination_entity_id,
    current_service_entity_id,
    diaconal_ordination_date,
    priestly_ordination_date,
    religious_order,
    canonical_status,
    notes_private
  ) values (
    v_person_id,
    nullif(payload->>'incardination_entity_id', '')::uuid,
    nullif(payload->>'current_service_entity_id', '')::uuid,
    nullif(payload->>'diaconal_ordination_date', '')::date,
    nullif(payload->>'priestly_ordination_date', '')::date,
    nullif(btrim(payload->>'religious_order'), ''),
    coalesce(nullif(payload->>'canonical_status', ''), 'active'),
    nullif(btrim(payload->>'clergy_notes'), '')
  )
  returning id into v_clergy_profile_id;

  if v_office_configuration_id is not null then
    v_assignment_entity_id := coalesce(
      nullif(payload->>'quick_entity_id', '')::uuid,
      nullif(payload->>'current_service_entity_id', '')::uuid
    );

    select organization_chart_id
    into v_organization_chart_id
    from public.office_configurations
    where id = v_office_configuration_id;

    insert into public.position_assignments (
      person_id,
      office_configuration_id,
      organization_chart_id,
      ecclesiastical_entity_id,
      title_override,
      start_date,
      term_start_date,
      is_current,
      assignment_status,
      selection_method,
      notes_public,
      notes_internal,
      verification_status,
      visibility,
      record_status
    ) values (
      v_person_id,
      v_office_configuration_id,
      v_organization_chart_id,
      v_assignment_entity_id,
      nullif(btrim(payload->>'quick_title_override'), ''),
      v_start_date,
      v_start_date,
      true,
      'active',
      'appointment',
      nullif(btrim(payload->>'quick_notes_public'), ''),
      'Asignación creada desde asistente transaccional de nuevo sacerdote.',
      'pending_review',
      'public',
      'active'
    );
  end if;

  perform public.admin_mark_missing_fields(
    'persons',
    v_person_id,
    payload->'not_identified_fields',
    array['gender','birth_date','birth_place','biography_public'],
    'Marcado como no identificado desde el asistente transaccional de nuevo sacerdote.',
    v_user_id
  );

  perform public.admin_mark_missing_fields(
    'clergy_profiles',
    v_clergy_profile_id,
    payload->'not_identified_fields',
    array['priestly_ordination_date','incardination_entity_id','current_service_entity_id'],
    'Marcado como no identificado desde el asistente transaccional de nuevo sacerdote.',
    v_user_id
  );

  return jsonb_build_object('person_id', v_person_id, 'clergy_profile_id', v_clergy_profile_id, 'slug', v_slug);
end;
$$;

grant execute on function public.admin_save_priest(jsonb) to authenticated;
