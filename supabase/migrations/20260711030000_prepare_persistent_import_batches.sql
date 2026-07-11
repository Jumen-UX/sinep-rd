-- Persist safe batch imports without applying canonical records.
-- This migration intentionally provides preparation, validation, correction and retry only.

begin;

insert into public.permissions (key, module, description)
values (
  'imports.prepare',
  'imports',
  'Preparar, validar y corregir lotes de importación dentro del alcance administrativo asignado.'
)
on conflict (key) do update
set module = excluded.module,
    description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select distinct eligible_roles.role_id, import_permission.id
from (
  select r.id as role_id
  from public.roles r
  where r.key in ('super_admin', 'national_admin', 'diocesan_admin')

  union

  select rp.role_id
  from public.role_permissions rp
  join public.permissions existing_permission on existing_permission.id = rp.permission_id
  where existing_permission.key in (
    'people.create_proposal',
    'entities.create_proposal',
    'appointments.create_proposal',
    'structures.manage'
  )
) eligible_roles
cross join public.permissions import_permission
where import_permission.key = 'imports.prepare'
on conflict do nothing;

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  import_type text not null check (import_type in ('personas', 'parroquias', 'asignaciones', 'eventos')),
  status text not null default 'prepared' check (
    status in (
      'prepared',
      'validating',
      'needs_review',
      'validated',
      'applying',
      'applied',
      'failed',
      'cancelled'
    )
  ),
  template_version integer not null default 1 check (template_version > 0),
  file_name text not null,
  file_extension text not null check (file_extension in ('csv', 'xlsx', 'xls')),
  file_mime_type text,
  file_size_bytes bigint not null check (file_size_bytes >= 0 and file_size_bytes <= 10485760),
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  file_last_modified_at timestamptz,
  storage_path text,
  source_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(source_metadata) = 'object'),
  scope_entity_id uuid references public.ecclesiastical_entities(id),
  created_by uuid not null default auth.uid(),
  validated_by uuid,
  reviewed_by uuid,
  applied_by uuid,
  row_count integer not null default 0 check (row_count >= 0),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  warning_rows integer not null default 0 check (warning_rows >= 0),
  error_rows integer not null default 0 check (error_rows >= 0),
  duplicate_rows integer not null default 0 check (duplicate_rows >= 0),
  unresolved_rows integer not null default 0 check (unresolved_rows >= 0),
  applied_rows integer not null default 0 check (applied_rows >= 0),
  validation_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(validation_summary) = 'object'),
  last_error text,
  validated_at timestamptz,
  reviewed_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_import_batches_created_at
  on public.import_batches (created_at desc);

create index if not exists idx_import_batches_actor_status
  on public.import_batches (created_by, status, created_at desc);

create index if not exists idx_import_batches_scope_status
  on public.import_batches (scope_entity_id, status, created_at desc)
  where scope_entity_id is not null;

create index if not exists idx_import_batches_file_hash
  on public.import_batches (file_sha256, import_type, created_at desc);

create table if not exists public.import_batch_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  status text not null default 'pending' check (
    status in ('pending', 'valid', 'warning', 'error', 'duplicate', 'unresolved', 'ready', 'applied', 'skipped', 'failed')
  ),
  raw_data jsonb not null check (jsonb_typeof(raw_data) = 'object'),
  normalized_data jsonb not null check (jsonb_typeof(normalized_data) = 'object'),
  row_hash text not null,
  resolved_relations jsonb not null default '{}'::jsonb check (jsonb_typeof(resolved_relations) = 'object'),
  target_operation text check (target_operation is null or target_operation in ('create', 'update', 'noop')),
  target_schema text,
  target_table text,
  target_record_id uuid,
  corrected_by uuid,
  corrected_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, row_number)
);

create index if not exists idx_import_batch_rows_batch_status
  on public.import_batch_rows (batch_id, status, row_number);

create index if not exists idx_import_batch_rows_hash
  on public.import_batch_rows (batch_id, row_hash);

create table if not exists public.import_batch_row_issues (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_id uuid not null references public.import_batch_rows(id) on delete cascade,
  issue_type text not null check (issue_type in ('validation_error', 'warning', 'duplicate', 'unresolved_relation')),
  code text not null,
  field_name text,
  message text not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  status text not null default 'open' check (status in ('open', 'resolved', 'ignored', 'superseded')),
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_import_batch_row_issues_batch_status
  on public.import_batch_row_issues (batch_id, status, issue_type);

create index if not exists idx_import_batch_row_issues_row
  on public.import_batch_row_issues (row_id, status, created_at);

create table if not exists public.import_batch_changes (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete restrict,
  row_id uuid references public.import_batch_rows(id) on delete set null,
  operation text not null check (operation in ('create', 'update', 'noop')),
  target_schema text not null default 'public',
  target_table text not null,
  target_record_id uuid,
  before_data jsonb,
  after_data jsonb,
  audit_log_id uuid references public.audit_logs(id) on delete set null,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_import_batch_changes_batch
  on public.import_batch_changes (batch_id, recorded_at);

create index if not exists idx_import_batch_changes_row
  on public.import_batch_changes (row_id)
  where row_id is not null;

create index if not exists idx_import_batch_changes_audit_log
  on public.import_batch_changes (audit_log_id)
  where audit_log_id is not null;

alter table public.import_batches enable row level security;
alter table public.import_batch_rows enable row level security;
alter table public.import_batch_row_issues enable row level security;
alter table public.import_batch_changes enable row level security;

revoke all on table public.import_batches from public, anon, authenticated;
revoke all on table public.import_batch_rows from public, anon, authenticated;
revoke all on table public.import_batch_row_issues from public, anon, authenticated;
revoke all on table public.import_batch_changes from public, anon, authenticated;

grant select on table public.import_batches to authenticated;
grant select on table public.import_batch_rows to authenticated;
grant select on table public.import_batch_row_issues to authenticated;
grant select on table public.import_batch_changes to authenticated;

drop policy if exists import_batches_select_scoped on public.import_batches;
create policy import_batches_select_scoped
on public.import_batches
for select
to authenticated
using (
  created_by = (select auth.uid())
  or public.current_user_is_super_or_national()
  or (
    scope_entity_id is not null
    and public.current_user_can_manage_entity('imports.prepare', scope_entity_id)
  )
);

drop policy if exists import_batch_rows_select_scoped on public.import_batch_rows;
create policy import_batch_rows_select_scoped
on public.import_batch_rows
for select
to authenticated
using (
  exists (
    select 1
    from public.import_batches batch
    where batch.id = import_batch_rows.batch_id
  )
);

drop policy if exists import_batch_row_issues_select_scoped on public.import_batch_row_issues;
create policy import_batch_row_issues_select_scoped
on public.import_batch_row_issues
for select
to authenticated
using (
  exists (
    select 1
    from public.import_batches batch
    where batch.id = import_batch_row_issues.batch_id
  )
);

drop policy if exists import_batch_changes_select_scoped on public.import_batch_changes;
create policy import_batch_changes_select_scoped
on public.import_batch_changes
for select
to authenticated
using (
  exists (
    select 1
    from public.import_batches batch
    where batch.id = import_batch_changes.batch_id
  )
);

create or replace function app_private.normalize_import_row(p_row jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(
    jsonb_object_agg(
      lower(btrim(entry.key)),
      case
        when jsonb_typeof(entry.value) = 'string'
          then to_jsonb(btrim(entry.value #>> '{}'))
        else entry.value
      end
    ),
    '{}'::jsonb
  )
  from jsonb_each(coalesce(p_row, '{}'::jsonb)) entry;
$$;

revoke all on function app_private.normalize_import_row(jsonb) from public, anon, authenticated;

create or replace function app_private.is_valid_iso_date(p_value text)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if p_value is null or p_value !~ '^\d{4}-\d{2}-\d{2}$' then
    return false;
  end if;

  perform p_value::date;
  return true;
exception
  when others then
    return false;
end;
$$;

revoke all on function app_private.is_valid_iso_date(text) from public, anon, authenticated;

create or replace function app_private.import_entity_matches(p_value text)
returns uuid[]
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  select coalesce(array_agg(candidate.id order by candidate.name, candidate.id), '{}'::uuid[])
  from (
    select ee.id, ee.name
    from public.ecclesiastical_entities ee
    where ee.status = 'active'
      and (
        lower(btrim(ee.name)) = lower(btrim(p_value))
        or lower(btrim(coalesce(ee.official_name, ''))) = lower(btrim(p_value))
        or lower(btrim(coalesce(ee.slug, ''))) = lower(btrim(p_value))
      )
      and (
        public.current_user_is_super_or_national()
        or public.current_user_can_manage_entity('imports.prepare', ee.id)
      )
    limit 20
  ) candidate;
$$;

create or replace function app_private.import_person_matches(p_value text)
returns uuid[]
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  select coalesce(array_agg(candidate.id order by candidate.display_name, candidate.id), '{}'::uuid[])
  from (
    select person_state.id, person_state.display_name
    from public.person_ecclesial_state person_state
    where person_state.status = 'active'
      and (
        lower(btrim(person_state.display_name)) = lower(btrim(p_value))
        or lower(btrim(coalesce(person_state.slug, ''))) = lower(btrim(p_value))
      )
      and (
        public.current_user_is_super_or_national()
        or app_private.current_user_can_manage_person('imports.prepare', person_state.id)
      )
    limit 20
  ) candidate;
$$;

create or replace function app_private.import_office_matches(p_value text)
returns uuid[]
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  select coalesce(array_agg(candidate.id order by candidate.display_name, candidate.id), '{}'::uuid[])
  from (
    select office.id, office.display_name
    from public.office_configurations office
    where office.status = 'active'
      and (
        lower(btrim(office.display_name)) = lower(btrim(p_value))
        or lower(btrim(office.key)) = lower(btrim(p_value))
      )
    limit 20
  ) candidate;
$$;

revoke all on function app_private.import_entity_matches(text) from public, anon, authenticated;
revoke all on function app_private.import_person_matches(text) from public, anon, authenticated;
revoke all on function app_private.import_office_matches(text) from public, anon, authenticated;

create or replace function app_private.validate_import_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_batch public.import_batches%rowtype;
  v_row record;
  v_required_fields text[];
  v_field text;
  v_value text;
  v_matches uuid[];
  v_valid_rows integer;
  v_warning_rows integer;
  v_error_rows integer;
  v_duplicate_rows integer;
  v_unresolved_rows integer;
  v_status text;
  v_summary jsonb;
  v_relation_field text;
  v_relation_kind text;
begin
  if v_actor_id is null then
    raise exception 'No autenticado para validar importaciones.' using errcode = '42501';
  end if;

  select * into v_batch
  from public.import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'El lote de importación no existe.' using errcode = 'P0002';
  end if;

  if not public.current_user_has_permission('imports.prepare')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para validar importaciones.' using errcode = '42501';
  end if;

  if v_batch.scope_entity_id is not null
     and not public.current_user_can_manage_entity('imports.prepare', v_batch.scope_entity_id) then
    raise exception 'El lote está fuera de tu alcance administrativo.' using errcode = '42501';
  end if;

  if v_batch.status in ('applying', 'applied', 'cancelled') then
    raise exception 'El lote ya no admite revalidación en su estado actual.' using errcode = '22023';
  end if;

  update public.import_batches
  set status = 'validating',
      last_error = null,
      updated_at = now()
  where id = p_batch_id;

  update public.import_batch_row_issues
  set status = 'superseded',
      resolved_by = v_actor_id,
      resolved_at = now(),
      resolution_notes = coalesce(resolution_notes, 'Sustituida por una nueva validación del lote.')
  where batch_id = p_batch_id
    and status = 'open';

  update public.import_batch_rows
  set status = 'pending',
      resolved_relations = '{}'::jsonb,
      target_operation = null,
      target_schema = null,
      target_table = null,
      target_record_id = null,
      updated_at = now()
  where batch_id = p_batch_id;

  v_required_fields := case v_batch.import_type
    when 'personas' then array['tipo_persona', 'primer_nombre', 'primer_apellido']
    when 'parroquias' then array['pais_iso2', 'diocesis', 'tipo_entidad', 'nombre']
    when 'asignaciones' then array['persona', 'cargo', 'entidad', 'fecha_inicio']
    when 'eventos' then array['tipo_evento', 'fecha_efectiva', 'entidad', 'descripcion']
    else array[]::text[]
  end;

  for v_row in
    select *
    from public.import_batch_rows
    where batch_id = p_batch_id
    order by row_number
  loop
    foreach v_field in array v_required_fields
    loop
      v_value := nullif(btrim(coalesce(v_row.normalized_data ->> v_field, '')), '');
      if v_value is null then
        insert into public.import_batch_row_issues (
          batch_id, row_id, issue_type, code, field_name, message
        ) values (
          p_batch_id,
          v_row.id,
          'validation_error',
          'required_value_missing',
          v_field,
          format('La columna %s requiere un valor.', v_field)
        );
      end if;
    end loop;

    if v_batch.import_type = 'parroquias' then
      v_value := nullif(btrim(coalesce(v_row.normalized_data ->> 'pais_iso2', '')), '');
      if v_value is not null and (
        v_value !~ '^[A-Za-z]{2}$'
        or not exists (
          select 1
          from public.country_catalog country
          where upper(country.iso2::text) = upper(v_value)
        )
      ) then
        insert into public.import_batch_row_issues (
          batch_id, row_id, issue_type, code, field_name, message, details
        ) values (
          p_batch_id,
          v_row.id,
          'validation_error',
          'invalid_iso2',
          'pais_iso2',
          'El país debe usar un código ISO 3166-1 alfa-2 de dos letras.',
          jsonb_build_object('received', v_value)
        );
      end if;
    end if;

    if v_batch.import_type = 'asignaciones' then
      foreach v_field in array array['fecha_inicio', 'fecha_fin']
      loop
        v_value := nullif(btrim(coalesce(v_row.normalized_data ->> v_field, '')), '');
        if v_value is not null and not app_private.is_valid_iso_date(v_value) then
          insert into public.import_batch_row_issues (
            batch_id, row_id, issue_type, code, field_name, message, details
          ) values (
            p_batch_id,
            v_row.id,
            'validation_error',
            'invalid_iso_date',
            v_field,
            format('La columna %s debe usar el formato ISO 8601 YYYY-MM-DD.', v_field),
            jsonb_build_object('received', v_value)
          );
        end if;
      end loop;

      v_value := nullif(lower(btrim(coalesce(v_row.normalized_data ->> 'actual', ''))), '');
      if v_value is not null and v_value not in ('true', 'false', '1', '0', 'si', 'sí', 'no') then
        insert into public.import_batch_row_issues (
          batch_id, row_id, issue_type, code, field_name, message, details
        ) values (
          p_batch_id,
          v_row.id,
          'validation_error',
          'invalid_boolean',
          'actual',
          'La columna actual debe indicar verdadero o falso.',
          jsonb_build_object('received', v_value)
        );
      end if;
    end if;

    if v_batch.import_type = 'eventos' then
      v_value := nullif(btrim(coalesce(v_row.normalized_data ->> 'fecha_efectiva', '')), '');
      if v_value is not null and not app_private.is_valid_iso_date(v_value) then
        insert into public.import_batch_row_issues (
          batch_id, row_id, issue_type, code, field_name, message, details
        ) values (
          p_batch_id,
          v_row.id,
          'validation_error',
          'invalid_iso_date',
          'fecha_efectiva',
          'La fecha efectiva debe usar el formato ISO 8601 YYYY-MM-DD.',
          jsonb_build_object('received', v_value)
        );
      end if;
    end if;

    if v_batch.import_type = 'personas' then
      v_value := nullif(lower(btrim(coalesce(v_row.normalized_data ->> 'tipo_persona', ''))), '');
      if v_value is not null and v_value not in ('bishop', 'priest', 'deacon', 'religious', 'layperson') then
        insert into public.import_batch_row_issues (
          batch_id, row_id, issue_type, code, field_name, message, details
        ) values (
          p_batch_id, v_row.id, 'validation_error', 'invalid_person_type', 'tipo_persona',
          'El tipo de persona no pertenece al catálogo permitido.',
          jsonb_build_object('received', v_value)
        );
      end if;

      v_value := nullif(btrim(concat_ws(
        ' ',
        v_row.normalized_data ->> 'primer_nombre',
        v_row.normalized_data ->> 'segundo_nombre',
        v_row.normalized_data ->> 'primer_apellido',
        v_row.normalized_data ->> 'segundo_apellido'
      )), '');
      if v_value is not null then
        v_matches := app_private.import_person_matches(v_value);
        if cardinality(v_matches) > 0 then
          insert into public.import_batch_row_issues (
            batch_id, row_id, issue_type, code, field_name, message, details
          ) values (
            p_batch_id, v_row.id, 'duplicate', 'possible_existing_person', 'primer_nombre',
            'La persona coincide con una identidad canónica existente dentro del alcance autorizado.',
            jsonb_build_object('received', v_value, 'candidate_ids', to_jsonb(v_matches))
          );
        end if;
      end if;
    end if;

    if v_batch.import_type = 'parroquias' then
      v_value := nullif(lower(btrim(coalesce(v_row.normalized_data ->> 'tipo_entidad', ''))), '');
      if v_value is not null and not exists (
        select 1
        from public.entity_types entity_type
        where lower(entity_type.key) = v_value
          and entity_type.status = 'active'
      ) then
        insert into public.import_batch_row_issues (
          batch_id, row_id, issue_type, code, field_name, message, details
        ) values (
          p_batch_id, v_row.id, 'validation_error', 'invalid_entity_type', 'tipo_entidad',
          'El tipo de entidad no pertenece al catálogo activo.',
          jsonb_build_object('received', v_value)
        );
      end if;

      v_value := nullif(btrim(coalesce(v_row.normalized_data ->> 'nombre', '')), '');
      if v_value is not null then
        v_matches := app_private.import_entity_matches(v_value);
        if cardinality(v_matches) > 0 then
          insert into public.import_batch_row_issues (
            batch_id, row_id, issue_type, code, field_name, message, details
          ) values (
            p_batch_id, v_row.id, 'duplicate', 'possible_existing_entity', 'nombre',
            'La entidad coincide con un registro canónico existente dentro del alcance autorizado.',
            jsonb_build_object('received', v_value, 'candidate_ids', to_jsonb(v_matches))
          );
        end if;
      end if;
    end if;

    if v_batch.import_type = 'eventos' then
      v_value := nullif(lower(btrim(coalesce(v_row.normalized_data ->> 'tipo_evento', ''))), '');
      if v_value is not null and not exists (
        select 1 from public.canonical_event_types canonical_type where lower(canonical_type.key) = v_value
        union all
        select 1 from public.event_types event_type where lower(event_type.key) = v_value and event_type.status = 'active'
      ) then
        insert into public.import_batch_row_issues (
          batch_id, row_id, issue_type, code, field_name, message, details
        ) values (
          p_batch_id, v_row.id, 'validation_error', 'invalid_event_type', 'tipo_evento',
          'El tipo de evento no pertenece a un catálogo vigente.',
          jsonb_build_object('received', v_value)
        );
      end if;
    end if;

    for v_relation_field, v_relation_kind in
      select relation_field, relation_kind
      from (
        values
          ('personas', 'entidad_actual', 'entity'),
          ('parroquias', 'diocesis', 'entity'),
          ('parroquias', 'nivel_padre', 'entity'),
          ('asignaciones', 'persona', 'person'),
          ('asignaciones', 'cargo', 'office'),
          ('asignaciones', 'entidad', 'entity'),
          ('eventos', 'entidad', 'entity')
      ) relation(import_type, relation_field, relation_kind)
      where relation.import_type = v_batch.import_type
    loop
      v_value := nullif(btrim(coalesce(v_row.normalized_data ->> v_relation_field, '')), '');
      if v_value is null then
        continue;
      end if;

      v_matches := case v_relation_kind
        when 'entity' then app_private.import_entity_matches(v_value)
        when 'person' then app_private.import_person_matches(v_value)
        when 'office' then app_private.import_office_matches(v_value)
        else '{}'::uuid[]
      end;

      if cardinality(v_matches) = 1 then
        update public.import_batch_rows
        set resolved_relations = resolved_relations || jsonb_build_object(v_relation_field, v_matches[1]),
            updated_at = now()
        where id = v_row.id;
      elsif cardinality(v_matches) = 0 then
        insert into public.import_batch_row_issues (
          batch_id, row_id, issue_type, code, field_name, message, details
        ) values (
          p_batch_id,
          v_row.id,
          'unresolved_relation',
          'relation_not_found',
          v_relation_field,
          format('No se encontró una relación única para %s.', v_relation_field),
          jsonb_build_object('received', v_value, 'relation_kind', v_relation_kind)
        );
      else
        insert into public.import_batch_row_issues (
          batch_id, row_id, issue_type, code, field_name, message, details
        ) values (
          p_batch_id,
          v_row.id,
          'duplicate',
          'relation_ambiguous',
          v_relation_field,
          format('La referencia de %s coincide con varios registros.', v_relation_field),
          jsonb_build_object('received', v_value, 'candidate_ids', to_jsonb(v_matches), 'relation_kind', v_relation_kind)
        );
      end if;
    end loop;
  end loop;

  insert into public.import_batch_row_issues (
    batch_id, row_id, issue_type, code, message, details
  )
  select
    duplicate_rows.batch_id,
    duplicate_rows.id,
    'duplicate',
    'duplicate_row_in_batch',
    'La fila repite exactamente otra fila anterior del mismo lote.',
    jsonb_build_object('first_row_number', duplicate_rows.first_row_number, 'row_hash', duplicate_rows.row_hash)
  from (
    select
      row_data.id,
      row_data.batch_id,
      row_data.row_hash,
      min(row_data.row_number) over (partition by row_data.batch_id, row_data.row_hash) as first_row_number,
      row_data.row_number
    from public.import_batch_rows row_data
    where row_data.batch_id = p_batch_id
  ) duplicate_rows
  where duplicate_rows.row_number > duplicate_rows.first_row_number;

  update public.import_batch_rows row_data
  set status = case
        when exists (
          select 1 from public.import_batch_row_issues issue
          where issue.row_id = row_data.id
            and issue.status = 'open'
            and issue.issue_type = 'validation_error'
        ) then 'error'
        when exists (
          select 1 from public.import_batch_row_issues issue
          where issue.row_id = row_data.id
            and issue.status = 'open'
            and issue.issue_type = 'duplicate'
        ) then 'duplicate'
        when exists (
          select 1 from public.import_batch_row_issues issue
          where issue.row_id = row_data.id
            and issue.status = 'open'
            and issue.issue_type = 'unresolved_relation'
        ) then 'unresolved'
        when exists (
          select 1 from public.import_batch_row_issues issue
          where issue.row_id = row_data.id
            and issue.status = 'open'
            and issue.issue_type = 'warning'
        ) then 'warning'
        else 'valid'
      end,
      updated_at = now()
  where row_data.batch_id = p_batch_id;

  select
    count(*) filter (where status = 'valid'),
    count(*) filter (where status = 'warning'),
    count(*) filter (where status = 'error'),
    count(*) filter (where status = 'duplicate'),
    count(*) filter (where status = 'unresolved')
  into
    v_valid_rows,
    v_warning_rows,
    v_error_rows,
    v_duplicate_rows,
    v_unresolved_rows
  from public.import_batch_rows
  where batch_id = p_batch_id;

  v_status := case
    when v_error_rows + v_duplicate_rows + v_unresolved_rows > 0 then 'needs_review'
    else 'validated'
  end;

  v_summary := jsonb_build_object(
    'batch_id', p_batch_id,
    'status', v_status,
    'row_count', v_batch.row_count,
    'valid_rows', v_valid_rows,
    'warning_rows', v_warning_rows,
    'error_rows', v_error_rows,
    'duplicate_rows', v_duplicate_rows,
    'unresolved_rows', v_unresolved_rows,
    'can_apply', false,
    'application_rpc_available', false
  );

  update public.import_batches
  set status = v_status,
      valid_rows = v_valid_rows,
      warning_rows = v_warning_rows,
      error_rows = v_error_rows,
      duplicate_rows = v_duplicate_rows,
      unresolved_rows = v_unresolved_rows,
      validation_summary = v_summary,
      validated_by = v_actor_id,
      validated_at = now(),
      updated_at = now()
  where id = p_batch_id;

  return v_summary;
end;
$$;

revoke all on function app_private.validate_import_batch(uuid) from public, anon, authenticated;
grant execute on function app_private.validate_import_batch(uuid) to authenticated;

create or replace function public.admin_validate_import_batch(p_batch_id uuid)
returns jsonb
language sql
security invoker
set search_path = public, app_private, auth, pg_temp
as $$
  select app_private.validate_import_batch(p_batch_id);
$$;

revoke all on function public.admin_validate_import_batch(uuid) from public, anon;
grant execute on function public.admin_validate_import_batch(uuid) to authenticated;

create or replace function public.admin_prepare_import_batch(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_batch_id uuid;
  v_scope_entity_id uuid := nullif(payload ->> 'scope_entity_id', '')::uuid;
  v_import_type text := nullif(btrim(payload ->> 'import_type'), '');
  v_file jsonb := coalesce(payload -> 'file', '{}'::jsonb);
  v_rows jsonb := coalesce(payload -> 'rows', '[]'::jsonb);
  v_row jsonb;
  v_normalized_row jsonb;
  v_row_count integer;
  v_ordinality bigint;
  v_summary jsonb;
  v_audit_log_id uuid;
begin
  if v_actor_id is null then
    raise exception 'No autenticado para preparar importaciones.' using errcode = '42501';
  end if;

  if not public.current_user_has_permission('imports.prepare')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para preparar importaciones.' using errcode = '42501';
  end if;

  if v_import_type not in ('personas', 'parroquias', 'asignaciones', 'eventos') then
    raise exception 'Tipo de importación no permitido.' using errcode = '22023';
  end if;

  if jsonb_typeof(v_file) <> 'object' then
    raise exception 'Los metadatos del archivo son inválidos.' using errcode = '22023';
  end if;

  if jsonb_typeof(v_rows) <> 'array' then
    raise exception 'Las filas de importación deben enviarse como una lista.' using errcode = '22023';
  end if;

  v_row_count := jsonb_array_length(v_rows);
  if v_row_count = 0 then
    raise exception 'El archivo no contiene filas para importar.' using errcode = '22023';
  end if;

  if v_row_count > 5000 then
    raise exception 'El lote supera el límite inicial de 5,000 filas.' using errcode = '22023';
  end if;

  if nullif(btrim(v_file ->> 'name'), '') is null
     or lower(coalesce(v_file ->> 'extension', '')) not in ('csv', 'xlsx', 'xls')
     or coalesce((v_file ->> 'size_bytes')::bigint, -1) < 0
     or coalesce((v_file ->> 'size_bytes')::bigint, 10485761) > 10485760
     or lower(coalesce(v_file ->> 'sha256', '')) !~ '^[0-9a-f]{64}$' then
    raise exception 'Los metadatos obligatorios del archivo no son válidos.' using errcode = '22023';
  end if;

  if v_scope_entity_id is null and not public.current_user_is_super_or_national() then
    select public.current_user_root_jurisdiction_id()
      into v_scope_entity_id;
  end if;

  if v_scope_entity_id is null and not public.current_user_is_super_or_national() then
    raise exception 'Debes preparar el lote dentro de una jurisdicción asignada.' using errcode = '42501';
  end if;

  if v_scope_entity_id is not null
     and not public.current_user_can_manage_entity('imports.prepare', v_scope_entity_id) then
    raise exception 'La jurisdicción del lote está fuera de tu alcance.' using errcode = '42501';
  end if;

  insert into public.import_batches (
    import_type,
    status,
    template_version,
    file_name,
    file_extension,
    file_mime_type,
    file_size_bytes,
    file_sha256,
    file_last_modified_at,
    source_metadata,
    scope_entity_id,
    created_by,
    row_count
  ) values (
    v_import_type,
    'prepared',
    coalesce((payload ->> 'template_version')::integer, 1),
    btrim(v_file ->> 'name'),
    lower(v_file ->> 'extension'),
    nullif(btrim(v_file ->> 'mime_type'), ''),
    (v_file ->> 'size_bytes')::bigint,
    lower(v_file ->> 'sha256'),
    nullif(v_file ->> 'last_modified_at', '')::timestamptz,
    coalesce(payload -> 'source_metadata', '{}'::jsonb),
    v_scope_entity_id,
    v_actor_id,
    v_row_count
  )
  returning id into v_batch_id;

  for v_row, v_ordinality in
    select element.value, element.ordinality
    from jsonb_array_elements(v_rows) with ordinality element(value, ordinality)
  loop
    if jsonb_typeof(v_row) <> 'object' then
      raise exception 'La fila % debe ser un objeto de columnas y valores.', v_ordinality using errcode = '22023';
    end if;

    v_normalized_row := app_private.normalize_import_row(v_row);

    insert into public.import_batch_rows (
      batch_id,
      row_number,
      raw_data,
      normalized_data,
      row_hash
    ) values (
      v_batch_id,
      v_ordinality::integer,
      v_row,
      v_normalized_row,
      md5(v_normalized_row::text)
    );
  end loop;

  v_summary := app_private.validate_import_batch(v_batch_id);

  v_audit_log_id := public.admin_write_audit_log(
    'import.batch.prepared',
    'import_batches',
    v_batch_id,
    jsonb_build_object(
      'import_type', v_import_type,
      'file_name', v_file ->> 'name',
      'file_sha256', lower(v_file ->> 'sha256'),
      'row_count', v_row_count,
      'scope_entity_id', v_scope_entity_id,
      'validation', v_summary,
      'canonical_records_modified', false
    )
  );

  return v_summary || jsonb_build_object('audit_log_id', v_audit_log_id);
end;
$$;

revoke all on function public.admin_prepare_import_batch(jsonb) from public, anon;
grant execute on function public.admin_prepare_import_batch(jsonb) to authenticated;

create or replace function public.admin_update_import_batch_row(
  p_row_id uuid,
  p_normalized_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_batch_id uuid;
  v_batch_status text;
  v_scope_entity_id uuid;
  v_normalized_row jsonb;
  v_summary jsonb;
  v_audit_log_id uuid;
begin
  if v_actor_id is null then
    raise exception 'No autenticado para corregir importaciones.' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_normalized_data, '{}'::jsonb)) <> 'object' then
    raise exception 'La corrección de la fila debe ser un objeto.' using errcode = '22023';
  end if;

  select batch.id, batch.status, batch.scope_entity_id
    into v_batch_id, v_batch_status, v_scope_entity_id
  from public.import_batch_rows row_data
  join public.import_batches batch on batch.id = row_data.batch_id
  where row_data.id = p_row_id
  for update of row_data, batch;

  if v_batch_id is null then
    raise exception 'La fila de importación no existe.' using errcode = 'P0002';
  end if;

  if not public.current_user_has_permission('imports.prepare')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para corregir importaciones.' using errcode = '42501';
  end if;

  if v_scope_entity_id is not null
     and not public.current_user_can_manage_entity('imports.prepare', v_scope_entity_id) then
    raise exception 'La fila está fuera de tu alcance administrativo.' using errcode = '42501';
  end if;

  if v_batch_status in ('applying', 'applied', 'cancelled') then
    raise exception 'El lote ya no admite correcciones.' using errcode = '22023';
  end if;

  v_normalized_row := app_private.normalize_import_row(p_normalized_data);

  update public.import_batch_rows
  set normalized_data = v_normalized_row,
      row_hash = md5(v_normalized_row::text),
      status = 'pending',
      corrected_by = v_actor_id,
      corrected_at = now(),
      updated_at = now()
  where id = p_row_id;

  v_summary := app_private.validate_import_batch(v_batch_id);

  v_audit_log_id := public.admin_write_audit_log(
    'import.batch.row.corrected',
    'import_batch_rows',
    p_row_id,
    jsonb_build_object(
      'batch_id', v_batch_id,
      'validation', v_summary,
      'canonical_records_modified', false
    )
  );

  return v_summary || jsonb_build_object('row_id', p_row_id, 'audit_log_id', v_audit_log_id);
end;
$$;

revoke all on function public.admin_update_import_batch_row(uuid, jsonb) from public, anon;
grant execute on function public.admin_update_import_batch_row(uuid, jsonb) to authenticated;

comment on table public.import_batches is
  'Administrative import batches. Preparing or validating a batch never modifies canonical domain records.';

comment on table public.import_batch_rows is
  'Persisted source and normalized rows for a batch, including validation status and resolved references.';

comment on table public.import_batch_row_issues is
  'Versioned validation, duplicate and unresolved-relation findings for import rows.';

comment on table public.import_batch_changes is
  'Future application audit ledger. It remains empty until an explicit reviewed apply workflow is implemented.';

comment on function public.admin_prepare_import_batch(jsonb) is
  'Persists and validates an import batch. It does not create or modify canonical domain records.';

comment on function public.admin_validate_import_batch(uuid) is
  'Revalidates a prepared import batch without applying it.';

comment on function public.admin_update_import_batch_row(uuid, jsonb) is
  'Corrects one persisted import row and revalidates its batch without applying canonical records.';

commit;
