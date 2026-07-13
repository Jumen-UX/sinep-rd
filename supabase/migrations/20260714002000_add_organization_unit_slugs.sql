alter table public.organization_units
  add column if not exists slug text;

update public.organization_units
set slug = key
where slug is null or btrim(slug) = '';

alter table public.organization_units
  alter column slug set not null;

create unique index if not exists organization_units_slug_unique_idx
  on public.organization_units(slug);

comment on column public.organization_units.slug is
  'Identificador público estable para rutas y enlaces de la unidad organizativa.';
