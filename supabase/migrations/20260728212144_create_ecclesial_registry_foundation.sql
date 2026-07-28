insert into public.country_catalog(
  iso2,iso3,name_en,official_name_en,name_es,flag_emoji,flag_alt,is_enabled_by_default,is_custom
)
select country.iso2,country.iso3,country.name,country.official_name,country.name,country.flag_emoji,
       'Bandera de '||country.name,true,false
from public.countries country
where exists(
  select 1
  from public.ecclesiastical_entities entity
  join public.entity_types entity_type on entity_type.id=entity.entity_type_id
  where entity_type.key='country'
    and entity.status='active'
    and entity.country_iso2=country.iso2
)
on conflict(iso2) do update set
  iso3=excluded.iso3,
  name_es=coalesce(public.country_catalog.name_es,excluded.name_es),
  flag_emoji=coalesce(public.country_catalog.flag_emoji,excluded.flag_emoji),
  flag_alt=coalesce(public.country_catalog.flag_alt,excluded.flag_alt),
  updated_at=now();

create table if not exists public.ecclesiastical_place_types (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_liturgical boolean not null default true,
  allows_dedication boolean not null default true,
  allows_consecration boolean not null default false,
  sort_order integer not null default 100,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ecclesial_institution_categories (
  id uuid primary key default gen_random_uuid(),
  parent_category_id uuid references public.ecclesial_institution_categories(id) on delete restrict,
  key text not null unique,
  name text not null,
  description text,
  domain text not null check (domain in ('education','health','formation','consecrated_life','charity','media','culture','social','administration','other')),
  sort_order integer not null default 100,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_category_id is null or parent_category_id <> id)
);

create table if not exists public.communication_channel_types (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  channel_group text not null check (channel_group in ('contact','web','social','broadcast','publication','messaging','other')),
  value_kind text not null default 'text' check (value_kind in ('text','email','phone','url','frequency','handle')),
  sort_order integer not null default 100,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ecclesiastical_places (
  id uuid primary key default gen_random_uuid(),
  place_type_id uuid not null references public.ecclesiastical_place_types(id) on delete restrict,
  primary_entity_id uuid not null references public.ecclesiastical_entities(id) on delete restrict,
  managing_organization_unit_id uuid references public.organization_units(id) on delete set null,
  legacy_entity_id uuid unique references public.ecclesiastical_entities(id) on delete set null,
  country_iso2 char(2) not null references public.country_catalog(iso2) on update cascade on delete restrict,
  name text not null,
  official_name text,
  slug text not null unique,
  description text,
  dedication_title text,
  patron_name text,
  opened_at date,
  blessed_at date,
  dedicated_at date,
  consecrated_at date,
  closed_at date,
  capacity integer check (capacity is null or capacity >= 0),
  is_primary_seat boolean not null default false,
  province text,
  municipality text,
  sector text,
  address text,
  latitude numeric check (latitude is null or latitude between -90 and 90),
  longitude numeric check (longitude is null or longitude between -180 and 180),
  source_document_id uuid references public.documents(id) on delete set null,
  source_name text,
  source_url text,
  source_checked_at date,
  status text not null default 'active' check (status in ('active','inactive','closed','under_review','archived')),
  visibility text not null default 'internal' check (visibility in ('public','internal','private','confidential')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closed_at is null or opened_at is null or closed_at >= opened_at),
  check (consecrated_at is null or dedicated_at is null or consecrated_at >= dedicated_at)
);

create table if not exists public.ecclesial_institutions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.ecclesial_institution_categories(id) on delete restrict,
  primary_entity_id uuid not null references public.ecclesiastical_entities(id) on delete restrict,
  managing_organization_unit_id uuid references public.organization_units(id) on delete set null,
  legacy_entity_id uuid unique references public.ecclesiastical_entities(id) on delete set null,
  country_iso2 char(2) not null references public.country_catalog(iso2) on update cascade on delete restrict,
  name text not null,
  official_name text,
  slug text not null unique,
  description text,
  civil_legal_name text,
  civil_registration_number text,
  founded_at date,
  canonical_erected_at date,
  civil_registered_at date,
  closed_at date,
  province text,
  municipality text,
  sector text,
  address text,
  latitude numeric check (latitude is null or latitude between -90 and 90),
  longitude numeric check (longitude is null or longitude between -180 and 180),
  source_document_id uuid references public.documents(id) on delete set null,
  source_name text,
  source_url text,
  source_checked_at date,
  status text not null default 'active' check (status in ('active','inactive','closed','under_review','archived')),
  visibility text not null default 'internal' check (visibility in ('public','internal','private','confidential')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closed_at is null or founded_at is null or closed_at >= founded_at),
  check (closed_at is null or canonical_erected_at is null or closed_at >= canonical_erected_at)
);

create table if not exists public.ecclesiastical_place_affiliations (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.ecclesiastical_places(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('belongs_to','seat_of','owned_by','administered_by','pastorally_served_by','used_by','located_within')),
  ecclesiastical_entity_id uuid references public.ecclesiastical_entities(id) on delete cascade,
  organization_unit_id uuid references public.organization_units(id) on delete cascade,
  institution_id uuid references public.ecclesial_institutions(id) on delete cascade,
  valid_from date,
  valid_to date,
  is_current boolean not null default true,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  source_document_id uuid references public.documents(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(ecclesiastical_entity_id, organization_unit_id, institution_id) = 1),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create table if not exists public.ecclesial_institution_affiliations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.ecclesial_institutions(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('belongs_to','owned_by','administered_by','pastorally_attached_to','sponsored_by','operated_by','part_of','located_within')),
  ecclesiastical_entity_id uuid references public.ecclesiastical_entities(id) on delete cascade,
  organization_unit_id uuid references public.organization_units(id) on delete cascade,
  parent_institution_id uuid references public.ecclesial_institutions(id) on delete cascade,
  valid_from date,
  valid_to date,
  is_current boolean not null default true,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  source_document_id uuid references public.documents(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(ecclesiastical_entity_id, organization_unit_id, parent_institution_id) = 1),
  check (parent_institution_id is null or parent_institution_id <> institution_id),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create table if not exists public.communication_channels (
  id uuid primary key default gen_random_uuid(),
  channel_type_id uuid not null references public.communication_channel_types(id) on delete restrict,
  owner_entity_id uuid references public.ecclesiastical_entities(id) on delete cascade,
  owner_organization_unit_id uuid references public.organization_units(id) on delete cascade,
  owner_place_id uuid references public.ecclesiastical_places(id) on delete cascade,
  owner_institution_id uuid references public.ecclesial_institutions(id) on delete cascade,
  country_iso2 char(2) not null references public.country_catalog(iso2) on update cascade on delete restrict,
  label text,
  value text not null,
  is_primary boolean not null default false,
  sort_order integer not null default 100,
  verified_at timestamptz,
  source_document_id uuid references public.documents(id) on delete set null,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  visibility text not null default 'public' check (visibility in ('public','internal','private','confidential')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(owner_entity_id, owner_organization_unit_id, owner_place_id, owner_institution_id) = 1),
  check (length(btrim(value)) > 0)
);

create index if not exists ecclesiastical_places_country_status_idx on public.ecclesiastical_places(country_iso2,status,visibility);
create index if not exists ecclesiastical_places_primary_entity_idx on public.ecclesiastical_places(primary_entity_id);
create index if not exists ecclesiastical_places_managing_unit_idx on public.ecclesiastical_places(managing_organization_unit_id);
create index if not exists ecclesial_institutions_country_status_idx on public.ecclesial_institutions(country_iso2,status,visibility);
create index if not exists ecclesial_institutions_primary_entity_idx on public.ecclesial_institutions(primary_entity_id);
create index if not exists ecclesial_institutions_managing_unit_idx on public.ecclesial_institutions(managing_organization_unit_id);
create index if not exists place_affiliations_place_current_idx on public.ecclesiastical_place_affiliations(place_id,is_current,status);
create index if not exists place_affiliations_entity_idx on public.ecclesiastical_place_affiliations(ecclesiastical_entity_id);
create index if not exists place_affiliations_unit_idx on public.ecclesiastical_place_affiliations(organization_unit_id);
create index if not exists place_affiliations_institution_idx on public.ecclesiastical_place_affiliations(institution_id);
create index if not exists institution_affiliations_institution_current_idx on public.ecclesial_institution_affiliations(institution_id,is_current,status);
create index if not exists institution_affiliations_entity_idx on public.ecclesial_institution_affiliations(ecclesiastical_entity_id);
create index if not exists institution_affiliations_unit_idx on public.ecclesial_institution_affiliations(organization_unit_id);
create index if not exists institution_affiliations_parent_idx on public.ecclesial_institution_affiliations(parent_institution_id);
create index if not exists communication_channels_country_status_idx on public.communication_channels(country_iso2,status,visibility);
create index if not exists communication_channels_entity_idx on public.communication_channels(owner_entity_id);
create index if not exists communication_channels_unit_idx on public.communication_channels(owner_organization_unit_id);
create index if not exists communication_channels_place_idx on public.communication_channels(owner_place_id);
create index if not exists communication_channels_institution_idx on public.communication_channels(owner_institution_id);
create unique index if not exists communication_channels_entity_unique_idx on public.communication_channels(owner_entity_id,channel_type_id,value) where owner_entity_id is not null;
create unique index if not exists communication_channels_unit_unique_idx on public.communication_channels(owner_organization_unit_id,channel_type_id,value) where owner_organization_unit_id is not null;
create unique index if not exists communication_channels_place_unique_idx on public.communication_channels(owner_place_id,channel_type_id,value) where owner_place_id is not null;
create unique index if not exists communication_channels_institution_unique_idx on public.communication_channels(owner_institution_id,channel_type_id,value) where owner_institution_id is not null;

create trigger ecclesiastical_place_types_set_updated_at before update on public.ecclesiastical_place_types for each row execute function public.set_updated_at();
create trigger ecclesial_institution_categories_set_updated_at before update on public.ecclesial_institution_categories for each row execute function public.set_updated_at();
create trigger communication_channel_types_set_updated_at before update on public.communication_channel_types for each row execute function public.set_updated_at();
create trigger ecclesiastical_places_set_updated_at before update on public.ecclesiastical_places for each row execute function public.set_updated_at();
create trigger ecclesial_institutions_set_updated_at before update on public.ecclesial_institutions for each row execute function public.set_updated_at();
create trigger ecclesiastical_place_affiliations_set_updated_at before update on public.ecclesiastical_place_affiliations for each row execute function public.set_updated_at();
create trigger ecclesial_institution_affiliations_set_updated_at before update on public.ecclesial_institution_affiliations for each row execute function public.set_updated_at();
create trigger communication_channels_set_updated_at before update on public.communication_channels for each row execute function public.set_updated_at();

insert into public.ecclesiastical_place_types(key,name,description,is_liturgical,allows_dedication,allows_consecration,sort_order)
values
  ('cathedral','Catedral','Iglesia sede de la cátedra del ordinario.',true,true,true,10),
  ('co_cathedral','Concatedral','Iglesia que comparte la función catedralicia.',true,true,true,20),
  ('basilica','Basílica','Templo con título de basílica.',true,true,true,30),
  ('parish_church','Iglesia parroquial','Templo principal de una parroquia.',true,true,true,40),
  ('quasi_parish_church','Iglesia cuasiparroquial','Templo principal de una cuasiparroquia.',true,true,true,50),
  ('sanctuary','Santuario','Lugar sagrado reconocido como santuario.',true,true,true,60),
  ('church','Iglesia','Templo católico sin categoría más específica registrada.',true,true,true,70),
  ('chapel','Capilla','Lugar de culto dependiente o de uso particular.',true,true,false,80),
  ('oratory','Oratorio','Lugar destinado al culto de una comunidad o grupo.',true,true,false,90),
  ('shrine','Ermita','Lugar de culto de menor escala o tradición devocional.',true,true,false,100),
  ('monastery_church','Iglesia monástica','Templo asociado a un monasterio o casa religiosa.',true,true,true,110),
  ('seminary_chapel','Capilla de seminario','Capilla asociada a una institución formativa.',true,true,false,120),
  ('mission_church','Iglesia de misión','Templo o lugar estable de una misión.',true,true,false,130),
  ('other','Otro lugar eclesiástico','Lugar físico eclesiástico no clasificado.',false,false,false,999)
on conflict(key) do update set
  name=excluded.name,
  description=excluded.description,
  is_liturgical=excluded.is_liturgical,
  allows_dedication=excluded.allows_dedication,
  allows_consecration=excluded.allows_consecration,
  sort_order=excluded.sort_order,
  status='active';

insert into public.ecclesial_institution_categories(key,name,description,domain,sort_order)
values
  ('education','Educación','Obras educativas de cualquier nivel.','education',10),
  ('health','Salud','Obras sanitarias y asistenciales.','health',20),
  ('formation','Formación','Instituciones de formación eclesial y pastoral.','formation',30),
  ('consecrated_life','Vida consagrada','Casas e instituciones de vida consagrada.','consecrated_life',40),
  ('charity','Caridad y asistencia','Obras caritativas y de promoción humana.','charity',50),
  ('media','Medios de comunicación','Medios escritos, audiovisuales y digitales.','media',60),
  ('culture','Cultura y patrimonio','Instituciones culturales, bibliotecas, museos y archivos.','culture',70),
  ('social','Obra social','Centros comunitarios y obras sociales.','social',80),
  ('administration','Administración','Instituciones administrativas con personalidad propia.','administration',90),
  ('other','Otra institución','Institución eclesial no clasificada.','other',999)
on conflict(key) do update set name=excluded.name,description=excluded.description,domain=excluded.domain,sort_order=excluded.sort_order,status='active';

insert into public.ecclesial_institution_categories(parent_category_id,key,name,description,domain,sort_order)
select parent.id, child.key, child.name, child.description, child.domain, child.sort_order
from (values
  ('education','school','Escuela o colegio','Centro educativo escolar.','education',11),
  ('education','university','Universidad o instituto superior','Institución de educación superior.','education',12),
  ('education','technical_center','Centro técnico','Centro de formación técnica o profesional.','education',13),
  ('health','hospital','Hospital','Centro hospitalario.','health',21),
  ('health','clinic','Clínica','Centro clínico o médico.','health',22),
  ('health','dispensary','Dispensario','Centro de atención primaria o dispensario.','health',23),
  ('formation','seminary','Seminario','Institución de formación sacerdotal.','formation',31),
  ('formation','pastoral_formation_center','Centro de formación pastoral','Centro de formación pastoral o catequética.','formation',32),
  ('formation','retreat_house','Casa de retiros','Casa destinada a retiros y encuentros.','formation',33),
  ('consecrated_life','religious_house','Casa religiosa','Casa de comunidad religiosa.','consecrated_life',41),
  ('consecrated_life','monastery','Monasterio','Casa monástica.','consecrated_life',42),
  ('consecrated_life','convent','Convento','Casa conventual.','consecrated_life',43),
  ('charity','shelter','Albergue','Obra de acogida o refugio.','charity',51),
  ('charity','food_bank','Banco de alimentos','Obra de asistencia alimentaria.','charity',52),
  ('social','community_center','Centro comunitario','Centro social o comunitario.','social',81),
  ('media','radio','Emisora de radio','Medio radiofónico.','media',61),
  ('media','television','Canal de televisión','Medio televisivo.','media',62),
  ('media','newspaper','Periódico','Medio de prensa escrita.','media',63),
  ('media','magazine','Revista','Publicación periódica.','media',64),
  ('media','digital_media','Medio digital','Portal, plataforma o medio digital.','media',65),
  ('media','publisher','Editorial','Editorial o casa publicadora.','media',66),
  ('culture','library','Biblioteca','Biblioteca eclesial.','culture',71),
  ('culture','museum','Museo','Museo o centro de patrimonio.','culture',72),
  ('culture','archive','Archivo','Archivo histórico o institucional.','culture',73),
  ('other','special_center','Centro especial','Centro vinculado a la Iglesia sin categoría específica.','other',998)
) as child(parent_key,key,name,description,domain,sort_order)
join public.ecclesial_institution_categories parent on parent.key=child.parent_key
on conflict(key) do update set
  parent_category_id=excluded.parent_category_id,
  name=excluded.name,
  description=excluded.description,
  domain=excluded.domain,
  sort_order=excluded.sort_order,
  status='active';

insert into public.communication_channel_types(key,name,description,channel_group,value_kind,sort_order)
values
  ('phone','Teléfono','Número telefónico.','contact','phone',10),
  ('email','Correo electrónico','Dirección de correo electrónico.','contact','email',20),
  ('website','Sitio web','Sitio web oficial.','web','url',30),
  ('facebook','Facebook','Página o perfil oficial en Facebook.','social','url',40),
  ('instagram','Instagram','Perfil oficial en Instagram.','social','url',50),
  ('youtube','YouTube','Canal oficial en YouTube.','social','url',60),
  ('x','X / Twitter','Perfil oficial en X.','social','url',70),
  ('tiktok','TikTok','Perfil oficial en TikTok.','social','url',80),
  ('whatsapp','WhatsApp','Número o enlace oficial de WhatsApp.','messaging','text',90),
  ('telegram','Telegram','Canal o usuario oficial de Telegram.','messaging','text',100),
  ('radio_frequency','Frecuencia de radio','Frecuencia y banda de una emisora.','broadcast','frequency',110),
  ('tv_channel','Canal de televisión','Número, señal o plataforma de televisión.','broadcast','text',120),
  ('podcast','Podcast','Canal o programa de podcast.','broadcast','url',130),
  ('streaming','Transmisión en línea','Canal o URL de streaming.','broadcast','url',140),
  ('print_publication','Publicación impresa','Referencia de periódico, boletín o revista impresa.','publication','text',150),
  ('other','Otro canal','Canal de comunicación no clasificado.','other','text',999)
on conflict(key) do update set
  name=excluded.name,
  description=excluded.description,
  channel_group=excluded.channel_group,
  value_kind=excluded.value_kind,
  sort_order=excluded.sort_order,
  status='active';

insert into public.permissions(key,module,description)
values
  ('places.view','places','Ver lugares eclesiásticos dentro del alcance autorizado.'),
  ('places.create_proposal','places','Crear o proponer lugares eclesiásticos dentro del alcance autorizado.'),
  ('places.update_proposal','places','Editar o proponer cambios de lugares eclesiásticos dentro del alcance autorizado.'),
  ('places.approve','places','Aprobar cambios de lugares eclesiásticos.'),
  ('places.publish','places','Publicar lugares eclesiásticos.'),
  ('institutions.view','institutions','Ver instituciones y obras eclesiales dentro del alcance autorizado.'),
  ('institutions.create_proposal','institutions','Crear o proponer instituciones y obras dentro del alcance autorizado.'),
  ('institutions.update_proposal','institutions','Editar o proponer cambios de instituciones y obras dentro del alcance autorizado.'),
  ('institutions.approve','institutions','Aprobar cambios de instituciones y obras.'),
  ('institutions.publish','institutions','Publicar instituciones y obras.'),
  ('communications.view','communications','Ver canales de comunicación dentro del alcance autorizado.'),
  ('communications.update_proposal','communications','Crear o editar canales de comunicación dentro del alcance autorizado.')
on conflict(key) do update set module=excluded.module,description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select role_row.id, permission_row.id
from public.roles role_row
join public.permissions permission_row on permission_row.key in ('places.view','institutions.view','communications.view')
where role_row.key in ('super_admin','national_admin','diocesan_admin','diocesan_approver','diocesan_editor','pastoral_approver','pastoral_editor','vicariate_editor','zone_editor','parish_editor','internal_viewer')
on conflict do nothing;

insert into public.role_permissions(role_id,permission_id)
select role_row.id, permission_row.id
from public.roles role_row
join public.permissions permission_row on permission_row.key in ('places.create_proposal','places.update_proposal','institutions.create_proposal','institutions.update_proposal','communications.update_proposal')
where role_row.key in ('super_admin','national_admin','diocesan_admin','diocesan_editor','pastoral_editor','vicariate_editor','zone_editor','parish_editor')
on conflict do nothing;

insert into public.role_permissions(role_id,permission_id)
select role_row.id, permission_row.id
from public.roles role_row
join public.permissions permission_row on permission_row.key in ('places.approve','places.publish','institutions.approve','institutions.publish')
where role_row.key in ('super_admin','national_admin','diocesan_admin','diocesan_approver','pastoral_approver')
on conflict do nothing;

insert into public.ecclesiastical_places(
  place_type_id,primary_entity_id,legacy_entity_id,country_iso2,name,official_name,slug,description,
  province,municipality,sector,address,latitude,longitude,source_name,source_url,source_checked_at,
  status,visibility,created_by,created_at,updated_at
)
select place_type.id,
       coalesce((
         select relationship.parent_entity_id
         from public.entity_relationships relationship
         where relationship.child_entity_id=entity.id
           and relationship.is_current=true
           and relationship.status='active'
         order by relationship.created_at desc
         limit 1
       ),app_private.resolve_entity_diocese_id(entity.id),entity.id),
       entity.id,entity.country_iso2,entity.name,entity.official_name,
       case when not exists(select 1 from public.ecclesiastical_places existing where existing.slug=entity.slug)
            then entity.slug else entity.slug||'-place' end,
       entity.description,entity.province,entity.municipality,entity.sector,entity.address,
       entity.latitude,entity.longitude,entity.source_name,entity.source_url,entity.source_checked_at,
       case entity.status when 'active' then 'active' when 'inactive' then 'inactive' when 'under_review' then 'under_review' when 'archived' then 'archived' else 'closed' end,
       entity.visibility,entity.created_by,entity.created_at,entity.updated_at
from public.ecclesiastical_entities entity
join public.entity_types entity_type on entity_type.id=entity.entity_type_id
join public.ecclesiastical_place_types place_type on place_type.key=case when entity_type.key='sanctuary' then 'sanctuary' else 'chapel' end
where entity_type.key in ('chapel','sanctuary')
  and entity.country_iso2 is not null
  and not exists(select 1 from public.ecclesiastical_places existing where existing.legacy_entity_id=entity.id);

insert into public.ecclesial_institutions(
  category_id,primary_entity_id,legacy_entity_id,country_iso2,name,official_name,slug,description,
  province,municipality,sector,address,latitude,longitude,source_name,source_url,source_checked_at,
  status,visibility,created_by,created_at,updated_at
)
select category.id,
       coalesce((
         select relationship.parent_entity_id
         from public.entity_relationships relationship
         where relationship.child_entity_id=entity.id
           and relationship.is_current=true
           and relationship.status='active'
         order by relationship.created_at desc
         limit 1
       ),app_private.resolve_entity_diocese_id(entity.id),entity.id),
       entity.id,entity.country_iso2,entity.name,entity.official_name,
       case when not exists(select 1 from public.ecclesial_institutions existing where existing.slug=entity.slug)
            then entity.slug else entity.slug||'-institution' end,
       entity.description,entity.province,entity.municipality,entity.sector,entity.address,
       entity.latitude,entity.longitude,entity.source_name,entity.source_url,entity.source_checked_at,
       case entity.status when 'active' then 'active' when 'inactive' then 'inactive' when 'under_review' then 'under_review' when 'archived' then 'archived' else 'closed' end,
       entity.visibility,entity.created_by,entity.created_at,entity.updated_at
from public.ecclesiastical_entities entity
join public.entity_types entity_type on entity_type.id=entity.entity_type_id
join public.ecclesial_institution_categories category on category.key=case
  when entity_type.key='seminary' then 'seminary'
  when entity_type.key='religious_house' then 'religious_house'
  else 'special_center'
end
where entity_type.key in ('seminary','religious_house','special_center')
  and entity.country_iso2 is not null
  and not exists(select 1 from public.ecclesial_institutions existing where existing.legacy_entity_id=entity.id);

insert into public.ecclesiastical_place_affiliations(
  place_id,relationship_type,ecclesiastical_entity_id,valid_from,is_current,status,notes,created_by,created_at,updated_at
)
select place.id,
       case when place.is_primary_seat then 'seat_of' else 'belongs_to' end,
       place.primary_entity_id,null,true,'active','Afiliación primaria creada durante la migración canónica de lugares.',place.created_by,place.created_at,place.updated_at
from public.ecclesiastical_places place
where not exists(
  select 1 from public.ecclesiastical_place_affiliations affiliation
  where affiliation.place_id=place.id and affiliation.is_current=true and affiliation.status='active'
);

insert into public.ecclesial_institution_affiliations(
  institution_id,relationship_type,ecclesiastical_entity_id,valid_from,is_current,status,notes,created_by,created_at,updated_at
)
select institution.id,'belongs_to',institution.primary_entity_id,null,true,'active',
       'Afiliación primaria creada durante la migración canónica de instituciones.',
       institution.created_by,institution.created_at,institution.updated_at
from public.ecclesial_institutions institution
where not exists(
  select 1 from public.ecclesial_institution_affiliations affiliation
  where affiliation.institution_id=institution.id and affiliation.is_current=true and affiliation.status='active'
);

insert into public.communication_channels(
  channel_type_id,owner_entity_id,country_iso2,label,value,is_primary,sort_order,status,visibility,created_by,created_at,updated_at
)
select channel_type.id,entity.id,entity.country_iso2,channel_type.name,btrim(source.value),true,channel_type.sort_order,
       case when entity.status='active' then 'active' else 'inactive' end,
       entity.visibility,entity.created_by,entity.created_at,entity.updated_at
from public.ecclesiastical_entities entity
cross join lateral (values
  ('phone',entity.phone),
  ('email',entity.email),
  ('website',entity.website),
  ('facebook',entity.facebook_url),
  ('instagram',entity.instagram_url),
  ('youtube',entity.youtube_url)
) as source(type_key,value)
join public.communication_channel_types channel_type on channel_type.key=source.type_key
where entity.country_iso2 is not null
  and nullif(btrim(source.value),'') is not null
on conflict do nothing;

comment on table public.ecclesiastical_places is 'Lugares físicos eclesiásticos. No sustituyen parroquias, diócesis u otras entidades canónicas.';
comment on column public.ecclesiastical_places.dedicated_at is 'Fecha de dedicación litúrgica del templo o lugar sagrado.';
comment on column public.ecclesiastical_places.consecrated_at is 'Fecha de consagración cuando consta como acto distinto de la dedicación.';
comment on column public.ecclesiastical_places.legacy_entity_id is 'Entidad heredada equivalente, conservada para migración y trazabilidad sin duplicar identidad.';
comment on table public.ecclesial_institutions is 'Instituciones, obras y centros asociados, administrados o patrocinados por la Iglesia.';
comment on table public.communication_channels is 'Canales normalizados de contacto, redes, radiodifusión, publicaciones y medios digitales para cualquier propietario eclesial.';
