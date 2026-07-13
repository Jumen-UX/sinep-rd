alter table public.canonical_event_participants
  add column if not exists organization_unit_id uuid references public.organization_units(id) on delete restrict;

create index if not exists idx_canonical_event_participants_organization_unit
  on public.canonical_event_participants(organization_unit_id);

alter table public.canonical_event_participants
  drop constraint if exists canonical_event_participant_role_check;

alter table public.canonical_event_participants
  add constraint canonical_event_participant_role_check check (role = any (array[
    'created_entity','suppressed_entity','origin_entity','destination_entity','mother_jurisdiction',
    'new_jurisdiction','metropolitan_see','suffragan_jurisdiction','affected_jurisdiction','authority',
    'ordinary','source_entity','target_entity','created_unit','affected_unit','source_unit','target_unit',
    'parent_before','parent_after'
  ]::text[]));

alter table public.canonical_event_participants
  drop constraint if exists canonical_event_participant_single_target_check;

alter table public.canonical_event_participants
  add constraint canonical_event_participant_single_target_check
  check (num_nonnulls(entity_id,organization_unit_id)=1);

alter table public.canonical_event_actions
  add column if not exists subject_organization_unit_id uuid references public.organization_units(id) on delete restrict;

alter table public.canonical_event_actions
  add column if not exists target_organization_unit_id uuid references public.organization_units(id) on delete restrict;

create index if not exists idx_canonical_event_actions_subject_organization_unit
  on public.canonical_event_actions(subject_organization_unit_id);

create index if not exists idx_canonical_event_actions_target_organization_unit
  on public.canonical_event_actions(target_organization_unit_id);

alter table public.canonical_event_actions
  drop constraint if exists canonical_event_actions_subject_single_kind_check;

alter table public.canonical_event_actions
  add constraint canonical_event_actions_subject_single_kind_check
  check (num_nonnulls(subject_entity_id,subject_organization_unit_id)<=1);

alter table public.canonical_event_actions
  drop constraint if exists canonical_event_actions_target_single_kind_check;

alter table public.canonical_event_actions
  add constraint canonical_event_actions_target_single_kind_check
  check (num_nonnulls(target_entity_id,target_organization_unit_id)<=1);

insert into public.canonical_event_types(key,name,description,applies_to,is_active) values
  ('organization_unit_creation','Creación de unidad organizativa','Crea una unidad dentro de un organigrama funcional aprobado.','organization_unit',true),
  ('organization_unit_reparenting','Cambio de unidad superior','Mueve una unidad organizativa a otra unidad superior del mismo organigrama y ámbito.','organization_unit',true),
  ('organization_unit_status_change','Cambio de estado organizativo','Activa, inactiva o archiva una unidad organizativa preservando su historia.','organization_unit',true),
  ('organization_unit_publication','Publicación de unidad organizativa','Publica o retira de publicación una unidad organizativa.','organization_unit',true),
  ('organization_unit_validity_change','Cambio de vigencia organizativa','Actualiza el período de vigencia de una unidad organizativa.','organization_unit',true)
on conflict(key) do update set
  name=excluded.name,
  description=excluded.description,
  applies_to=excluded.applies_to,
  is_active=excluded.is_active;

insert into public.canonical_event_action_types(
  key,name,description,changes_state,requires_manual_review,sort_order,status,
  auto_apply_allowed,apply_strategy,implementation_phase,apply_preconditions
) values
  ('create_organization_unit','Crear unidad organizativa','Crea la unidad definida en el evento dentro del organigrama y ámbito aprobados.',true,true,110,'active',true,'automatic_safe','organization_units_phase_1',jsonb_build_object('event_status','approved','scope_required',true)),
  ('move_organization_unit','Mover unidad organizativa','Cambia la unidad superior sin mezclar organigramas ni ámbitos eclesiásticos.',true,true,120,'active',true,'automatic_safe','organization_units_phase_1',jsonb_build_object('event_status','approved','cycle_check',true)),
  ('update_organization_unit_status','Actualizar estado organizativo','Actualiza estado e indicador de vigencia de la unidad.',true,true,130,'active',true,'automatic_safe','organization_units_phase_1',jsonb_build_object('event_status','approved')),
  ('publish_organization_unit','Publicar unidad organizativa','Actualiza visibilidad y estado de publicación de la unidad.',true,true,140,'active',true,'automatic_safe','organization_units_phase_1',jsonb_build_object('event_status','approved')),
  ('update_organization_unit_validity','Actualizar vigencia organizativa','Actualiza fechas de inicio y fin de vigencia.',true,true,150,'active',true,'automatic_safe','organization_units_phase_1',jsonb_build_object('event_status','approved','valid_date_range',true))
on conflict(key) do update set
  name=excluded.name,
  description=excluded.description,
  changes_state=excluded.changes_state,
  requires_manual_review=excluded.requires_manual_review,
  sort_order=excluded.sort_order,
  status=excluded.status,
  auto_apply_allowed=excluded.auto_apply_allowed,
  apply_strategy=excluded.apply_strategy,
  implementation_phase=excluded.implementation_phase,
  apply_preconditions=excluded.apply_preconditions,
  updated_at=now();