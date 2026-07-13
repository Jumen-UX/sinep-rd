-- Move exposed SECURITY DEFINER RPC implementations behind SECURITY INVOKER gateways.
-- This preserves the public RPC signatures while removing elevated execution
-- from the PostgREST-exposed public schema.

do $migration$
declare
  v_function record;
  v_private_name text;
  v_call_args text;
  v_body text;
  v_processed integer := 0;
begin
  for v_function in
    select
      p.oid,
      p.proname,
      pg_get_function_identity_arguments(p.oid) as identity_args,
      pg_get_function_arguments(p.oid) as function_args,
      pg_get_function_result(p.oid) as function_result,
      p.pronargs,
      p.proargnames,
      p.proretset,
      p.provolatile,
      p.proparallel,
      obj_description(p.oid, 'pg_proc') as function_comment
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname = any(array[
        'admin_assign_user_role',
        'admin_configure_event_action',
        'admin_configure_structural_event_action',
        'admin_create_event_draft',
        'admin_create_person_change_proposal',
        'admin_create_structural_evolution_event_draft',
        'admin_end_user_role',
        'admin_generate_event_action_plan',
        'admin_generate_structural_application_plan',
        'admin_get_change_request_detail',
        'admin_imported_appointment_review_summary',
        'admin_list_imported_appointment_review',
        'admin_mark_person_deceased',
        'admin_prepare_import_batch',
        'admin_review_event',
        'admin_review_import_batch',
        'admin_review_item',
        'admin_review_person_change_request',
        'admin_review_queue',
        'admin_review_structural_evolution_event',
        'admin_save_canonical_person',
        'admin_save_ecclesiastical_entity',
        'admin_save_jurisdiction',
        'admin_save_office_configuration',
        'admin_save_position_assignment',
        'admin_save_structure_level',
        'admin_save_structure_node',
        'admin_save_structure_template',
        'admin_update_event_action',
        'admin_update_import_batch_row',
        'admin_update_office_configuration',
        'admin_update_structural_event_action',
        'admin_update_user_profile_status',
        'admin_write_audit_log',
        'editor_suggest_office_configuration',
        'enable_country_from_catalog',
        'get_structure_node_detail',
        'resolve_assignment_canonical_incompatibility'
      ]::text[])
    order by p.proname, pg_get_function_identity_arguments(p.oid)
  loop
    v_private_name := 'rpc_definer__' || v_function.proname;

    if exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'app_private'
        and p.proname = v_private_name
        and pg_get_function_identity_arguments(p.oid) = v_function.identity_args
    ) then
      raise exception 'Private RPC gateway already exists: app_private.%(%)',
        v_private_name, v_function.identity_args;
    end if;

    select coalesce(
      string_agg(format('%I', v_function.proargnames[i]), ', ' order by i),
      ''
    )
    into v_call_args
    from generate_series(1, v_function.pronargs) as i;

    execute format(
      'alter function public.%I(%s) rename to %I',
      v_function.proname,
      v_function.identity_args,
      v_private_name
    );

    execute format(
      'alter function public.%I(%s) set schema app_private',
      v_private_name,
      v_function.identity_args
    );

    execute format(
      'revoke all on function app_private.%I(%s) from public, anon',
      v_private_name,
      v_function.identity_args
    );

    execute format(
      'grant execute on function app_private.%I(%s) to authenticated, service_role',
      v_private_name,
      v_function.identity_args
    );

    v_body := case
      when v_function.proretset then
        format('select * from app_private.%I(%s)', v_private_name, v_call_args)
      else
        format('select app_private.%I(%s)', v_private_name, v_call_args)
    end;

    execute format(
      'create function public.%I(%s) returns %s language sql %s %s security invoker set search_path to pg_catalog, public, app_private, auth, pg_temp as %L',
      v_function.proname,
      v_function.function_args,
      v_function.function_result,
      case v_function.provolatile
        when 'i' then 'immutable'
        when 's' then 'stable'
        else 'volatile'
      end,
      case v_function.proparallel
        when 's' then 'parallel safe'
        when 'r' then 'parallel restricted'
        else 'parallel unsafe'
      end,
      v_body
    );

    execute format(
      'revoke all on function public.%I(%s) from public, anon',
      v_function.proname,
      v_function.identity_args
    );

    execute format(
      'grant execute on function public.%I(%s) to authenticated, service_role',
      v_function.proname,
      v_function.identity_args
    );

    if v_function.function_comment is not null then
      execute format(
        'comment on function public.%I(%s) is %L',
        v_function.proname,
        v_function.identity_args,
        v_function.function_comment
      );
    end if;

    v_processed := v_processed + 1;
  end loop;

  if v_processed <> 38 then
    raise exception 'Expected to convert 38 exposed SECURITY DEFINER RPCs, converted %', v_processed;
  end if;
end;
$migration$;

-- Relocate unaccent out of public while preserving existing public calls
-- through SECURITY INVOKER compatibility wrappers.
alter extension unaccent set schema extensions;

create function public.unaccent(p_text text)
returns text
language sql
stable
parallel safe
strict
security invoker
set search_path to pg_catalog, extensions
as $function$
  select extensions.unaccent(p_text);
$function$;

create function public.unaccent(p_dictionary regdictionary, p_text text)
returns text
language sql
stable
parallel safe
strict
security invoker
set search_path to pg_catalog, extensions
as $function$
  select extensions.unaccent(p_dictionary, p_text);
$function$;

revoke all on function public.unaccent(text) from public;
revoke all on function public.unaccent(regdictionary, text) from public;
grant execute on function public.unaccent(text) to anon, authenticated, service_role;
grant execute on function public.unaccent(regdictionary, text) to anon, authenticated, service_role;

comment on function public.unaccent(text)
  is 'Compatibility wrapper for extensions.unaccent(text).';
comment on function public.unaccent(regdictionary, text)
  is 'Compatibility wrapper for extensions.unaccent(regdictionary, text).';

do $verification$
declare
  v_remaining integer;
begin
  select count(*)
  into v_remaining
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('authenticated', p.oid, 'execute')
    and p.proname = any(array[
      'admin_assign_user_role',
      'admin_configure_event_action',
      'admin_configure_structural_event_action',
      'admin_create_event_draft',
      'admin_create_person_change_proposal',
      'admin_create_structural_evolution_event_draft',
      'admin_end_user_role',
      'admin_generate_event_action_plan',
      'admin_generate_structural_application_plan',
      'admin_get_change_request_detail',
      'admin_imported_appointment_review_summary',
      'admin_list_imported_appointment_review',
      'admin_mark_person_deceased',
      'admin_prepare_import_batch',
      'admin_review_event',
      'admin_review_import_batch',
      'admin_review_item',
      'admin_review_person_change_request',
      'admin_review_queue',
      'admin_review_structural_evolution_event',
      'admin_save_canonical_person',
      'admin_save_ecclesiastical_entity',
      'admin_save_jurisdiction',
      'admin_save_office_configuration',
      'admin_save_position_assignment',
      'admin_save_structure_level',
      'admin_save_structure_node',
      'admin_save_structure_template',
      'admin_update_event_action',
      'admin_update_import_batch_row',
      'admin_update_office_configuration',
      'admin_update_structural_event_action',
      'admin_update_user_profile_status',
      'admin_write_audit_log',
      'editor_suggest_office_configuration',
      'enable_country_from_catalog',
      'get_structure_node_detail',
      'resolve_assignment_canonical_incompatibility'
    ]::text[]);

  if v_remaining <> 0 then
    raise exception 'Security hardening incomplete: % public SECURITY DEFINER RPCs remain executable by authenticated',
      v_remaining;
  end if;

  if exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'unaccent'
      and n.nspname = 'public'
  ) then
    raise exception 'unaccent extension still installed in public';
  end if;
end;
$verification$;

notify pgrst, 'reload schema';
