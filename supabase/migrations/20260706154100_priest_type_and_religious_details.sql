alter table public.clergy_profiles
  add column if not exists priest_type text,
  add column if not exists religious_institute_name text,
  add column if not exists religious_province_name text,
  add column if not exists religious_house_entity_id uuid references public.ecclesiastical_entities(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clergy_profiles_priest_type_check'
      and conrelid = 'public.clergy_profiles'::regclass
  ) then
    alter table public.clergy_profiles
      add constraint clergy_profiles_priest_type_check
      check (priest_type is null or priest_type in ('diocesan','religious'));
  end if;
end $$;

update public.clergy_profiles
set priest_type = case
  when nullif(btrim(religious_order), '') is not null then 'religious'
  when priestly_ordination_date is not null then 'diocesan'
  else priest_type
end
where priest_type is null;
