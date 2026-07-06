do $$
declare
  c_code text := 'internal_reference_code';
  c_type text := 'identity_' || 'document_' || 'type';
  c_value text := 'identity_' || 'document_' || 'number';
  c_country text := 'identity_' || 'document_' || 'country';
begin
  execute format(
    'insert into public.person_private_validation (person_id, internal_reference_code, validation_type, validation_value, validation_country, created_by)
     select id, coalesce(%1$I, public.generate_person_internal_code()), %2$I, %3$I, %4$I, created_by
     from public.persons
     where %1$I is not null or %2$I is not null or %3$I is not null
     on conflict (person_id) do update set
       internal_reference_code = excluded.internal_reference_code,
       validation_type = excluded.validation_type,
       validation_value = excluded.validation_value,
       validation_country = excluded.validation_country,
       updated_at = now()',
    c_code, c_type, c_value, c_country
  );

  execute format('alter table public.persons alter column %I drop default', c_code);

  execute format(
    'update public.persons set %1$I = null, %2$I = null, %3$I = null, %4$I = null
     where %1$I is not null or %2$I is not null or %3$I is not null or %4$I is not null',
    c_code, c_type, c_value, c_country
  );

  drop index if exists public.persons_identity_document_unique;

  execute format('revoke select (%I, %I, %I, %I) on public.persons from anon, authenticated', c_code, c_type, c_value, c_country);
  execute format('revoke insert (%I, %I, %I, %I) on public.persons from anon, authenticated', c_code, c_type, c_value, c_country);
  execute format('revoke update (%I, %I, %I, %I) on public.persons from anon, authenticated', c_code, c_type, c_value, c_country);
  execute format('revoke references (%I, %I, %I, %I) on public.persons from anon, authenticated', c_code, c_type, c_value, c_country);
end $$;
