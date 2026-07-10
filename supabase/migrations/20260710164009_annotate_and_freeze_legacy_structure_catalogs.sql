with template_map as (
  select st.id as canonical_template_id, dst.id as legacy_template_id
  from public.structure_templates st
  join public.diocese_structure_templates dst
    on replace(dst.id::text, '-', '') = replace(st.key, 'legacy_diocese_', '')
  where st.key like 'legacy_diocese_%'
)
update public.structure_templates st
set metadata = coalesce(st.metadata, '{}'::jsonb)
  || jsonb_build_object(
    'legacy_source', 'diocese_structure_templates',
    'legacy_template_id', tm.legacy_template_id,
    'canonical_engine', true
  ),
  updated_at = now()
from template_map tm
where st.id = tm.canonical_template_id;

with template_map as (
  select st.id as canonical_template_id, dst.id as legacy_template_id
  from public.structure_templates st
  join public.diocese_structure_templates dst
    on replace(dst.id::text, '-', '') = replace(st.key, 'legacy_diocese_', '')
  where st.key like 'legacy_diocese_%'
), level_map as (
  select sl.id as canonical_level_id,
         dsl.id as legacy_level_id,
         dsl.template_id as legacy_template_id
  from public.structure_levels sl
  join template_map tm on tm.canonical_template_id = sl.template_id
  join public.diocese_structure_levels dsl
    on dsl.template_id = tm.legacy_template_id
   and dsl.level_order = sl.level_order
   and dsl.entity_type_id is not distinct from sl.linked_entity_type_id
)
update public.structure_levels sl
set metadata = coalesce(sl.metadata, '{}'::jsonb)
  || jsonb_build_object(
    'legacy_source', 'diocese_structure_levels',
    'legacy_level_id', lm.legacy_level_id,
    'legacy_template_id', lm.legacy_template_id,
    'canonical_engine', true
  ),
  updated_at = now()
from level_map lm
where sl.id = lm.canonical_level_id;

create or replace function app_private.guard_legacy_structure_write()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('sinep.allow_legacy_structure_write', true), 'off') = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  raise exception 'La tabla % pertenece al motor estructural heredado y es de solo lectura.', tg_table_name
    using errcode = '55000';
end;
$$;

revoke all on function app_private.guard_legacy_structure_write()
  from public, anon, authenticated;

drop trigger if exists trg_diocese_structure_templates_read_only on public.diocese_structure_templates;
create trigger trg_diocese_structure_templates_read_only
before insert or update or delete on public.diocese_structure_templates
for each row execute function app_private.guard_legacy_structure_write();

drop trigger if exists trg_diocese_structure_levels_read_only on public.diocese_structure_levels;
create trigger trg_diocese_structure_levels_read_only
before insert or update or delete on public.diocese_structure_levels
for each row execute function app_private.guard_legacy_structure_write();

drop trigger if exists trg_pastoral_structure_templates_read_only on public.pastoral_structure_templates;
create trigger trg_pastoral_structure_templates_read_only
before insert or update or delete on public.pastoral_structure_templates
for each row execute function app_private.guard_legacy_structure_write();

drop trigger if exists trg_pastoral_structure_levels_read_only on public.pastoral_structure_levels;
create trigger trg_pastoral_structure_levels_read_only
before insert or update or delete on public.pastoral_structure_levels
for each row execute function app_private.guard_legacy_structure_write();

comment on table public.diocese_structure_templates
  is 'LEGACY READ-ONLY: historical diocesan hierarchy templates. New writes use structure_templates.';
comment on table public.diocese_structure_levels
  is 'LEGACY READ-ONLY: historical diocesan hierarchy levels. New writes use structure_levels and structure_level_edges.';
comment on table public.pastoral_structure_templates
  is 'LEGACY READ-ONLY: historical pastoral hierarchy templates. New writes use structure_templates.';
comment on table public.pastoral_structure_levels
  is 'LEGACY READ-ONLY: historical pastoral hierarchy levels. New writes use structure_levels and structure_level_edges.';
comment on table public.pastoral_entities
  is 'Pastoral entity catalog. Hierarchical placement is canonical in structure_nodes and structure_node_edges.';
comment on table public.structure_templates
  is 'CANONICAL STRUCTURE ENGINE: hierarchy templates by diocese and kind.';
comment on table public.structure_levels
  is 'CANONICAL STRUCTURE ENGINE: configurable hierarchy levels.';
comment on table public.structure_nodes
  is 'CANONICAL STRUCTURE ENGINE: current and historical hierarchy nodes linked to domain entities.';
