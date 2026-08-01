create index if not exists user_country_membership_sources_created_by_idx
  on app_private.user_country_membership_sources (created_by);

create index if not exists user_country_memberships_country_entity_id_idx
  on app_private.user_country_memberships (country_entity_id);

create index if not exists user_country_memberships_created_by_idx
  on app_private.user_country_memberships (created_by);

create index if not exists user_country_memberships_ended_by_idx
  on app_private.user_country_memberships (ended_by);
