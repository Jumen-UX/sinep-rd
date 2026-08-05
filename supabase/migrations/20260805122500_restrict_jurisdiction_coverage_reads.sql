-- Keep direct table reads conservative until an audited jurisdiction-scoped
-- administrative RPC is introduced.

drop policy if exists jurisdiction_coverages_authenticated_read
on public.jurisdiction_geographic_coverages;

create policy jurisdiction_coverages_authenticated_read
on public.jurisdiction_geographic_coverages
for select
to authenticated
using (
  status = 'active'
  and visibility = 'public'
  and is_current
  and (valid_from is null or valid_from <= current_date)
  and (valid_to is null or valid_to >= current_date)
);
