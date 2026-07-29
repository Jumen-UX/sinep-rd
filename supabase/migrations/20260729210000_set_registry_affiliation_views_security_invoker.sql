begin;

alter view public.public_ecclesiastical_place_affiliations
  set (security_invoker = true);

alter view public.public_ecclesial_institution_affiliations
  set (security_invoker = true);

comment on view public.public_ecclesiastical_place_affiliations is
  'Public-safe current and historical affiliations for published ecclesiastical places, evaluated with caller RLS and privileges.';

comment on view public.public_ecclesial_institution_affiliations is
  'Public-safe current and historical affiliations for published ecclesial institutions, evaluated with caller RLS and privileges.';

commit;
