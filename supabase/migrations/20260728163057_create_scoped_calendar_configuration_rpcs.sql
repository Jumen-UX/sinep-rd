create or replace function app_private.calendar_scope_type_for_entity(p_entity_id uuid)
returns text
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'pg_temp'
as $$
  select case entity_type.key
    when 'country' then 'national'
    when 'ecclesiastical_province' then 'ecclesiastical_province'
    when 'archdiocese' then 'archdiocese'
    when 'diocese' then 'diocese'
    when 'apostolic_vicariate' then 'vicariate'
    when 'vicariate' then 'vicariate'
    when 'pastoral_zone' then 'pastoral_zone'
    when 'zone' then 'pastoral_zone'
    when 'parish' then 'parish'
    when 'quasi_parish' then 'parish'
    when 'chapel' then 'chapel'
    else 'other'
  end
  from public.ecclesiastical_entities entity_row
  join public.entity_types entity_type on entity_type.id = entity_row.entity_type_id
  where entity_row.id = p_entity_id;
$$;

create or replace function app_private.rpc_definer__admin_save_event_reminder(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_actor_id uuid := auth.uid();
  v_reminder_id uuid := app_private.audit_json_uuid(payload, 'id');
  v_scope_entity_id uuid := app_private.audit_json_uuid(payload, 'scope_entity_id');
  v_event_type_id uuid := app_private.audit_json_uuid(payload, 'event_type_id');
  v_event_type_key text := nullif(btrim(payload->>'event_type_key'), '');
  v_organization_unit_id uuid := app_private.audit_json_uuid(payload, 'organization_unit_id');
  v_recipient_role_id uuid := app_private.audit_json_uuid(payload, 'recipient_role_id');
  v_days_before integer := coalesce(nullif(payload->>'days_before','')::integer, 7);
  v_channel text := coalesce(nullif(lower(btrim(payload->>'channel')), ''), 'internal');
  v_is_active boolean := coalesce((payload->>'is_active')::boolean, true);
  v_scope_type text;
  v_scope_country char(2);
  v_unit_entity_id uuid;
  v_diocese_id uuid;
  v_action text;
  v_audit_id uuid;
begin
  if v_actor_id is null
     or not app_private.current_user_has_permission('events.manage_reminders') then
    raise exception 'No autorizado para gestionar recordatorios.' using errcode = '42501';
  end if;

  if v_scope_entity_id is null
     or not app_private.current_user_can_manage_entity('events.manage_reminders', v_scope_entity_id) then
    raise exception 'Debes configurar el recordatorio dentro de una entidad de tu alcance.' using errcode = '42501';
  end if;

  v_scope_country := app_private.resolve_entity_country_iso2(v_scope_entity_id);
  if v_scope_country is null then
    raise exception 'No se pudo resolver el país del recordatorio.' using errcode = '22023';
  end if;

  if v_event_type_id is null and v_event_type_key is not null then
    select event_type.id into v_event_type_id
    from public.event_types event_type
    where event_type.key = v_event_type_key
      and event_type.status = 'active';
  end if;

  if v_event_type_id is null
     or not exists (
       select 1 from public.event_types event_type
       where event_type.id = v_event_type_id and event_type.status = 'active'
     ) then
    raise exception 'El tipo de evento del recordatorio no es válido.' using errcode = '22023';
  end if;

  if v_days_before < 0 or v_days_before > 365 then
    raise exception 'Los días de anticipación deben estar entre 0 y 365.' using errcode = '22023';
  end if;

  if v_channel not in ('internal','email','whatsapp','ical','other') then
    raise exception 'El canal del recordatorio no es válido.' using errcode = '22023';
  end if;

  if v_recipient_role_id is not null
     and not exists (
       select 1 from public.roles role_row
       where role_row.id = v_recipient_role_id and role_row.is_active = true
     ) then
    raise exception 'El rol destinatario no es válido.' using errcode = '22023';
  end if;

  if v_organization_unit_id is not null then
    select unit_row.ecclesiastical_entity_id
    into v_unit_entity_id
    from public.organization_units unit_row
    where unit_row.id = v_organization_unit_id
      and unit_row.status = 'active'
      and unit_row.is_current = true;

    if v_unit_entity_id is null
       or app_private.resolve_entity_country_iso2(v_unit_entity_id) is distinct from v_scope_country
       or not app_private.calendar_entity_in_scope(v_unit_entity_id, v_scope_entity_id)
       or not app_private.current_user_can_manage_entity('events.manage_reminders', v_unit_entity_id) then
      raise exception 'La unidad organizativa del recordatorio está fuera de su entidad o país.' using errcode = '42501';
    end if;
  end if;

  v_scope_type := app_private.calendar_scope_type_for_entity(v_scope_entity_id);
  if v_scope_type is null then
    raise exception 'La entidad del recordatorio no existe.' using errcode = 'P0002';
  end if;

  v_diocese_id := app_private.resolve_entity_diocese_id(v_scope_entity_id);
  if v_diocese_id is null and v_scope_type in ('archdiocese','diocese') then
    v_diocese_id := v_scope_entity_id;
  end if;

  if v_reminder_id is null then
    insert into public.event_reminders(
      event_type_id,scope_type,scope_entity_id,diocese_id,pastoral_area_id,
      days_before,channel,recipient_role_id,is_active,created_by,organization_unit_id
    ) values (
      v_event_type_id,v_scope_type,v_scope_entity_id,v_diocese_id,null,
      v_days_before,v_channel,v_recipient_role_id,v_is_active,v_actor_id,v_organization_unit_id
    ) returning id into v_reminder_id;
    v_action := 'event.reminder.created';
  else
    if not app_private.current_user_can_manage_calendar_record(
      'events.manage_reminders','event_reminders',v_reminder_id
    ) then
      raise exception 'El recordatorio existente está fuera de tu alcance.' using errcode = '42501';
    end if;

    update public.event_reminders
    set event_type_id = v_event_type_id,
        scope_type = v_scope_type,
        scope_entity_id = v_scope_entity_id,
        diocese_id = v_diocese_id,
        pastoral_area_id = null,
        days_before = v_days_before,
        channel = v_channel,
        recipient_role_id = v_recipient_role_id,
        is_active = v_is_active,
        organization_unit_id = v_organization_unit_id,
        updated_at = now()
    where id = v_reminder_id;

    if not found then
      raise exception 'El recordatorio no existe.' using errcode = 'P0002';
    end if;
    v_action := 'event.reminder.updated';
  end if;

  v_audit_id := public.admin_write_audit_log(
    v_action,
    'event_reminders',
    v_reminder_id,
    jsonb_build_object(
      'scope_entity_id',v_scope_entity_id,
      'country_iso2',v_scope_country,
      'event_type_id',v_event_type_id,
      'organization_unit_id',v_organization_unit_id,
      'days_before',v_days_before,
      'channel',v_channel,
      'is_active',v_is_active,
      'canonical_records_modified',true
    )
  );

  return jsonb_build_object(
    'id',v_reminder_id,
    'scope_entity_id',v_scope_entity_id,
    'country_iso2',v_scope_country,
    'audit_log_id',v_audit_id
  );
end;
$$;

create or replace function app_private.rpc_definer__admin_list_event_reminders(
  p_scope_entity_id uuid default null,
  p_include_inactive boolean default false,
  p_limit integer default 500
)
returns table(
  id uuid,
  event_type_id uuid,
  event_type_key text,
  event_type_name text,
  scope_type text,
  scope_entity_id uuid,
  scope_entity_name text,
  diocese_id uuid,
  organization_unit_id uuid,
  organization_unit_name text,
  days_before integer,
  channel text,
  recipient_role_id uuid,
  recipient_role_name text,
  is_active boolean,
  country_iso2 char(2),
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_scope_entity_id uuid := p_scope_entity_id;
  v_limit integer := greatest(1, least(coalesce(p_limit, 500), 2000));
begin
  if auth.uid() is null
     or not app_private.current_user_has_permission('events.view') then
    raise exception 'No autorizado para consultar recordatorios.' using errcode = '42501';
  end if;

  if v_scope_entity_id is null then
    v_scope_entity_id := app_private.current_user_root_jurisdiction_id();
  end if;

  if v_scope_entity_id is null
     or not app_private.current_user_can_manage_entity('events.view', v_scope_entity_id) then
    raise exception 'Debes consultar recordatorios dentro de una entidad de tu alcance.' using errcode = '42501';
  end if;

  return query
  select reminder.id,
         reminder.event_type_id,
         event_type.key,
         event_type.name,
         reminder.scope_type,
         reminder.scope_entity_id,
         scope_entity.name,
         reminder.diocese_id,
         reminder.organization_unit_id,
         unit_row.name,
         reminder.days_before,
         reminder.channel,
         reminder.recipient_role_id,
         role_row.name,
         reminder.is_active,
         app_private.resolve_entity_country_iso2(reminder.scope_entity_id),
         reminder.created_at,
         reminder.updated_at
  from public.event_reminders reminder
  join public.event_types event_type on event_type.id = reminder.event_type_id
  join public.ecclesiastical_entities scope_entity on scope_entity.id = reminder.scope_entity_id
  left join public.organization_units unit_row on unit_row.id = reminder.organization_unit_id
  left join public.roles role_row on role_row.id = reminder.recipient_role_id
  where app_private.calendar_entity_in_scope(reminder.scope_entity_id, v_scope_entity_id)
    and app_private.current_user_can_manage_entity('events.view', reminder.scope_entity_id)
    and (p_include_inactive or reminder.is_active)
  order by event_type.name, scope_entity.name, reminder.days_before, reminder.id
  limit v_limit;
end;
$$;

create or replace function app_private.rpc_definer__admin_save_event_visibility_setting(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_actor_id uuid := auth.uid();
  v_diocese_id uuid := coalesce(
    app_private.audit_json_uuid(payload, 'diocese_id'),
    app_private.audit_json_uuid(payload, 'scope_entity_id')
  );
  v_event_type_id uuid := app_private.audit_json_uuid(payload, 'event_type_id');
  v_event_type_key text := nullif(btrim(payload->>'event_type_key'), '');
  v_default_visibility text := lower(nullif(btrim(payload->>'default_visibility'), ''));
  v_can_be_public boolean := coalesce((payload->>'can_be_public')::boolean, true);
  v_requires_approval boolean := coalesce((payload->>'requires_approval')::boolean, true);
  v_entity_type_key text;
  v_setting_id uuid;
  v_country char(2);
  v_audit_id uuid;
begin
  if v_actor_id is null
     or not app_private.current_user_has_permission('events.manage_visibility') then
    raise exception 'No autorizado para gestionar la visibilidad de eventos.' using errcode = '42501';
  end if;

  if v_diocese_id is null
     or not app_private.current_user_can_manage_entity('events.manage_visibility', v_diocese_id) then
    raise exception 'Debes configurar la visibilidad dentro de una diócesis de tu alcance.' using errcode = '42501';
  end if;

  select entity_type.key
  into v_entity_type_key
  from public.ecclesiastical_entities entity_row
  join public.entity_types entity_type on entity_type.id = entity_row.entity_type_id
  where entity_row.id = v_diocese_id;

  if v_entity_type_key not in ('archdiocese','diocese','apostolic_vicariate') then
    raise exception 'La configuración de visibilidad debe asociarse a una diócesis o jurisdicción equivalente.' using errcode = '22023';
  end if;

  v_country := app_private.resolve_entity_country_iso2(v_diocese_id);
  if v_country is null then
    raise exception 'No se pudo resolver el país de la diócesis.' using errcode = '22023';
  end if;

  if v_event_type_id is null and v_event_type_key is not null then
    select event_type.id into v_event_type_id
    from public.event_types event_type
    where event_type.key = v_event_type_key
      and event_type.status = 'active';
  end if;

  if v_event_type_id is null
     or not exists (
       select 1 from public.event_types event_type
       where event_type.id = v_event_type_id and event_type.status = 'active'
     ) then
    raise exception 'El tipo de evento no es válido.' using errcode = '22023';
  end if;

  if v_default_visibility not in ('public','internal','private','confidential') then
    raise exception 'La visibilidad predeterminada no es válida.' using errcode = '22023';
  end if;

  if not v_can_be_public and v_default_visibility = 'public' then
    raise exception 'Un tipo que no puede ser público no puede tener visibilidad pública predeterminada.' using errcode = '22023';
  end if;

  insert into public.event_visibility_settings(
    diocese_id,event_type_id,default_visibility,can_be_public,requires_approval,created_by
  ) values (
    v_diocese_id,v_event_type_id,v_default_visibility,v_can_be_public,v_requires_approval,v_actor_id
  )
  on conflict (diocese_id,event_type_id)
  do update set
    default_visibility = excluded.default_visibility,
    can_be_public = excluded.can_be_public,
    requires_approval = excluded.requires_approval,
    updated_at = now()
  returning id into v_setting_id;

  v_audit_id := public.admin_write_audit_log(
    'event.visibility_setting.saved',
    'event_visibility_settings',
    v_setting_id,
    jsonb_build_object(
      'scope_entity_id',v_diocese_id,
      'country_iso2',v_country,
      'event_type_id',v_event_type_id,
      'default_visibility',v_default_visibility,
      'can_be_public',v_can_be_public,
      'requires_approval',v_requires_approval,
      'canonical_records_modified',true
    )
  );

  return jsonb_build_object(
    'id',v_setting_id,
    'diocese_id',v_diocese_id,
    'country_iso2',v_country,
    'audit_log_id',v_audit_id
  );
end;
$$;

create or replace function app_private.rpc_definer__admin_list_event_visibility_settings(
  p_scope_entity_id uuid default null,
  p_limit integer default 500
)
returns table(
  id uuid,
  diocese_id uuid,
  diocese_name text,
  event_type_id uuid,
  event_type_key text,
  event_type_name text,
  default_visibility text,
  can_be_public boolean,
  requires_approval boolean,
  country_iso2 char(2),
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_scope_entity_id uuid := p_scope_entity_id;
  v_limit integer := greatest(1, least(coalesce(p_limit, 500), 2000));
begin
  if auth.uid() is null
     or not app_private.current_user_has_permission('events.view') then
    raise exception 'No autorizado para consultar reglas de visibilidad.' using errcode = '42501';
  end if;

  if v_scope_entity_id is null then
    v_scope_entity_id := app_private.current_user_root_jurisdiction_id();
  end if;

  if v_scope_entity_id is null
     or not app_private.current_user_can_manage_entity('events.view', v_scope_entity_id) then
    raise exception 'Debes consultar la visibilidad dentro de una entidad de tu alcance.' using errcode = '42501';
  end if;

  return query
  select setting.id,
         setting.diocese_id,
         diocese.name,
         setting.event_type_id,
         event_type.key,
         event_type.name,
         setting.default_visibility,
         setting.can_be_public,
         setting.requires_approval,
         app_private.resolve_entity_country_iso2(setting.diocese_id),
         setting.created_at,
         setting.updated_at
  from public.event_visibility_settings setting
  join public.ecclesiastical_entities diocese on diocese.id = setting.diocese_id
  join public.event_types event_type on event_type.id = setting.event_type_id
  where app_private.calendar_entity_in_scope(setting.diocese_id, v_scope_entity_id)
    and app_private.current_user_can_manage_entity('events.view', setting.diocese_id)
  order by diocese.name, event_type.name, setting.id
  limit v_limit;
end;
$$;

create or replace function public.admin_save_event_reminder(payload jsonb)
returns jsonb
language sql
security invoker
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select app_private.rpc_definer__admin_save_event_reminder(payload);
$$;

create or replace function public.admin_list_event_reminders(
  p_scope_entity_id uuid default null,
  p_include_inactive boolean default false,
  p_limit integer default 500
)
returns table(
  id uuid,event_type_id uuid,event_type_key text,event_type_name text,scope_type text,
  scope_entity_id uuid,scope_entity_name text,diocese_id uuid,organization_unit_id uuid,
  organization_unit_name text,days_before integer,channel text,recipient_role_id uuid,
  recipient_role_name text,is_active boolean,country_iso2 char(2),created_at timestamptz,updated_at timestamptz
)
language sql
stable
security invoker
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select * from app_private.rpc_definer__admin_list_event_reminders(
    p_scope_entity_id,p_include_inactive,p_limit
  );
$$;

create or replace function public.admin_save_event_visibility_setting(payload jsonb)
returns jsonb
language sql
security invoker
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select app_private.rpc_definer__admin_save_event_visibility_setting(payload);
$$;

create or replace function public.admin_list_event_visibility_settings(
  p_scope_entity_id uuid default null,
  p_limit integer default 500
)
returns table(
  id uuid,diocese_id uuid,diocese_name text,event_type_id uuid,event_type_key text,event_type_name text,
  default_visibility text,can_be_public boolean,requires_approval boolean,country_iso2 char(2),
  created_at timestamptz,updated_at timestamptz
)
language sql
stable
security invoker
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select * from app_private.rpc_definer__admin_list_event_visibility_settings(
    p_scope_entity_id,p_limit
  );
$$;

revoke all on function app_private.calendar_scope_type_for_entity(uuid) from public, anon, authenticated;
revoke all on function app_private.rpc_definer__admin_save_event_reminder(jsonb) from public, anon;
revoke all on function app_private.rpc_definer__admin_list_event_reminders(uuid, boolean, integer) from public, anon;
revoke all on function app_private.rpc_definer__admin_save_event_visibility_setting(jsonb) from public, anon;
revoke all on function app_private.rpc_definer__admin_list_event_visibility_settings(uuid, integer) from public, anon;

grant execute on function app_private.rpc_definer__admin_save_event_reminder(jsonb) to authenticated;
grant execute on function app_private.rpc_definer__admin_list_event_reminders(uuid, boolean, integer) to authenticated;
grant execute on function app_private.rpc_definer__admin_save_event_visibility_setting(jsonb) to authenticated;
grant execute on function app_private.rpc_definer__admin_list_event_visibility_settings(uuid, integer) to authenticated;

revoke all on function public.admin_save_event_reminder(jsonb) from public, anon;
revoke all on function public.admin_list_event_reminders(uuid, boolean, integer) from public, anon;
revoke all on function public.admin_save_event_visibility_setting(jsonb) from public, anon;
revoke all on function public.admin_list_event_visibility_settings(uuid, integer) from public, anon;

grant execute on function public.admin_save_event_reminder(jsonb) to authenticated;
grant execute on function public.admin_list_event_reminders(uuid, boolean, integer) to authenticated;
grant execute on function public.admin_save_event_visibility_setting(jsonb) to authenticated;
grant execute on function public.admin_list_event_visibility_settings(uuid, integer) to authenticated;
