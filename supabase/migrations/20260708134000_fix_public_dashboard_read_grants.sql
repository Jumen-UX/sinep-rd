-- Public dashboard read grants.
-- The public dashboard uses anon REST reads for active/public organizational and pastoral sources.
-- Keep this limited to read-only access; writes remain unavailable to anon.

grant usage on schema public to anon, authenticated;

do $$
declare
  object_name text;
begin
  foreach object_name in array array[
    'public.organization_charts',
    'public.organization_units',
    'public.public_pastoral_entities',
    'public.pastoral_entities',
    'public.pastoral_structure_levels'
  ] loop
    if to_regclass(object_name) is not null then
      execute format('grant select on %s to anon, authenticated', object_name);
    end if;
  end loop;
end;
$$;

-- If RLS is enabled on these tables, allow only rows intentionally marked public/active.
-- Policies are created conditionally so the migration remains safe across partially seeded schemas.
do $$
begin
  if to_regclass('public.organization_charts') is not null
     and not exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'organization_charts'
         and policyname = 'Public can read active public organization charts'
     ) then
    create policy "Public can read active public organization charts"
      on public.organization_charts
      for select
      to anon, authenticated
      using (status::text = 'active' and visibility::text = 'public');
  end if;

  if to_regclass('public.organization_units') is not null
     and not exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'organization_units'
         and policyname = 'Public can read active public organization units'
     ) then
    create policy "Public can read active public organization units"
      on public.organization_units
      for select
      to anon, authenticated
      using (status::text = 'active' and visibility::text = 'public');
  end if;

  if to_regclass('public.pastoral_entities') is not null
     and not exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'pastoral_entities'
         and policyname = 'Public can read active public pastoral entities'
     ) then
    create policy "Public can read active public pastoral entities"
      on public.pastoral_entities
      for select
      to anon, authenticated
      using (status::text = 'active' and visibility::text = 'public');
  end if;

  if to_regclass('public.pastoral_structure_levels') is not null
     and not exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'pastoral_structure_levels'
         and policyname = 'Public can read active pastoral structure levels'
     ) then
    create policy "Public can read active pastoral structure levels"
      on public.pastoral_structure_levels
      for select
      to anon, authenticated
      using (coalesce(status::text, 'active') = 'active');
  end if;
end;
$$;
