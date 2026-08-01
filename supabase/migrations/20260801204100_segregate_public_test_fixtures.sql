begin;

-- QA fixtures use the reserved test-* slug prefix. They remain available to
-- authenticated test workflows, but must never satisfy public read contracts.
update public.ecclesiastical_entities
set visibility = 'internal', updated_at = now()
where slug ~* '^test-'
  and visibility = 'public';

update public.ecclesiastical_places
set visibility = 'internal', updated_at = now()
where slug ~* '^test-'
  and visibility = 'public';

update public.ecclesial_institutions
set visibility = 'internal', updated_at = now()
where slug ~* '^test-'
  and visibility = 'public';

alter table public.ecclesiastical_entities
  add constraint ecclesiastical_entities_test_fixture_not_public
  check (slug !~* '^test-' or visibility <> 'public');

alter table public.ecclesiastical_places
  add constraint ecclesiastical_places_test_fixture_not_public
  check (slug !~* '^test-' or visibility <> 'public');

alter table public.ecclesial_institutions
  add constraint ecclesial_institutions_test_fixture_not_public
  check (slug !~* '^test-' or visibility <> 'public');

do $$
begin
  if exists (
    select 1 from public.ecclesiastical_entities
    where slug ~* '^test-' and visibility = 'public'
  ) or exists (
    select 1 from public.ecclesiastical_places
    where slug ~* '^test-' and visibility = 'public'
  ) or exists (
    select 1 from public.ecclesial_institutions
    where slug ~* '^test-' and visibility = 'public'
  ) then
    raise exception 'Persisten fixtures test-* en contratos publicos';
  end if;
end
$$;

comment on constraint ecclesiastical_entities_test_fixture_not_public on public.ecclesiastical_entities
is 'Los fixtures QA con slug test-* nunca pueden publicarse.';
comment on constraint ecclesiastical_places_test_fixture_not_public on public.ecclesiastical_places
is 'Los fixtures QA con slug test-* nunca pueden publicarse.';
comment on constraint ecclesial_institutions_test_fixture_not_public on public.ecclesial_institutions
is 'Los fixtures QA con slug test-* nunca pueden publicarse.';

commit;
