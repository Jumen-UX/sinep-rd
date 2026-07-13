alter table public.audit_logs
  add column if not exists scope_type text,
  add column if not exists scope_entity_id uuid,
  add column if not exists diocese_id uuid,
  add column if not exists pastoral_area_id uuid,
  add column if not exists pastoral_entity_id uuid,
  add column if not exists permission_key text,
  add column if not exists outcome text not null default 'success';

alter table public.audit_logs drop constraint if exists audit_logs_scope_type_check;
alter table public.audit_logs add constraint audit_logs_scope_type_check
check (scope_type is null or scope_type in ('global','national','diocese','vicariate','zone','parish','entity','pastoral_area','pastoral_entity','unknown')) not valid;
alter table public.audit_logs validate constraint audit_logs_scope_type_check;

alter table public.audit_logs drop constraint if exists audit_logs_outcome_check;
alter table public.audit_logs add constraint audit_logs_outcome_check
check (outcome in ('success','denied','failed')) not valid;
alter table public.audit_logs validate constraint audit_logs_outcome_check;

create index if not exists audit_logs_diocese_created_at_idx on public.audit_logs (diocese_id, created_at desc) where diocese_id is not null;
create index if not exists audit_logs_scope_entity_created_at_idx on public.audit_logs (scope_entity_id, created_at desc) where scope_entity_id is not null;
create index if not exists audit_logs_actor_created_at_idx on public.audit_logs (user_id, created_at desc) where user_id is not null;

create or replace function app_private.audit_json_uuid(p_payload jsonb, p_key text)
returns uuid
language plpgsql
immutable
set search_path = 'pg_catalog', 'pg_temp'
as $$
declare v_value text;
begin
  v_value := nullif(btrim(coalesce(p_payload, '{}'::jsonb) ->> p_key), '');
  if v_value is null or v_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return null; end if;
  return v_value::uuid;
end;
$$;

revoke all on function app_private.audit_json_uuid(jsonb, text) from public, anon, authenticated;
grant execute on function app_private.audit_json_uuid(jsonb, text) to service_role;

create or replace function app_private.resolve_audit_scope(p_target_table text, p_target_id uuid, p_metadata jsonb default '{}'::jsonb)
returns table(resolved_scope_type text, resolved_scope_entity_id uuid, resolved_diocese_id uuid, resolved_pastoral_area_id uuid, resolved_pastoral_entity_id uuid)
language plpgsql
stable
security definer
set search_path = 'public', 'app_private', 'pg_temp'
as $$
declare
  v_target_table text := lower(coalesce(nullif(btrim(p_target_table), ''), 'administrative_action'));
  v_scope_type text := nullif(btrim(coalesce(p_metadata, '{}'::jsonb) ->> 'scope_type'), '');
  v_scope_entity_id uuid := app_private.audit_json_uuid(p_metadata, 'scope_entity_id');
  v_diocese_id uuid := app_private.audit_json_uuid(p_metadata, 'diocese_id');
  v_pastoral_area_id uuid := app_private.audit_json_uuid(p_metadata, 'pastoral_area_id');
  v_pastoral_entity_id uuid := app_private.audit_json_uuid(p_metadata, 'pastoral_entity_id');
  v_batch_id uuid := app_private.audit_json_uuid(p_metadata, 'batch_id');
  v_node_entity_id uuid;
  v_node_diocese_id uuid;
begin
  if v_target_table = 'import_batches' and p_target_id is not null then
    select coalesce(v_scope_entity_id, ib.scope_entity_id) into v_scope_entity_id from public.import_batches ib where ib.id = p_target_id;
  elsif v_target_table = 'position_assignments' and p_target_id is not null then
    select coalesce(v_scope_entity_id, pa.ecclesiastical_entity_id), coalesce(v_pastoral_entity_id, pa.pastoral_entity_id)
      into v_scope_entity_id, v_pastoral_entity_id from public.position_assignments pa where pa.id = p_target_id;
  elsif v_target_table = 'ecclesiastical_entities' and p_target_id is not null then
    v_scope_entity_id := coalesce(v_scope_entity_id, p_target_id);
  elsif v_target_table = 'structure_nodes' and p_target_id is not null then
    select coalesce(v_scope_entity_id, sn.linked_ecclesiastical_entity_id, sn.diocese_id), coalesce(v_diocese_id, sn.diocese_id)
      into v_scope_entity_id, v_diocese_id from public.structure_nodes sn where sn.id = p_target_id;
  elsif v_target_table = 'structure_templates' and p_target_id is not null then
    select coalesce(v_scope_entity_id, st.diocese_id), coalesce(v_diocese_id, st.diocese_id)
      into v_scope_entity_id, v_diocese_id from public.structure_templates st where st.id = p_target_id;
  elsif v_target_table = 'change_requests' and p_target_id is not null then
    select coalesce(v_scope_type, cr.scope_type), coalesce(v_scope_entity_id, cr.scope_entity_id, cr.diocese_id),
           coalesce(v_diocese_id, cr.diocese_id), coalesce(v_pastoral_area_id, cr.pastoral_area_id), coalesce(v_pastoral_entity_id, cr.pastoral_entity_id)
      into v_scope_type, v_scope_entity_id, v_diocese_id, v_pastoral_area_id, v_pastoral_entity_id
    from public.change_requests cr where cr.id = p_target_id;
  elsif v_target_table = 'canonical_events' and p_target_id is not null then
    select coalesce(v_scope_entity_id, ce.authority_entity_id) into v_scope_entity_id from public.canonical_events ce where ce.id = p_target_id;
  elsif v_target_table = 'user_role_assignments' and p_target_id is not null then
    select coalesce(v_scope_type, ura.scope_type), coalesce(v_scope_entity_id, ura.diocese_id, ura.scope_entity_id),
           coalesce(v_diocese_id, ura.diocese_id), coalesce(v_pastoral_area_id, ura.pastoral_area_id), coalesce(v_pastoral_entity_id, ura.pastoral_entity_id)
      into v_scope_type, v_scope_entity_id, v_diocese_id, v_pastoral_area_id, v_pastoral_entity_id
    from public.user_role_assignments ura where ura.id = p_target_id;
  elsif v_target_table = 'profiles' and p_target_id is not null then
    select coalesce(v_scope_type, ura.scope_type), coalesce(v_scope_entity_id, ura.diocese_id, ura.scope_entity_id),
           coalesce(v_diocese_id, ura.diocese_id), coalesce(v_pastoral_area_id, ura.pastoral_area_id), coalesce(v_pastoral_entity_id, ura.pastoral_entity_id)
      into v_scope_type, v_scope_entity_id, v_diocese_id, v_pastoral_area_id, v_pastoral_entity_id
    from public.user_role_assignments ura
    where ura.user_id = p_target_id and ura.status = 'active' and ura.starts_at <= current_date and (ura.ends_at is null or ura.ends_at >= current_date)
    order by ura.created_at desc limit 1;
  elsif v_target_table = 'persons' and p_target_id is not null then
    select coalesce(v_scope_entity_id,
      (select pa.ecclesiastical_entity_id from public.position_assignments pa where pa.person_id = p_target_id and pa.is_current = true and pa.record_status = 'active' and pa.ecclesiastical_entity_id is not null order by pa.updated_at desc limit 1),
      (select cp.current_service_entity_id from public.clergy_profiles cp where cp.person_id = p_target_id limit 1),
      (select cp.incardination_entity_id from public.clergy_profiles cp where cp.person_id = p_target_id limit 1)
    ) into v_scope_entity_id;
  end if;

  if v_scope_entity_id is null and v_batch_id is not null then
    select ib.scope_entity_id into v_scope_entity_id from public.import_batches ib where ib.id = v_batch_id;
  end if;

  if v_pastoral_entity_id is not null then
    select coalesce(v_scope_entity_id, pe.linked_ecclesiastical_entity_id, pe.diocese_id), coalesce(v_diocese_id, pe.diocese_id), coalesce(v_pastoral_area_id, pe.pastoral_area_id)
      into v_scope_entity_id, v_diocese_id, v_pastoral_area_id from public.pastoral_entities pe where pe.id = v_pastoral_entity_id;
  end if;

  if v_scope_entity_id is not null and not exists (select 1 from public.ecclesiastical_entities ee where ee.id = v_scope_entity_id) then
    select sn.linked_ecclesiastical_entity_id, sn.diocese_id into v_node_entity_id, v_node_diocese_id
    from public.structure_nodes sn where sn.id = v_scope_entity_id limit 1;
    if v_node_entity_id is not null or v_node_diocese_id is not null then
      v_scope_entity_id := coalesce(v_node_entity_id, v_node_diocese_id);
      v_diocese_id := coalesce(v_diocese_id, v_node_diocese_id);
    end if;
  end if;

  if v_scope_entity_id is not null then v_diocese_id := coalesce(v_diocese_id, app_private.resolve_entity_diocese_id(v_scope_entity_id)); end if;
  v_scope_entity_id := coalesce(v_scope_entity_id, v_diocese_id);

  if v_pastoral_entity_id is not null then v_scope_type := 'pastoral_entity';
  elsif v_pastoral_area_id is not null and v_scope_entity_id is null then v_scope_type := 'pastoral_area';
  elsif v_scope_entity_id is not null and v_diocese_id is not null and v_scope_entity_id = v_diocese_id then v_scope_type := 'diocese';
  elsif v_scope_entity_id is not null then v_scope_type := case when v_scope_type in ('vicariate','zone','parish','entity') then v_scope_type else 'entity' end;
  elsif v_scope_type not in ('global','national') then v_scope_type := 'unknown'; end if;

  return query select v_scope_type, v_scope_entity_id, v_diocese_id, v_pastoral_area_id, v_pastoral_entity_id;
end;
$$;

revoke all on function app_private.resolve_audit_scope(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function app_private.resolve_audit_scope(text, uuid, jsonb) to service_role;

with resolved as (
  select al.id, r.*
  from public.audit_logs al
  cross join lateral app_private.resolve_audit_scope(al.target_table, al.target_id, coalesce(al.new_data, '{}'::jsonb)) r
  where al.scope_type is null
)
update public.audit_logs al
set scope_type = resolved.resolved_scope_type,
    scope_entity_id = resolved.resolved_scope_entity_id,
    diocese_id = resolved.resolved_diocese_id,
    pastoral_area_id = resolved.resolved_pastoral_area_id,
    pastoral_entity_id = resolved.resolved_pastoral_entity_id
from resolved
where al.id = resolved.id;