-- Hardens public views and exposed SECURITY DEFINER entry points reported by
-- Supabase Security Advisor. Privileged implementations remain in app_private,
-- while public wrappers execute as the caller and preserve their existing API.

create or replace view public.public_canonical_institutional_timeline
with (security_barrier = true, security_invoker = true)
as
select
  ce.id as event_id,
  ce.title,
  ce.description,
  cet.key as event_type_key,
  cet.name as event_type_name,
  cet.institutional_family,
  cet.applies_to,
  ce.status as workflow_status,
  ce.load_mode,
  ce.event_date,
  ce.effective_date,
  ce.approved_at,
  ce.applied_at,
  ce.evidence_status,
  ce.verification_status,
  ce.source_name_text as source_name,
  ce.source_url_text as source_url,
  ce.source_checked_at,
  cep.id as participant_id,
  cep.role as participant_role,
  case
    when cep.entity_id is not null then 'entity'
    when cep.organization_unit_id is not null then 'organization_unit'
    else 'unknown'
  end as participant_kind,
  cep.entity_id,
  ee.name as entity_name,
  ee.slug as entity_slug,
  cep.organization_unit_id,
  ou.name as organization_unit_name,
  ou.slug as organization_unit_slug,
  null::jsonb as before_state,
  null::jsonb as after_state,
  coalesce(ce.effective_date, ce.event_date, ce.created_at::date) as timeline_date
from public.canonical_events ce
join public.canonical_event_types cet on cet.id = ce.event_type_id
join public.canonical_event_participants cep on cep.event_id = ce.id
left join public.ecclesiastical_entities ee on ee.id = cep.entity_id
left join public.organization_units ou on ou.id = cep.organization_unit_id
where ce.status = 'applied'
  and (
    (cep.entity_id is not null and ee.visibility = 'public')
    or
    (cep.organization_unit_id is not null and ou.visibility = 'public')
  );

comment on view public.public_canonical_institutional_timeline is
  'Cronología institucional pública con security_invoker. Expone solo eventos aplicados y destinos públicos; los estados administrativos se conservan como NULL por compatibilidad contractual.';

revoke all on public.public_canonical_institutional_timeline from public;
grant select on public.public_canonical_institutional_timeline to anon, authenticated;

create or replace view public.public_entity_evolution_events
with (security_barrier = true, security_invoker = true)
as
select
  ce.id,
  primary_entity.entity_id,
  primary_entity.name as entity_name,
  primary_entity.slug as entity_slug,
  coalesce(ce.notes_json ->> 'legacy_event_type', cet.key) as event_type,
  ce.event_date,
  ce.title,
  ce.description,
  origin_entity.entity_id as from_entity_id,
  origin_entity.name as from_entity_display_name,
  origin_entity.slug as from_entity_slug,
  coalesce(origin_entity.name, ce.notes_json ->> 'legacy_from_entity_name') as from_entity_name,
  destination_entity.entity_id as to_entity_id,
  destination_entity.name as to_entity_display_name,
  destination_entity.slug as to_entity_slug,
  coalesce(destination_entity.name, ce.notes_json ->> 'legacy_to_entity_name') as to_entity_name,
  related_entity.entity_id as related_entity_id,
  related_entity.name as related_entity_display_name,
  related_entity.slug as related_entity_slug,
  coalesce(related_entity.name, ce.notes_json ->> 'legacy_related_entity_name') as related_entity_name,
  ce.notes_json ->> 'territory_summary' as territory_summary,
  ce.notes_json ->> 'canonical_effect' as canonical_effect,
  ce.source_name_text as source_name,
  ce.source_url_text as source_url,
  coalesce(
    ce.source_checked_at,
    nullif(ce.notes_json ->> 'legacy_source_checked_at', '')::date
  ) as source_checked_at,
  coalesce(
    ce.verification_status,
    ce.notes_json ->> 'legacy_verification_status'
  ) as verification_status,
  ce.notes_json ->> 'notes_public' as notes_public
from public.canonical_events ce
join public.canonical_event_types cet on cet.id = ce.event_type_id
left join lateral (
  select cep.entity_id, entity.name, entity.slug
  from public.canonical_event_participants cep
  join public.ecclesiastical_entities entity on entity.id = cep.entity_id
  where cep.event_id = ce.id
    and cep.entity_id is not null
  order by
    case cep.role
      when 'created_entity' then 1
      when 'suppressed_entity' then 1
      when 'affected_jurisdiction' then 1
      when 'primary' then 1
      else 2
    end,
    cep.id
  limit 1
) primary_entity on true
left join lateral (
  select cep.entity_id, entity.name, entity.slug
  from public.canonical_event_participants cep
  join public.ecclesiastical_entities entity on entity.id = cep.entity_id
  where cep.event_id = ce.id
    and cep.role = 'origin_entity'
  order by cep.id
  limit 1
) origin_entity on true
left join lateral (
  select cep.entity_id, entity.name, entity.slug
  from public.canonical_event_participants cep
  join public.ecclesiastical_entities entity on entity.id = cep.entity_id
  where cep.event_id = ce.id
    and cep.role = 'destination_entity'
  order by cep.id
  limit 1
) destination_entity on true
left join lateral (
  select cep.entity_id, entity.name, entity.slug
  from public.canonical_event_participants cep
  join public.ecclesiastical_entities entity on entity.id = cep.entity_id
  where cep.event_id = ce.id
    and cep.role in ('source_entity', 'related_entity')
  order by case cep.role when 'source_entity' then 1 else 2 end, cep.id
  limit 1
) related_entity on true
where ce.status = 'applied'
  and exists (
    select 1
    from public.public_canonical_institutional_timeline timeline
    where timeline.event_id = ce.id
  );

comment on view public.public_entity_evolution_events is
  'Vista heredada con security_invoker, proyectada exclusivamente desde eventos canónicos aplicados y públicos.';

revoke all on public.public_entity_evolution_events from public;
grant select on public.public_entity_evolution_events to anon, authenticated;

-- Public participants must belong to an applied event and a public target.
drop policy if exists canonical_event_participants_select_anon_applied
  on public.canonical_event_participants;
create policy canonical_event_participants_select_anon_public
on public.canonical_event_participants
for select
to anon
using (
  exists (
    select 1
    from public.canonical_events ce
    where ce.id = canonical_event_participants.event_id
      and ce.status = 'applied'
  )
  and (
    (
      canonical_event_participants.entity_id is not null
      and exists (
        select 1
        from public.ecclesiastical_entities ee
        where ee.id = canonical_event_participants.entity_id
          and ee.visibility = 'public'
      )
    )
    or
    (
      canonical_event_participants.organization_unit_id is not null
      and exists (
        select 1
        from public.organization_units ou
        where ou.id = canonical_event_participants.organization_unit_id
          and ou.visibility = 'public'
      )
    )
  )
);

drop policy if exists canonical_event_participants_select_authenticated_visible
  on public.canonical_event_participants;
create policy canonical_event_participants_select_authenticated_visible
on public.canonical_event_participants
for select
to authenticated
using (
  (select internal.current_user_has_admin_role())
  or (
    exists (
      select 1
      from public.canonical_events ce
      where ce.id = canonical_event_participants.event_id
        and ce.status = 'applied'
    )
    and (
      (
        canonical_event_participants.entity_id is not null
        and exists (
          select 1
          from public.ecclesiastical_entities ee
          where ee.id = canonical_event_participants.entity_id
            and ee.visibility = 'public'
        )
      )
      or
      (
        canonical_event_participants.organization_unit_id is not null
        and exists (
          select 1
          from public.organization_units ou
          where ou.id = canonical_event_participants.organization_unit_id
            and ou.visibility = 'public'
        )
      )
    )
  )
);

-- Anonymous callers only need the participant columns projected by public views.
revoke select on public.canonical_event_participants from anon;
grant select (
  id,
  event_id,
  role,
  entity_id,
  organization_unit_id
) on public.canonical_event_participants to anon;

-- Scope-aware implementation lives outside the exposed API schema.
create or replace function app_private.current_user_can_read_entity_descendants(
  p_entity_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
as $function$
  with recursive target_nodes as (
    select
      sn.id,
      sn.template_id,
      sn.diocese_id,
      sn.linked_ecclesiastical_entity_id
    from public.structure_nodes sn
    join public.structure_templates st on st.id = sn.template_id
    where sn.linked_ecclesiastical_entity_id = p_entity_id
      and sn.is_current = true
      and sn.status = 'active'
      and sn.start_date <= current_date
      and (sn.end_date is null or sn.end_date >= current_date)
      and st.status = 'active'
      and st.kind_key = 'territorial'
  ),
  target_lineage as (
    select id, template_id, diocese_id, linked_ecclesiastical_entity_id
    from target_nodes

    union

    select
      parent.id,
      parent.template_id,
      parent.diocese_id,
      parent.linked_ecclesiastical_entity_id
    from target_lineage child
    join public.structure_node_edges edge
      on edge.child_node_id = child.id
     and edge.template_id = child.template_id
     and edge.is_current = true
     and edge.status = 'active'
     and edge.start_date <= current_date
     and (edge.end_date is null or edge.end_date >= current_date)
    join public.structure_nodes parent
      on parent.id = edge.parent_node_id
     and parent.template_id = edge.template_id
     and parent.is_current = true
     and parent.status = 'active'
     and parent.start_date <= current_date
     and (parent.end_date is null or parent.end_date >= current_date)
  ),
  target_context as (
    select coalesce(
      (
        select tn.diocese_id
        from target_nodes tn
        where tn.diocese_id is not null
        limit 1
      ),
      app_private.resolve_entity_diocese_id(p_entity_id)
    ) as diocese_id
  ),
  active_assignments as (
    select ura.*, r.key as role_key
    from public.user_role_assignments ura
    join public.roles r on r.id = ura.role_id
    where ura.user_id = auth.uid()
      and ura.status = 'active'
      and (ura.starts_at is null or ura.starts_at <= current_date)
      and (ura.ends_at is null or ura.ends_at >= current_date)
  )
  select
    current_setting('request.jwt.claim.role', true) = 'service_role'
    or (
      auth.uid() is not null
      and exists (
        select 1
        from public.profiles profile
        where profile.id = auth.uid()
          and profile.status = 'active'
      )
      and exists (
        select 1
        from active_assignments assignment
        cross join target_context context
        where assignment.role_key in ('super_admin', 'national_admin')
          or assignment.scope_type in ('global', 'national')
          or assignment.scope_entity_id is not distinct from p_entity_id
          or assignment.scope_entity_id in (
            select lineage.id
            from target_lineage lineage
          )
          or assignment.scope_entity_id in (
            select lineage.linked_ecclesiastical_entity_id
            from target_lineage lineage
            where lineage.linked_ecclesiastical_entity_id is not null
          )
          or (
            assignment.scope_type = 'diocese'
            and context.diocese_id is not null
            and coalesce(assignment.diocese_id, assignment.scope_entity_id)
              is not distinct from context.diocese_id
          )
      )
    );
$function$;

revoke all on function app_private.current_user_can_read_entity_descendants(uuid)
  from public, anon;
grant execute on function app_private.current_user_can_read_entity_descendants(uuid)
  to authenticated, service_role;

create or replace function app_private.get_entity_descendants(
  p_entity_id uuid,
  p_max_depth integer default 10
)
returns table (
  id uuid,
  name text,
  official_name text,
  slug text,
  entity_type_id uuid,
  depth integer
)
language plpgsql
stable
security definer
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
as $function$
begin
  if p_entity_id is null then
    raise exception 'Debes indicar una entidad raíz' using errcode = '22023';
  end if;

  if not app_private.current_user_can_read_entity_descendants(p_entity_id) then
    raise exception 'No autorizado para consultar descendientes de esta entidad'
      using errcode = '42501';
  end if;

  return query
  with recursive roots as (
    select
      sn.id as node_id,
      sn.template_id,
      0 as node_depth,
      array[sn.id]::uuid[] as path_ids
    from public.structure_nodes sn
    join public.structure_templates st on st.id = sn.template_id
    where sn.linked_ecclesiastical_entity_id = p_entity_id
      and sn.is_current = true
      and sn.status = 'active'
      and sn.start_date <= current_date
      and (sn.end_date is null or sn.end_date >= current_date)
      and st.status = 'active'
      and st.kind_key = 'territorial'
  ),
  descendants as (
    select node_id, template_id, node_depth, path_ids
    from roots

    union all

    select
      child.id,
      edge.template_id,
      parent.node_depth + 1,
      parent.path_ids || child.id
    from descendants parent
    join public.structure_node_edges edge
      on edge.parent_node_id = parent.node_id
     and edge.template_id = parent.template_id
     and edge.is_current = true
     and edge.status = 'active'
     and edge.start_date <= current_date
     and (edge.end_date is null or edge.end_date >= current_date)
    join public.structure_nodes child
      on child.id = edge.child_node_id
     and child.template_id = edge.template_id
     and child.is_current = true
     and child.status = 'active'
     and child.start_date <= current_date
     and (child.end_date is null or child.end_date >= current_date)
    where parent.node_depth < greatest(0, least(coalesce(p_max_depth, 10), 25))
      and not child.id = any(parent.path_ids)
  ),
  ranked as (
    select
      sn.linked_ecclesiastical_entity_id as entity_id,
      min(descendants.node_depth)::integer as entity_depth
    from descendants
    join public.structure_nodes sn on sn.id = descendants.node_id
    where descendants.node_depth > 0
      and sn.linked_ecclesiastical_entity_id is not null
      and sn.linked_ecclesiastical_entity_id <> p_entity_id
    group by sn.linked_ecclesiastical_entity_id
  )
  select
    entity.id,
    entity.name,
    entity.official_name,
    entity.slug,
    entity.entity_type_id,
    ranked.entity_depth
  from ranked
  join public.ecclesiastical_entities entity on entity.id = ranked.entity_id
  where entity.status = 'active'
  order by ranked.entity_depth, entity.name;
end;
$function$;

revoke all on function app_private.get_entity_descendants(uuid, integer)
  from public, anon;
grant execute on function app_private.get_entity_descendants(uuid, integer)
  to authenticated, service_role;

create or replace function public.get_entity_descendants(
  p_entity_id uuid,
  p_max_depth integer default 10
)
returns table (
  id uuid,
  name text,
  official_name text,
  slug text,
  entity_type_id uuid,
  depth integer
)
language sql
stable
security invoker
set search_path to 'public', 'app_private', 'pg_temp'
as $function$
  select *
  from app_private.get_entity_descendants(p_entity_id, p_max_depth);
$function$;

revoke all on function public.get_entity_descendants(uuid, integer)
  from public, anon;
grant execute on function public.get_entity_descendants(uuid, integer)
  to authenticated, service_role;

comment on function public.get_entity_descendants(uuid, integer) is
  'Public SECURITY INVOKER wrapper for the scope-checked implementation in app_private.';

-- Convert exposed wrappers to SECURITY INVOKER. The privileged implementations
-- stay in app_private, are not exposed by PostgREST, and retain their own checks.
grant execute on function app_private.admin_list_user_onboarding_progress()
  to authenticated, service_role;
grant execute on function app_private.get_my_admin_entry_context()
  to authenticated, service_role;
grant execute on function app_private.get_my_onboarding_context()
  to authenticated, service_role;
grant execute on function app_private.save_my_onboarding(jsonb)
  to authenticated, service_role;
grant execute on function app_private.validate_admin_role_scope(jsonb)
  to authenticated, service_role;

revoke execute on function app_private.admin_list_user_onboarding_progress()
  from public, anon;
revoke execute on function app_private.get_my_admin_entry_context()
  from public, anon;
revoke execute on function app_private.get_my_onboarding_context()
  from public, anon;
revoke execute on function app_private.save_my_onboarding(jsonb)
  from public, anon;
revoke execute on function app_private.validate_admin_role_scope(jsonb)
  from public, anon;

create or replace function public.admin_list_user_onboarding_progress()
returns jsonb
language sql
stable
security invoker
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
as $function$
  select app_private.admin_list_user_onboarding_progress();
$function$;

create or replace function public.get_my_admin_entry_context()
returns jsonb
language sql
stable
security invoker
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
as $function$
  select app_private.get_my_admin_entry_context();
$function$;

create or replace function public.get_my_onboarding_context()
returns jsonb
language sql
stable
security invoker
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
as $function$
  select app_private.get_my_onboarding_context();
$function$;

create or replace function public.save_my_onboarding(payload jsonb)
returns jsonb
language sql
security invoker
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
as $function$
  select app_private.save_my_onboarding(payload);
$function$;

create or replace function public.validate_admin_role_scope(payload jsonb)
returns jsonb
language sql
stable
security invoker
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
as $function$
  select app_private.validate_admin_role_scope(payload);
$function$;

revoke all on function public.admin_list_user_onboarding_progress()
  from public, anon;
revoke all on function public.get_my_admin_entry_context()
  from public, anon;
revoke all on function public.get_my_onboarding_context()
  from public, anon;
revoke all on function public.save_my_onboarding(jsonb)
  from public, anon;
revoke all on function public.validate_admin_role_scope(jsonb)
  from public, anon;

grant execute on function public.admin_list_user_onboarding_progress()
  to authenticated, service_role;
grant execute on function public.get_my_admin_entry_context()
  to authenticated, service_role;
grant execute on function public.get_my_onboarding_context()
  to authenticated, service_role;
grant execute on function public.save_my_onboarding(jsonb)
  to authenticated, service_role;
grant execute on function public.validate_admin_role_scope(jsonb)
  to authenticated, service_role;