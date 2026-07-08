alter table public.persons
  add column if not exists honorific_prefix text;

alter table public.persons
  add column if not exists formal_display_name text generated always as (
    case
      when nullif(btrim(coalesce(honorific_prefix, '')), '') is null then display_name
      else btrim(honorific_prefix) || ' ' || display_name
    end
  ) stored;

comment on column public.persons.honorific_prefix is 'Tratamiento eclesiástico o civil que antecede el nombre público: Mons., Pbro., Diác., Hna., etc.';
comment on column public.persons.formal_display_name is 'Nombre público formal calculado a partir de honorific_prefix y display_name.';

update public.persons
set honorific_prefix = case
  when person_type = 'bishop' then 'Mons.'
  when person_type = 'priest' then 'Pbro.'
  when person_type = 'deacon' then 'Diác.'
  else honorific_prefix
end
where honorific_prefix is null
  and person_type in ('bishop', 'priest', 'deacon');
