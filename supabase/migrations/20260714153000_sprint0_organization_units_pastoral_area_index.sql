create index if not exists organization_units_pastoral_area_id_idx
  on public.organization_units (pastoral_area_id)
  where pastoral_area_id is not null;
