revoke all privileges on public.persons from anon, authenticated;

grant select (
  id,
  first_name,
  middle_name,
  last_name,
  second_last_name,
  display_name,
  slug,
  person_type,
  gender,
  birth_date,
  birth_place,
  death_date,
  photo_url,
  photo_path,
  biography_public,
  notes_internal,
  status,
  visibility,
  created_by,
  created_at,
  updated_at,
  age_text
) on public.persons to anon, authenticated;

grant insert (
  first_name,
  middle_name,
  last_name,
  second_last_name,
  display_name,
  slug,
  person_type,
  gender,
  birth_date,
  birth_place,
  death_date,
  photo_url,
  photo_path,
  biography_public,
  notes_internal,
  status,
  visibility,
  created_by,
  age_text
) on public.persons to authenticated;

grant update (
  first_name,
  middle_name,
  last_name,
  second_last_name,
  display_name,
  slug,
  person_type,
  gender,
  birth_date,
  birth_place,
  death_date,
  photo_url,
  photo_path,
  biography_public,
  notes_internal,
  status,
  visibility,
  age_text
) on public.persons to authenticated;
