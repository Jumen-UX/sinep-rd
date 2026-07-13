grant select on public.office_canonical_links to anon;
grant select on public.canonical_office_definitions to anon;
grant select on public.canonical_sources to anon;

drop policy if exists office_canonical_links_select_anon on public.office_canonical_links;
create policy office_canonical_links_select_anon
on public.office_canonical_links
for select
to anon
using (
  exists (
    select 1
    from public.canonical_office_definitions definition
    where definition.id = office_canonical_links.canonical_office_definition_id
      and definition.status = 'active'
  )
);

drop policy if exists canonical_office_definitions_select_anon on public.canonical_office_definitions;
create policy canonical_office_definitions_select_anon
on public.canonical_office_definitions
for select
to anon
using (status = 'active');

drop policy if exists canonical_sources_select_anon on public.canonical_sources;
create policy canonical_sources_select_anon
on public.canonical_sources
for select
to anon
using (
  status = 'active'
  and exists (
    select 1
    from public.canonical_office_definitions definition
    where definition.source_id = canonical_sources.id
      and definition.status = 'active'
  )
);
