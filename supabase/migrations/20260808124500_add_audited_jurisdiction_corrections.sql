-- Lightweight administrative corrections for jurisdiction records.
-- Editorial corrections are applied directly, atomically audited, and never projected as public history.

create or replace function public.admin_correct_jurisdiction(
  p_account_id uuid,
  p_changes jsonb,
  p_reason text default null,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_account public.jurisdiction_accounts%rowtype;
  v_entity public.ecclesiastical_entities%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_changed_fields text[] := array[]::text[];
  v_changed_before jsonb := '{}'::jsonb;
  v_changed_after jsonb := '{}'::jsonb;
  v_unsupported text[];
  v_latest_updated_at timestamptz;
  v_audit_id uuid;
  v_key text;
begin
  if v_actor is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para corregir jurisdicciones' using errcode = '42501';
  end if;

  if p_account_id is null then
    raise exception 'La cuenta jurisdiccional es obligatoria' using errcode = '22023';
  end if;

  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then
    raise exception 'Los cambios deben ser un objeto JSON no vacío' using errcode = '22023';
  end if;

  select array_agg(key order by key)
  into v_unsupported
  from jsonb_object_keys(p_changes) as keys(key)
  where key <> all(array[
    'name',
    'official_name',
    'latin_name',
    'description',
    'cathedral_name',
    'territory_summary',
    'source_name',
    'source_url',
    'source_checked_at',
    'notes',
    'sort_order'
  ]::text[]);

  if coalesce(array_length(v_unsupported, 1), 0) > 0 then
    raise exception 'Campos no permitidos para corrección administrativa: %', array_to_string(v_unsupported, ', ')
      using errcode = '22023';
  end if;

  select *
  into v_account
  from public.jurisdiction_accounts
  where id = p_account_id
  for update;

  if not found then
    raise exception 'Cuenta jurisdiccional no encontrada' using errcode = 'P0002';
  end if;

  select *
  into v_entity
  from public.ecclesiastical_entities
  where id = v_account.ecclesiastical_entity_id
  for update;

  if not found then
    raise exception 'Entidad eclesiástica vinculada no encontrada' using errcode = 'P0002';
  end if;

  v_latest_updated_at := greatest(v_account.updated_at, v_entity.updated_at);
  if p_expected_updated_at is not null and v_latest_updated_at > p_expected_updated_at then
    raise exception 'La jurisdicción fue modificada por otro usuario. Recarga antes de guardar.' using errcode = '40001';
  end if;

  if p_changes ? 'name' and nullif(btrim(p_changes->>'name'), '') is null then
    raise exception 'El nombre no puede quedar vacío' using errcode = '22023';
  end if;

  if p_changes ? 'sort_order' then
    if jsonb_typeof(p_changes->'sort_order') = 'null'
      or coalesce(p_changes->>'sort_order', '') !~ '^\d+$'
      or (p_changes->>'sort_order')::integer < 0 then
      raise exception 'El orden debe ser un entero mayor o igual a cero' using errcode = '22023';
    end if;
  end if;

  if p_changes ? 'source_checked_at'
    and jsonb_typeof(p_changes->'source_checked_at') <> 'null'
    and coalesce(p_changes->>'source_checked_at', '') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'La fecha de revisión de fuente debe usar YYYY-MM-DD' using errcode = '22023';
  end if;

  v_before := jsonb_build_object(
    'name', v_entity.name,
    'official_name', v_entity.official_name,
    'latin_name', v_entity.latin_name,
    'description', v_entity.description,
    'cathedral_name', v_entity.cathedral_name,
    'territory_summary', v_entity.territory_summary,
    'source_name', v_entity.source_name,
    'source_url', v_entity.source_url,
    'source_checked_at', v_entity.source_checked_at,
    'notes', v_account.notes,
    'sort_order', v_account.sort_order
  );

  v_after := jsonb_build_object(
    'name', case when p_changes ? 'name' then btrim(p_changes->>'name') else v_entity.name end,
    'official_name', case when p_changes ? 'official_name' then nullif(btrim(p_changes->>'official_name'), '') else v_entity.official_name end,
    'latin_name', case when p_changes ? 'latin_name' then nullif(btrim(p_changes->>'latin_name'), '') else v_entity.latin_name end,
    'description', case when p_changes ? 'description' then nullif(btrim(p_changes->>'description'), '') else v_entity.description end,
    'cathedral_name', case when p_changes ? 'cathedral_name' then nullif(btrim(p_changes->>'cathedral_name'), '') else v_entity.cathedral_name end,
    'territory_summary', case when p_changes ? 'territory_summary' then nullif(btrim(p_changes->>'territory_summary'), '') else v_entity.territory_summary end,
    'source_name', case when p_changes ? 'source_name' then nullif(btrim(p_changes->>'source_name'), '') else v_entity.source_name end,
    'source_url', case when p_changes ? 'source_url' then nullif(btrim(p_changes->>'source_url'), '') else v_entity.source_url end,
    'source_checked_at', case
      when not (p_changes ? 'source_checked_at') then to_jsonb(v_entity.source_checked_at)
      when jsonb_typeof(p_changes->'source_checked_at') = 'null' then 'null'::jsonb
      else to_jsonb((p_changes->>'source_checked_at')::date)
    end,
    'notes', case when p_changes ? 'notes' then nullif(btrim(p_changes->>'notes'), '') else v_account.notes end,
    'sort_order', case when p_changes ? 'sort_order' then (p_changes->>'sort_order')::integer else v_account.sort_order end
  );

  select coalesce(array_agg(before_item.key order by before_item.key), array[]::text[])
  into v_changed_fields
  from jsonb_each(v_before) before_item
  where v_after->before_item.key is distinct from before_item.value;

  if coalesce(array_length(v_changed_fields, 1), 0) = 0 then
    return jsonb_build_object(
      'status', 'noop',
      'account_id', v_account.id,
      'ecclesiastical_entity_id', v_entity.id,
      'updated_at', v_latest_updated_at,
      'changed_fields', '[]'::jsonb
    );
  end if;

  update public.ecclesiastical_entities
  set
    name = v_after->>'name',
    official_name = v_after->>'official_name',
    latin_name = v_after->>'latin_name',
    description = v_after->>'description',
    cathedral_name = v_after->>'cathedral_name',
    territory_summary = v_after->>'territory_summary',
    source_name = v_after->>'source_name',
    source_url = v_after->>'source_url',
    source_checked_at = nullif(v_after->>'source_checked_at', '')::date,
    updated_at = now()
  where id = v_entity.id
    and v_changed_fields && array[
      'name','official_name','latin_name','description','cathedral_name','territory_summary','source_name','source_url','source_checked_at'
    ]::text[];

  update public.jurisdiction_accounts
  set
    notes = v_after->>'notes',
    sort_order = (v_after->>'sort_order')::integer,
    updated_at = now()
  where id = v_account.id
    and v_changed_fields && array['notes','sort_order']::text[];

  foreach v_key in array v_changed_fields loop
    v_changed_before := v_changed_before || jsonb_build_object(v_key, v_before->v_key);
    v_changed_after := v_changed_after || jsonb_build_object(v_key, v_after->v_key);
  end loop;

  v_audit_id := public.admin_write_audit_log(
    'jurisdiction.administrative_correction',
    'jurisdiction_accounts',
    v_account.id,
    jsonb_build_object(
      'kind', 'administrative_correction',
      'jurisdiction_account_id', v_account.id,
      'ecclesiastical_entity_id', v_entity.id,
      'reason', nullif(btrim(p_reason), ''),
      'changed_fields', to_jsonb(v_changed_fields),
      'before', v_changed_before,
      'after', v_changed_after
    )
  );

  return jsonb_build_object(
    'status', 'updated',
    'account_id', v_account.id,
    'ecclesiastical_entity_id', v_entity.id,
    'audit_id', v_audit_id,
    'changed_fields', to_jsonb(v_changed_fields),
    'updated_at', now()
  );
end;
$$;

revoke execute on function public.admin_correct_jurisdiction(uuid, jsonb, text, timestamptz) from public;
revoke execute on function public.admin_correct_jurisdiction(uuid, jsonb, text, timestamptz) from anon;
grant execute on function public.admin_correct_jurisdiction(uuid, jsonb, text, timestamptz) to authenticated;

comment on function public.admin_correct_jurisdiction(uuid, jsonb, text, timestamptz) is
  'Applies lightweight editorial corrections to a jurisdiction and writes before/after data to admin_audit_log in the same transaction. Structural or canonical changes are intentionally rejected.';
