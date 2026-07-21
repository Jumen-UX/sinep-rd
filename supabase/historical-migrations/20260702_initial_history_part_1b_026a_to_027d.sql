-- HISTORICAL COPY ONLY.
-- Source: supabase_migrations.schema_migrations.
-- Already applied to the operational project; do not execute blindly.

-- BEGIN MIGRATION 20260702204242_026a_seed_current_bishop_people.sql
insert into public.offices (key, name, description, applies_to, is_clergy_office, is_pastoral_office, status)
values ('coadjutor_archbishop', 'Arzobispo coadjutor', 'Arzobispo con derecho de sucesión en una arquidiócesis.', 'entity', true, false, 'active')
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    updated_at = now();

with bishop_data as (
  select * from (values
    ('hector-rafael-rodriguez-rodriguez','Héctor Rafael Rodríguez Rodríguez','Héctor','Rafael','Rodríguez','Rodríguez','1961-01-13'::date,'Sánchez, Samaná','Arzobispo metropolitano de Santiago de los Caballeros y presidente de la Conferencia del Episcopado Dominicano.',null::date,'1989-06-10'::date,'2015-05-09'::date),
    ('francisco-ozoria-acosta','Francisco Ozoria Acosta','Francisco',null,'Ozoria','Acosta','1951-10-10'::date,'Nagua, República Dominicana','Arzobispo metropolitano de Santo Domingo, Primado de América y ordinario castrense de República Dominicana.',null::date,'1978-09-02'::date,'1997-03-15'::date),
    ('jesus-castro-marte','Jesús Castro Marte','Jesús',null,'Castro','Marte','1966-03-18'::date,'San Antonio de Guerra, República Dominicana','Obispo de Nuestra Señora de la Altagracia en Higüey y vicepresidente de la Conferencia del Episcopado Dominicano.',null::date,'1995-06-13'::date,'2017-08-26'::date),
    ('carlos-tomas-morel-diplan','Carlos Tomás Morel Diplán','Carlos','Tomás','Morel','Diplán','1969-10-01'::date,'Moca, Espaillat','Arzobispo coadjutor de Santo Domingo; anteriormente obispo de La Vega y auxiliar de Santiago de los Caballeros.',null::date,'2000-06-24'::date,null::date),
    ('faustino-burgos-brisman','Faustino Burgos Brisman','Faustino',null,'Burgos','Brisman','1960-02-15'::date,'San Francisco de Macorís','Obispo de Baní y secretario general de la Conferencia del Episcopado Dominicano.',null::date,'1987-05-30'::date,null::date),
    ('diomedes-antonio-espinal-de-leon','Diómedes Antonio Espinal de León','Diómedes','Antonio','Espinal','de León',null::date,null,'Obispo de Mao-Monte Cristi.',null::date,null::date,null::date),
    ('julio-cesar-corniel-amaro','Julio César Corniel Amaro','Julio','César','Corniel','Amaro',null::date,null,'Obispo de Puerto Plata.',null::date,null::date,null::date),
    ('andres-napoleon-romero-cardenas','Andrés Napoleón Romero Cárdenas','Andrés','Napoleón','Romero','Cárdenas',null::date,null,'Obispo de Barahona.',null::date,null::date,null::date),
    ('santiago-rodriguez-rodriguez','Santiago Rodríguez Rodríguez','Santiago',null,'Rodríguez','Rodríguez','1968-05-25'::date,'Mamey, Los Hidalgos, Puerto Plata','Obispo de San Pedro de Macorís.',null::date,'2000-06-24'::date,'2017-12-30'::date),
    ('tomas-alejo-concepcion','Tomás Alejo Concepción','Tomás','Alejo','Concepción',null,'1963-06-15'::date,'Villa Tapia, Hermanas Mirabal','Obispo de San Juan de la Maguana.',null::date,'1993-08-07'::date,'2021-01-16'::date),
    ('ramon-alfredo-de-la-cruz-baldera','Ramón Alfredo de la Cruz Baldera','Ramón','Alfredo','de la Cruz','Baldera','1961-07-05'::date,'San Francisco de Macorís','Obispo de San Francisco de Macorís.',null::date,null::date,'2021-07-24'::date),
    ('manuel-antonio-ruiz-de-la-rosa','Manuel Antonio Ruíz de la Rosa','Manuel','Antonio','Ruíz','de la Rosa','1965-08-27'::date,'Bayaguana, Monte Plata','Primer obispo de la Diócesis de Stella Maris.',null::date,'1993-07-10'::date,'2025-11-08'::date),
    ('jose-amable-duran-tineo','José Amable Durán Tineo','José','Amable','Durán','Tineo',null::date,null,'Obispo auxiliar de Santo Domingo y administrador apostólico de La Vega.',null::date,null::date,null::date),
    ('andres-amauri-rosario-henriquez','Andrés Amauri Rosario Henríquez','Andrés','Amauri','Rosario','Henríquez',null::date,null,'Obispo auxiliar de Santiago de los Caballeros.',null::date,null::date,'2025-09-20'::date),
    ('nicolas-de-jesus-lopez-rodriguez','Nicolás de Jesús López Rodríguez','Nicolás','de Jesús','López','Rodríguez',null::date,null,'Cardenal y arzobispo emérito de Santo Domingo.',null::date,null::date,null::date),
    ('rafael-leonidas-felipe-y-nunez','Rafael Leónidas Felipe y Núñez','Rafael','Leónidas','Felipe','y Núñez','1938-09-12'::date,'Villa Tapia, República Dominicana','Obispo emérito de Barahona.','2025-12-10'::date,'1965-03-25'::date,'2000-01-22'::date),
    ('fausto-ramon-mejia-vallejo','Fausto Ramón Mejía Vallejo','Fausto','Ramón','Mejía','Vallejo',null::date,null,'Obispo emérito de San Francisco de Macorís.',null::date,null::date,null::date),
    ('freddy-antonio-de-jesus-breton-martinez','Freddy Antonio de Jesús Bretón Martínez','Freddy','Antonio de Jesús','Bretón','Martínez',null::date,null,'Arzobispo emérito de Santiago de los Caballeros.',null::date,null::date,null::date),
    ('piergiorgio-bertoldi','Piergiorgio Bertoldi','Piergiorgio',null,'Bertoldi',null,null::date,null,'Nuncio apostólico; consagrante principal de Manuel Antonio Ruíz de la Rosa.',null::date,null::date,null::date),
    ('ghaleb-moussa-abdalla-bader','Ghaleb Moussa Abdalla Bader','Ghaleb','Moussa Abdalla','Bader',null,null::date,null,'Nuncio apostólico; consagrante principal de Tomás Alejo Concepción.',null::date,null::date,null::date)
  ) as v(slug, display_name, first_name, middle_name, last_name, second_last_name, birth_date, birth_place, biography_public, death_date, priestly_ordination_date, episcopal_ordination_date)
), upsert_persons as (
  insert into public.persons (slug, display_name, first_name, middle_name, last_name, second_last_name, person_type, gender, birth_date, birth_place, biography_public, death_date, status, visibility)
  select slug, display_name, first_name, middle_name, last_name, second_last_name, 'bishop', 'male', birth_date, birth_place, biography_public, death_date, 'active', 'public'
  from bishop_data
  on conflict (slug) do update
  set display_name = excluded.display_name,
      first_name = excluded.first_name,
      middle_name = excluded.middle_name,
      last_name = excluded.last_name,
      second_last_name = excluded.second_last_name,
      person_type = excluded.person_type,
      gender = excluded.gender,
      birth_date = coalesce(excluded.birth_date, public.persons.birth_date),
      birth_place = coalesce(excluded.birth_place, public.persons.birth_place),
      biography_public = excluded.biography_public,
      death_date = excluded.death_date,
      status = excluded.status,
      visibility = excluded.visibility,
      updated_at = now()
  returning id, slug
), all_bishops as (
  select p.id, p.slug, bd.priestly_ordination_date, bd.episcopal_ordination_date
  from public.persons p
  join bishop_data bd on bd.slug = p.slug
)
insert into public.clergy_profiles (person_id, priestly_ordination_date, episcopal_ordination_date, canonical_status)
select id, priestly_ordination_date, episcopal_ordination_date, 'active'
from all_bishops
where not exists (select 1 from public.clergy_profiles cp where cp.person_id = all_bishops.id);

notify pgrst, 'reload schema';;
-- END MIGRATION 20260702204242_026a_seed_current_bishop_people.sql

-- BEGIN MIGRATION 20260702204300_026b_seed_current_bishop_appointments.sql
with bishop_data as (
  select * from (values
    ('hector-rafael-rodriguez-rodriguez','arquidiocesis-metropolitana-de-santiago-de-los-caballeros','metropolitan_archbishop','2023-10-07'::date),
    ('francisco-ozoria-acosta','arquidiocesis-metropolitana-de-santo-domingo','metropolitan_archbishop','2016-09-10'::date),
    ('francisco-ozoria-acosta','obispado-castrense-de-republica-dominicana','diocesan_bishop','2017-01-02'::date),
    ('jesus-castro-marte','diocesis-de-nuestra-senora-de-la-altagracia-en-higuey','diocesan_bishop','2020-07-28'::date),
    ('carlos-tomas-morel-diplan','arquidiocesis-metropolitana-de-santo-domingo','coadjutor_archbishop','2025-10-18'::date),
    ('faustino-burgos-brisman','diocesis-de-bani','diocesan_bishop','2024-08-17'::date),
    ('diomedes-antonio-espinal-de-leon','diocesis-de-mao-monte-cristi','diocesan_bishop','2006-01-01'::date),
    ('julio-cesar-corniel-amaro','diocesis-de-puerto-plata','diocesan_bishop','2005-01-01'::date),
    ('andres-napoleon-romero-cardenas','diocesis-de-barahona','diocesan_bishop','2015-02-23'::date),
    ('santiago-rodriguez-rodriguez','diocesis-de-san-pedro-de-macoris','diocesan_bishop','2017-12-30'::date),
    ('tomas-alejo-concepcion','diocesis-de-san-juan-de-la-maguana','diocesan_bishop','2020-11-07'::date),
    ('ramon-alfredo-de-la-cruz-baldera','diocesis-de-san-francisco-de-macoris','diocesan_bishop','2021-07-24'::date),
    ('manuel-antonio-ruiz-de-la-rosa','diocesis-de-stella-maris','diocesan_bishop','2025-08-27'::date),
    ('jose-amable-duran-tineo','diocesis-de-la-vega','apostolic_administrator','2025-10-18'::date),
    ('andres-amauri-rosario-henriquez','arquidiocesis-metropolitana-de-santiago-de-los-caballeros','auxiliary_bishop','2025-06-23'::date)
  ) as v(person_slug, entity_slug, office_key, start_date)
)
insert into public.appointments (person_id, entity_id, office_id, start_date, is_current, appointment_type, status, visibility)
select p.id, e.id, o.id, bd.start_date, true, 'canonical', 'active', 'public'
from bishop_data bd
join public.persons p on p.slug = bd.person_slug
join public.ecclesiastical_entities e on e.slug = bd.entity_slug
join public.offices o on o.key = bd.office_key
where not exists (
  select 1 from public.appointments a
  where a.person_id = p.id and a.entity_id = e.id and a.office_id = o.id and a.is_current = true
);

update public.ecclesiastical_entities
set current_ordinary_name = 'Andrés Napoleón Romero Cárdenas',
    current_ordinary_title = 'Obispo',
    updated_at = now()
where slug = 'diocesis-de-barahona';

update public.ecclesiastical_entities
set current_ordinary_name = 'José Amable Durán Tineo',
    current_ordinary_title = 'Administrador apostólico',
    updated_at = now()
where slug = 'diocesis-de-la-vega';

notify pgrst, 'reload schema';;
-- END MIGRATION 20260702204300_026b_seed_current_bishop_appointments.sql

-- BEGIN MIGRATION 20260702204318_026c_seed_current_bishop_succession.sql
with succession_data as (
  select * from (values
    ('francisco-ozoria-acosta','1997-03-15'::date,null::text,'nicolas-de-jesus-lopez-rodriguez',null::text,null::text,'Catholic-Hierarchy / Wikipedia','https://en.wikipedia.org/wiki/Francisco_Ozoria_Acosta','verified'),
    ('jesus-castro-marte','2017-08-26'::date,'Santo Domingo','francisco-ozoria-acosta','rafael-leonidas-felipe-y-nunez','andres-napoleon-romero-cardenas','Catholic-Hierarchy / Wikipedia','https://en.wikipedia.org/wiki/Jes%C3%BAs_Castro_Marte','verified'),
    ('hector-rafael-rodriguez-rodriguez','2015-05-09'::date,'Catedral de La Vega','nicolas-de-jesus-lopez-rodriguez',null::text,null::text,'Catholic-Hierarchy / Wikipedia','https://es.wikipedia.org/wiki/H%C3%A9ctor_Rafael_Rodr%C3%ADguez','verified'),
    ('tomas-alejo-concepcion','2021-01-16'::date,null::text,'ghaleb-moussa-abdalla-bader',null::text,null::text,'Catholic-Hierarchy / Wikipedia','https://es.wikipedia.org/wiki/Tom%C3%A1s_Alejo_Concepci%C3%B3n','verified'),
    ('ramon-alfredo-de-la-cruz-baldera','2021-07-24'::date,'San Francisco de Macorís','fausto-ramon-mejia-vallejo',null::text,null::text,'Catholic-Hierarchy / Wikipedia','https://es.wikipedia.org/wiki/Ram%C3%B3n_Alfredo_de_la_Cruz_Baldera','verified'),
    ('manuel-antonio-ruiz-de-la-rosa','2025-11-08'::date,null::text,'piergiorgio-bertoldi','fausto-ramon-mejia-vallejo','freddy-antonio-de-jesus-breton-martinez','Catholic-Hierarchy / Wikipedia','https://en.wikipedia.org/wiki/Manuel_Antonio_Ru%C3%ADz_de_la_Rosa','verified'),
    ('andres-amauri-rosario-henriquez','2025-09-20'::date,'Santiago de los Caballeros','hector-rafael-rodriguez-rodriguez',null::text,null::text,'Catholic-Hierarchy / Wikipedia','https://es.wikipedia.org/wiki/Andr%C3%A9s_Amauri_Rosario_Henr%C3%ADquez','verified')
  ) as v(bishop_slug, ordination_date, ordination_place, principal_slug, co1_slug, co2_slug, source_name, source_url, verification_status)
)
insert into public.episcopal_ordinations (
  bishop_person_id,
  ordination_date,
  ordination_place,
  principal_consecrator_person_id,
  co_consecrator_1_person_id,
  co_consecrator_2_person_id,
  source_name,
  source_url,
  source_checked_at,
  verification_status,
  visibility,
  status
)
select
  bishop.id,
  sd.ordination_date,
  sd.ordination_place,
  principal.id,
  co1.id,
  co2.id,
  sd.source_name,
  sd.source_url,
  '2026-07-02'::date,
  sd.verification_status,
  'public',
  'active'
from succession_data sd
join public.persons bishop on bishop.slug = sd.bishop_slug
left join public.persons principal on principal.slug = sd.principal_slug
left join public.persons co1 on co1.slug = sd.co1_slug
left join public.persons co2 on co2.slug = sd.co2_slug
on conflict (bishop_person_id) do update
set ordination_date = excluded.ordination_date,
    ordination_place = excluded.ordination_place,
    principal_consecrator_person_id = excluded.principal_consecrator_person_id,
    co_consecrator_1_person_id = excluded.co_consecrator_1_person_id,
    co_consecrator_2_person_id = excluded.co_consecrator_2_person_id,
    source_name = excluded.source_name,
    source_url = excluded.source_url,
    source_checked_at = excluded.source_checked_at,
    verification_status = excluded.verification_status,
    visibility = excluded.visibility,
    status = excluded.status,
    updated_at = now();

notify pgrst, 'reload schema';;
-- END MIGRATION 20260702204318_026c_seed_current_bishop_succession.sql

-- BEGIN MIGRATION 20260702205104_027a_seed_santiago_past_bishop_people.sql
with person_data as (
  select * from (values
    ('hugo-eduardo-polanco-brito','Hugo Eduardo Polanco Brito','Hugo','Eduardo','Polanco','Brito','Obispo auxiliar y luego obispo de Santiago de los Caballeros.', '1944-06-25'::date),
    ('roque-antonio-adames-rodriguez','Roque Antonio Adames Rodríguez','Roque','Antonio','Adames','Rodríguez','Obispo de Santiago de los Caballeros de 1966 a 1992.', '1954-04-17'::date),
    ('juan-antonio-flores-santana','Juan Antonio Flores Santana','Juan','Antonio','Flores','Santana','Obispo y luego arzobispo de Santiago de los Caballeros de 1992 a 2003.', null::date),
    ('ramon-benito-de-la-rosa-y-carpio','Ramón Benito de La Rosa y Carpio','Ramón','Benito','de La Rosa','y Carpio','Arzobispo emérito de Santiago de los Caballeros.', null::date),
    ('valentin-reynoso-hidalgo','Valentín Reynoso Hidalgo','Valentín',null,'Reynoso','Hidalgo','Obispo auxiliar emérito de Santiago de los Caballeros.', null::date),
    ('jesus-maria-de-jesus-moya','Jesús María de Jesús Moya','Jesús','María','de Jesús','Moya','Obispo auxiliar de Santiago de los Caballeros de 1977 a 1984.', '1961-03-18'::date),
    ('octavio-antonio-beras-rojas','Octavio Antonio Beras Rojas','Octavio','Antonio','Beras','Rojas','Administrador apostólico de Santiago de los Caballeros de 1954 a 1956.', null::date),
    ('jose-dolores-grullon-estrella','José Dolores Grullón Estrella','José','Dolores','Grullón','Estrella','Persona afiliada a Santiago de los Caballeros; sacerdote desde el 13 de diciembre de 1970.', '1970-12-13'::date),
    ('gregorio-nicanor-pena-rodriguez','Gregorio Nicanor Peña Rodríguez','Gregorio','Nicanor','Peña','Rodríguez','Persona afiliada a Santiago de los Caballeros; sacerdote desde el 22 de junio de 1968.', '1968-06-22'::date)
  ) as v(slug, display_name, first_name, middle_name, last_name, second_last_name, biography_public, priestly_ordination_date)
), upsert_persons as (
  insert into public.persons (slug, display_name, first_name, middle_name, last_name, second_last_name, person_type, gender, biography_public, status, visibility)
  select slug, display_name, first_name, middle_name, last_name, second_last_name, 'bishop', 'male', biography_public, 'active', 'public'
  from person_data
  on conflict (slug) do update
  set display_name = excluded.display_name,
      first_name = excluded.first_name,
      middle_name = excluded.middle_name,
      last_name = excluded.last_name,
      second_last_name = excluded.second_last_name,
      person_type = excluded.person_type,
      gender = excluded.gender,
      biography_public = excluded.biography_public,
      status = excluded.status,
      visibility = excluded.visibility,
      updated_at = now()
  returning id, slug
), all_persons as (
  select p.id, pd.priestly_ordination_date
  from public.persons p
  join person_data pd on pd.slug = p.slug
)
insert into public.clergy_profiles (person_id, priestly_ordination_date, canonical_status)
select id, priestly_ordination_date, 'active'
from all_persons
where not exists (select 1 from public.clergy_profiles cp where cp.person_id = all_persons.id);

update public.clergy_profiles cp
set priestly_ordination_date = '2000-06-21'::date,
    updated_at = now()
from public.persons p
where p.id = cp.person_id
  and p.slug = 'carlos-tomas-morel-diplan';

notify pgrst, 'reload schema';;
-- END MIGRATION 20260702205104_027a_seed_santiago_past_bishop_people.sql

-- BEGIN MIGRATION 20260702205124_027b_seed_santiago_past_bishop_appointments.sql
with appointment_data as (
  select * from (values
    ('octavio-antonio-beras-rojas','apostolic_administrator','1954-03-14'::date,'1956-11-24'::date,false,'Administrador apostólico de Santiago de los Caballeros.'),
    ('hugo-eduardo-polanco-brito','auxiliary_bishop','1953-09-25'::date,'1956-07-22'::date,false,'Obispo auxiliar de Santiago de los Caballeros.'),
    ('hugo-eduardo-polanco-brito','diocesan_bishop','1956-07-22'::date,'1966-03-14'::date,false,'Obispo de Santiago de los Caballeros.'),
    ('roque-antonio-adames-rodriguez','diocesan_bishop','1966-03-14'::date,'1992-04-22'::date,false,'Obispo de Santiago de los Caballeros.'),
    ('juan-antonio-flores-santana','diocesan_bishop','1992-07-13'::date,'1994-02-14'::date,false,'Obispo de Santiago de los Caballeros antes de la elevación a arquidiócesis.'),
    ('juan-antonio-flores-santana','metropolitan_archbishop','1994-02-14'::date,'2003-07-16'::date,false,'Primer arzobispo metropolitano de Santiago de los Caballeros tras la elevación.'),
    ('ramon-benito-de-la-rosa-y-carpio','metropolitan_archbishop','2003-07-16'::date,'2015-02-23'::date,false,'Arzobispo metropolitano de Santiago de los Caballeros.'),
    ('freddy-antonio-de-jesus-breton-martinez','metropolitan_archbishop','2015-02-23'::date,'2023-10-07'::date,false,'Arzobispo metropolitano de Santiago de los Caballeros.'),
    ('jesus-maria-de-jesus-moya','auxiliary_bishop','1977-04-13'::date,'1984-04-20'::date,false,'Obispo auxiliar de Santiago de los Caballeros.'),
    ('diomedes-antonio-espinal-de-leon','auxiliary_bishop','2000-04-20'::date,'2006-05-24'::date,false,'Obispo auxiliar de Santiago de los Caballeros.'),
    ('valentin-reynoso-hidalgo','auxiliary_bishop','2007-10-22'::date,'2018-02-02'::date,false,'Obispo auxiliar de Santiago de los Caballeros.'),
    ('carlos-tomas-morel-diplan','auxiliary_bishop','2016-12-14'::date,'2024-10-18'::date,false,'Obispo auxiliar de Santiago de los Caballeros.'),
    ('ramon-benito-de-la-rosa-y-carpio','bishop_emeritus','2015-02-23'::date,null::date,true,'Arzobispo emérito de Santiago de los Caballeros.'),
    ('freddy-antonio-de-jesus-breton-martinez','bishop_emeritus','2023-10-07'::date,null::date,true,'Arzobispo emérito de Santiago de los Caballeros.'),
    ('valentin-reynoso-hidalgo','bishop_emeritus','2018-02-02'::date,null::date,true,'Obispo auxiliar emérito de Santiago de los Caballeros.')
  ) as v(person_slug, office_key, start_date, end_date, is_current, notes_public)
)
insert into public.appointments (person_id, entity_id, office_id, start_date, end_date, is_current, appointment_type, status, visibility, notes_public)
select p.id, e.id, o.id, ad.start_date, ad.end_date, ad.is_current, 'canonical', 'active', 'public', ad.notes_public
from appointment_data ad
join public.persons p on p.slug = ad.person_slug
join public.ecclesiastical_entities e on e.slug = 'arquidiocesis-metropolitana-de-santiago-de-los-caballeros'
join public.offices o on o.key = ad.office_key
where not exists (
  select 1 from public.appointments a
  where a.person_id = p.id
    and a.entity_id = e.id
    and a.office_id = o.id
    and a.start_date = ad.start_date
);

notify pgrst, 'reload schema';;
-- END MIGRATION 20260702205124_027b_seed_santiago_past_bishop_appointments.sql

-- BEGIN MIGRATION 20260702205145_027c_seed_santiago_bishop_movements.sql
with movement_data as (
  select * from (values
    ('hugo-eduardo-polanco-brito','Nombrado obispo de Santiago de los Caballeros','1956-07-22'::date,'1966-03-14'::date),
    ('roque-antonio-adames-rodriguez','Nombrado obispo de Santiago de los Caballeros','1966-03-14'::date,'1992-04-22'::date),
    ('juan-antonio-flores-santana','Nombrado obispo y luego arzobispo de Santiago de los Caballeros','1992-07-13'::date,'2003-07-16'::date),
    ('ramon-benito-de-la-rosa-y-carpio','Nombrado arzobispo de Santiago de los Caballeros','2003-07-16'::date,'2015-02-23'::date),
    ('freddy-antonio-de-jesus-breton-martinez','Nombrado arzobispo de Santiago de los Caballeros','2015-02-23'::date,'2023-10-07'::date),
    ('hector-rafael-rodriguez-rodriguez','Nombrado arzobispo de Santiago de los Caballeros','2023-10-07'::date,null::date),
    ('andres-amauri-rosario-henriquez','Nombrado obispo auxiliar de Santiago de los Caballeros','2025-06-23'::date,null::date)
  ) as v(person_slug, title, effective_date, end_date)
)
insert into public.movements (person_id, entity_id, movement_type, title, description, effective_date, end_date, status, visibility)
select p.id, e.id, 'appointment', md.title, 'Dato cargado desde la ficha de Catholic-Hierarchy de la Arquidiócesis de Santiago de los Caballeros.', md.effective_date, md.end_date, 'active', 'public'
from movement_data md
join public.persons p on p.slug = md.person_slug
join public.ecclesiastical_entities e on e.slug = 'arquidiocesis-metropolitana-de-santiago-de-los-caballeros'
where not exists (
  select 1 from public.movements m
  where m.person_id = p.id
    and m.entity_id = e.id
    and m.effective_date = md.effective_date
    and m.title = md.title
);

notify pgrst, 'reload schema';;
-- END MIGRATION 20260702205145_027c_seed_santiago_bishop_movements.sql

-- BEGIN MIGRATION 20260702205159_027d_update_santiago_entity_from_pdf.sql
update public.ecclesiastical_entities
set official_name = 'Arquidiócesis de Santiago de los Caballeros',
    latin_name = 'Archidioecesis Sancti Iacobi Equitum',
    website = 'https://clerosantiagord.org',
    address = 'Arzobispado, Calle Duvergé 14, Apartado 679, Santiago de los Caballeros, República Dominicana',
    phone = '(809)582-2094',
    area_km2 = 3633,
    statistics_year = 2023,
    catholics_total = 1133000,
    population_total = 1353700,
    catholics_percent = 83.7,
    parishes_count = 108,
    source_name = 'Catholic-Hierarchy PDF de Santiago de los Caballeros',
    source_url = 'Santiago de los Caballeros (Arquidiócesis) [Católica-Jerarquía].pdf',
    source_checked_at = '2026-07-02'::date,
    updated_at = now()
where slug = 'arquidiocesis-metropolitana-de-santiago-de-los-caballeros';

notify pgrst, 'reload schema';;
-- END MIGRATION 20260702205159_027d_update_santiago_entity_from_pdf.sql
