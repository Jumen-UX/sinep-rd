-- S8-06: supporting indexes for verified public read patterns.
-- These indexes are partial and idempotent to minimize write overhead.

create index if not exists ecclesiastical_entities_public_active_type_name_idx
  on public.ecclesiastical_entities (entity_type_id, name)
  where status = 'active' and visibility = 'public';

create index if not exists entity_relationships_current_active_child_idx
  on public.entity_relationships (child_entity_id, parent_entity_id)
  where is_current = true and status = 'active';

create index if not exists organization_units_public_current_chart_order_idx
  on public.organization_units (organization_chart_id, sort_order, name)
  where status = 'active' and visibility = 'public' and is_current = true;
