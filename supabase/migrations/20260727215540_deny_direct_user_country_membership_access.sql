begin;

drop policy if exists user_country_memberships_internal_only
  on app_private.user_country_memberships;

create policy user_country_memberships_internal_only
on app_private.user_country_memberships
as restrictive
for all
to public
using (false)
with check (false);

drop policy if exists user_country_membership_sources_internal_only
  on app_private.user_country_membership_sources;

create policy user_country_membership_sources_internal_only
on app_private.user_country_membership_sources
as restrictive
for all
to public
using (false)
with check (false);

comment on policy user_country_memberships_internal_only
  on app_private.user_country_memberships is
  'Defense in depth: direct access is always denied; all operations use audited app_private functions.';

comment on policy user_country_membership_sources_internal_only
  on app_private.user_country_membership_sources is
  'Defense in depth: direct access is always denied; all source lifecycle writes use internal triggers and functions.';

commit;
