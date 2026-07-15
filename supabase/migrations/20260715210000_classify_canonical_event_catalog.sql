-- Clasifica el catálogo de eventos sin renombrar claves históricas ni alterar eventos existentes.

alter table public.canonical_event_types
  add column if not exists institutional_family text,
  add column if not exists canonical_target text,
  add column if not exists application_strategy text,
  add column if not exists requires_manual_review boolean not null default true,
  add column if not exists is_compensable boolean not null default true;

update public.canonical_event_types
set
  institutional_family = case key
    when 'erection' then 'creation'
    when 'restoration' then 'creation'
    when 'organization_unit_creation' then 'creation'
    when 'division' then 'division'
    when 'dismemberment' then 'dismemberment'
    when 'union' then 'merger'
    when 'see_transfer' then 'transfer'
    when 'metropolitan_change' then 'transfer'
    when 'province_change' then 'dependency_change'
    when 'organization_unit_reparenting' then 'dependency_change'
    when 'suppression' then 'suppression'
    when 'category_change' then 'identity_change'
    when 'elevation' then 'identity_change'
    when 'name_change' then 'identity_change'
    when 'boundary_change' then 'boundary_change'
    when 'organization_unit_status_change' then 'lifecycle_change'
    when 'organization_unit_validity_change' then 'lifecycle_change'
    when 'organization_unit_publication' then 'publication_change'
    else institutional_family
  end,
  canonical_target = case
    when applies_to = 'organization_unit' then 'organization_unit'
    when key in ('province_change', 'metropolitan_change', 'boundary_change') then 'relationship'
    else 'entity'
  end,
  application_strategy = case
    when applies_to = 'organization_unit' then 'organization_unit_mutation'
    when key in ('province_change', 'metropolitan_change', 'boundary_change') then 'relationship_mutation'
    else 'entity_mutation'
  end,
  requires_manual_review = true,
  is_compensable = true
where is_active = true;

alter table public.canonical_event_types
  drop constraint if exists canonical_event_types_institutional_family_check,
  add constraint canonical_event_types_institutional_family_check
    check (institutional_family is null or institutional_family in (
      'creation',
      'division',
      'merger',
      'dismemberment',
      'transfer',
      'suppression',
      'dependency_change',
      'identity_change',
      'boundary_change',
      'lifecycle_change',
      'publication_change'
    )),
  drop constraint if exists canonical_event_types_canonical_target_check,
  add constraint canonical_event_types_canonical_target_check
    check (canonical_target is null or canonical_target in ('entity', 'relationship', 'organization_unit')),
  drop constraint if exists canonical_event_types_application_strategy_check,
  add constraint canonical_event_types_application_strategy_check
    check (application_strategy is null or application_strategy in (
      'entity_mutation',
      'relationship_mutation',
      'organization_unit_mutation'
    ));

alter table public.canonical_event_types
  alter column institutional_family set not null,
  alter column canonical_target set not null,
  alter column application_strategy set not null;

comment on column public.canonical_event_types.institutional_family is
  'Familia institucional canónica. No sustituye la clave histórica del tipo de evento.';
comment on column public.canonical_event_types.canonical_target is
  'Destino canónico del cambio: entidad, relación o unidad organizativa.';
comment on column public.canonical_event_types.application_strategy is
  'Estrategia general de aplicación; el plan de acciones conserva el detalle operativo.';
comment on column public.canonical_event_types.requires_manual_review is
  'Indica que el evento requiere revisión humana antes de aprobarse o aplicarse.';
comment on column public.canonical_event_types.is_compensable is
  'Indica que una corrección debe modelarse mediante un evento compensatorio.';
