create index if not exists ecclesiastical_places_place_type_id_idx
  on public.ecclesiastical_places(place_type_id);
create index if not exists ecclesiastical_places_source_document_id_idx
  on public.ecclesiastical_places(source_document_id);
create index if not exists ecclesiastical_places_created_by_idx
  on public.ecclesiastical_places(created_by);

create index if not exists ecclesial_institution_categories_parent_id_idx
  on public.ecclesial_institution_categories(parent_category_id);

create index if not exists ecclesial_institutions_category_id_idx
  on public.ecclesial_institutions(category_id);
create index if not exists ecclesial_institutions_source_document_id_idx
  on public.ecclesial_institutions(source_document_id);
create index if not exists ecclesial_institutions_created_by_idx
  on public.ecclesial_institutions(created_by);

create index if not exists ecclesiastical_place_affiliations_source_document_id_idx
  on public.ecclesiastical_place_affiliations(source_document_id);
create index if not exists ecclesiastical_place_affiliations_created_by_idx
  on public.ecclesiastical_place_affiliations(created_by);

create index if not exists ecclesial_institution_affiliations_source_document_id_idx
  on public.ecclesial_institution_affiliations(source_document_id);
create index if not exists ecclesial_institution_affiliations_created_by_idx
  on public.ecclesial_institution_affiliations(created_by);

create index if not exists communication_channels_channel_type_id_idx
  on public.communication_channels(channel_type_id);
create index if not exists communication_channels_source_document_id_idx
  on public.communication_channels(source_document_id);
create index if not exists communication_channels_created_by_idx
  on public.communication_channels(created_by);
