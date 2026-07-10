-- The ISO country catalog is public reference data used by both the public portal
-- and authenticated administrative screens.

grant select on table public.country_catalog to anon, authenticated;
grant select on table public.public_country_catalog to anon, authenticated;
