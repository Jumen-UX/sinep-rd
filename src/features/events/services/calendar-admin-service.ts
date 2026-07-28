import type { SupabaseClient } from '@supabase/supabase-js'

export type CalendarScopeOption = {
  scope_entity_id: string
  label: string
  entity_type_key: string
  entity_type_name: string
  country_iso2: string
  diocese_id: string | null
  parent_entity_id: string | null
}

export type CalendarEventTypeOption = {
  id: string
  key: string
  name: string
  default_visibility: string
}

export type AdminCalendarEventRow = {
  source_kind: 'occurrence' | 'commemorative'
  event_id: string
  event_type_id: string
  event_type_key: string
  event_type_name: string
  title: string
  event_date: string
  base_date: string | null
  years_count: number | null
  related_person_id: string | null
  related_person_name: string | null
  related_entity_id: string | null
  related_entity_name: string | null
  related_organization_unit_id: string | null
  related_organization_unit_name: string | null
  related_appointment_id: string | null
  visibility: string
  status: string
  is_jubilee: boolean
  jubilee_name: string | null
  matched_scope_entity_id: string
  country_iso2: string
}

export type EventReminderRow = {
  id: string
  event_type_id: string
  event_type_key: string
  event_type_name: string
  scope_type: string
  scope_entity_id: string
  scope_entity_name: string
  diocese_id: string | null
  organization_unit_id: string | null
  organization_unit_name: string | null
  days_before: number
  channel: string
  recipient_role_id: string | null
  recipient_role_name: string | null
  is_active: boolean
  country_iso2: string
  created_at: string
  updated_at: string
}

export type EventVisibilitySettingRow = {
  id: string
  diocese_id: string
  diocese_name: string
  event_type_id: string
  event_type_key: string
  event_type_name: string
  default_visibility: string
  can_be_public: boolean
  requires_approval: boolean
  country_iso2: string
  created_at: string
  updated_at: string
}

export type CalendarGenerationResult = {
  year: number
  scope_entity_id: string
  country_iso2: string
  affected_occurrences: number
  audit_log_id: string
}

export type SaveEventReminderInput = {
  id?: string | null
  scopeEntityId: string
  eventTypeKey: string
  daysBefore: number
  channel: 'internal' | 'email' | 'whatsapp' | 'ical' | 'other'
  isActive: boolean
}

export type SaveVisibilitySettingInput = {
  dioceseId: string
  eventTypeKey: string
  defaultVisibility: 'public' | 'internal' | 'private' | 'confidential'
  canBePublic: boolean
  requiresApproval: boolean
}

function throwIfError(error: { message: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback)
}

export async function loadCalendarScopeOptions(
  supabase: SupabaseClient,
  rootEntityId: string | null = null,
): Promise<CalendarScopeOption[]> {
  const { data, error } = await supabase.rpc('admin_list_calendar_scope_options', {
    p_root_entity_id: rootEntityId,
    p_limit: 2000,
  })

  throwIfError(error, 'No se pudieron cargar los ámbitos del calendario.')
  return (data ?? []) as CalendarScopeOption[]
}

export async function loadCalendarEventTypes(
  supabase: SupabaseClient,
): Promise<CalendarEventTypeOption[]> {
  const { data, error } = await supabase
    .from('event_types')
    .select('id,key,name,default_visibility')
    .eq('status', 'active')
    .order('name')

  throwIfError(error, 'No se pudieron cargar los tipos de evento.')
  return (data ?? []) as CalendarEventTypeOption[]
}

export async function loadAdminCalendarEvents(
  supabase: SupabaseClient,
  filters: {
    from: string
    to: string
    scopeEntityId: string
    eventTypeKey: string | null
    includeNonPublic: boolean
    limit?: number
  },
): Promise<AdminCalendarEventRow[]> {
  const { data, error } = await supabase.rpc('admin_list_calendar_events', {
    p_from: filters.from,
    p_to: filters.to,
    p_scope_entity_id: filters.scopeEntityId,
    p_event_type_key: filters.eventTypeKey,
    p_include_non_public: filters.includeNonPublic,
    p_limit: filters.limit ?? 500,
  })

  throwIfError(error, 'No se pudo cargar el calendario administrativo.')
  return (data ?? []) as AdminCalendarEventRow[]
}

export async function generateCalendarOccurrences(
  supabase: SupabaseClient,
  year: number,
  scopeEntityId: string,
): Promise<CalendarGenerationResult> {
  const { data, error } = await supabase.rpc('admin_generate_calendar_occurrences', {
    p_year: year,
    p_scope_entity_id: scopeEntityId,
  })

  throwIfError(error, 'No se pudieron generar las fechas del calendario.')
  return data as CalendarGenerationResult
}

export async function loadEventReminders(
  supabase: SupabaseClient,
  scopeEntityId: string,
  includeInactive = true,
): Promise<EventReminderRow[]> {
  const { data, error } = await supabase.rpc('admin_list_event_reminders', {
    p_scope_entity_id: scopeEntityId,
    p_include_inactive: includeInactive,
    p_limit: 500,
  })

  throwIfError(error, 'No se pudieron cargar los recordatorios.')
  return (data ?? []) as EventReminderRow[]
}

export async function saveEventReminder(
  supabase: SupabaseClient,
  input: SaveEventReminderInput,
) {
  const { data, error } = await supabase.rpc('admin_save_event_reminder', {
    payload: {
      id: input.id ?? null,
      scope_entity_id: input.scopeEntityId,
      event_type_key: input.eventTypeKey,
      days_before: input.daysBefore,
      channel: input.channel,
      is_active: input.isActive,
    },
  })

  throwIfError(error, 'No se pudo guardar el recordatorio.')
  return data as { id: string; scope_entity_id: string; country_iso2: string; audit_log_id: string }
}

export async function loadEventVisibilitySettings(
  supabase: SupabaseClient,
  scopeEntityId: string,
): Promise<EventVisibilitySettingRow[]> {
  const { data, error } = await supabase.rpc('admin_list_event_visibility_settings', {
    p_scope_entity_id: scopeEntityId,
    p_limit: 500,
  })

  throwIfError(error, 'No se pudieron cargar las reglas de visibilidad.')
  return (data ?? []) as EventVisibilitySettingRow[]
}

export async function saveEventVisibilitySetting(
  supabase: SupabaseClient,
  input: SaveVisibilitySettingInput,
) {
  const { data, error } = await supabase.rpc('admin_save_event_visibility_setting', {
    payload: {
      diocese_id: input.dioceseId,
      event_type_key: input.eventTypeKey,
      default_visibility: input.defaultVisibility,
      can_be_public: input.canBePublic,
      requires_approval: input.requiresApproval,
    },
  })

  throwIfError(error, 'No se pudo guardar la regla de visibilidad.')
  return data as { id: string; diocese_id: string; country_iso2: string; audit_log_id: string }
}
