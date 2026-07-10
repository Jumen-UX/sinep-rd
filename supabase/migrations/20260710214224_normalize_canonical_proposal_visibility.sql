create or replace function public.admin_create_person_change_proposal(
  p_person_id uuid,
  p_proposed_data jsonb,
  p_description text default null
)
returns jsonb
language sql
security definer
set search_path = public, app_private, pg_temp
as $$
  select app_private.admin_create_person_change_proposal(
    p_person_id,
    case
      when coalesce(p_proposed_data ->> 'schema_version', '') = '2'
        or p_proposed_data ->> 'proposal_kind' = 'canonical_person'
      then p_proposed_data
        || jsonb_build_object(
          'legacy_profile',
          jsonb_strip_nulls(jsonb_build_object(
            'priest_type', nullif(p_proposed_data #>> '{legacy_profile,priest_type}', ''),
            'deacon_type', nullif(p_proposed_data #>> '{legacy_profile,deacon_type}', '')
          ))
        )
        || jsonb_build_object(
          'ordinations',
          coalesce((
            select jsonb_agg(
              case
                when item.value ->> 'mode' = 'set'
                then item.value || jsonb_build_object(
                  'visibility',
                  coalesce(
                    existing.visibility,
                    nullif(item.value ->> 'visibility', ''),
                    'internal'
                  )
                )
                else item.value
              end
              order by item.ordinality
            )
            from jsonb_array_elements(coalesce(p_proposed_data -> 'ordinations', '[]'::jsonb))
              with ordinality as item(value, ordinality)
            left join public.ordination_events existing
              on existing.person_id = p_person_id
             and existing.degree = item.value ->> 'degree'
             and existing.record_status = 'active'
          ), '[]'::jsonb)
        )
      else p_proposed_data
    end,
    p_description
  );
$$;

revoke all on function public.admin_create_person_change_proposal(uuid, jsonb, text) from public, anon;
grant execute on function public.admin_create_person_change_proposal(uuid, jsonb, text) to authenticated;

comment on function public.admin_create_person_change_proposal(uuid, jsonb, text)
  is 'Entrada pública autenticada para propuestas de persona. Normaliza campos auxiliares vacíos y conserva la visibilidad de ordenaciones existentes.';
