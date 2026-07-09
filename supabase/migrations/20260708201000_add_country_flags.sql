create table if not exists public.countries (
  id uuid primary key default gen_random_uuid(),
  iso2 char(2) not null unique,
  iso3 char(3) unique,
  name text not null,
  official_name text,
  flag_emoji text,
  flag_image_url text,
  flag_alt text,
  status text not null default 'active' check (status in ('active','inactive')),
  visibility text not null default 'public' check (visibility in ('public','private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.countries is 'Catálogo ISO de países usados por SINEP RD, incluyendo bandera pública.';
comment on column public.countries.iso2 is 'Código ISO 3166-1 alpha-2.';
comment on column public.countries.iso3 is 'Código ISO 3166-1 alpha-3.';
comment on column public.countries.flag_emoji is 'Bandera como emoji Unicode, usada por defecto en la vista pública.';
comment on column public.countries.flag_image_url is 'URL pública opcional para bandera personalizada o archivo optimizado.';
comment on column public.countries.flag_alt is 'Texto alternativo accesible para la bandera.';

insert into public.countries (iso2, iso3, name, official_name, flag_emoji, flag_alt, status, visibility)
values ('DO', 'DOM', 'República Dominicana', 'República Dominicana', '🇩🇴', 'Bandera de República Dominicana', 'active', 'public')
on conflict (iso2) do update set
  iso3 = excluded.iso3,
  name = excluded.name,
  official_name = excluded.official_name,
  flag_emoji = excluded.flag_emoji,
  flag_alt = excluded.flag_alt,
  status = excluded.status,
  visibility = excluded.visibility,
  updated_at = now();

create or replace view public.public_countries as
select
  id,
  iso2 as key,
  iso2,
  iso3,
  name,
  official_name,
  flag_emoji,
  flag_image_url,
  coalesce(flag_alt, 'Bandera de ' || name) as flag_alt
from public.countries
where status = 'active' and visibility = 'public'
order by name;
