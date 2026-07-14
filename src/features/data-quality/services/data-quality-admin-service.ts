import type { SupabaseClient } from '@supabase/supabase-js'

export type StructureAlert = {
  node_id: string
  template_name: string | null
  kind_key: string | null
  level_name: string | null
  level_key: string | null
  diocese_name: string | null
  entity_id: string
  entity_name: string
  entity_slug: string | null
  entity_type_name: string | null
  municipality: string | null
  province: string | null
  responsible_office_name: string | null
  responsible_office_key: string | null
  responsible_count: number
  responsible_names: string | null
  has_registered_vacancy: boolean
  alert_status: 'vacante_registrada' | 'posible_vacancia' | 'con_responsable'
  alert_label: string
}

export type JurisdictionAlert = {
  jurisdiction_id: string
  jurisdiction_name: string
  jurisdiction_slug: string | null
  entity_type_name: string | null
  entity_type_key: string | null
  municipality: string | null
  province: string | null
  titular_count: number
  titular_names: string | null
  has_registered_vacancy: boolean
  alert_status: 'sede_vacante_registrada' | 'posible_sede_vacante' | 'con_obispo_titular'
  alert_label: string
}

export type CompletenessRow = {
  id: string
  name: string
  slug: string
  entity_type_name?: string | null
  entity_type_key?: string | null
  person_type?: string | null
  required_count: number
  missing_count: number
  missing_fields: string[] | null
  completion_percent: number
}

export type DataQualityTargetKind = 'ecclesiastical_entities' | 'persons'

export type DataFieldStatus = {
  record_table: string
  record_id: string
  status: string
}

export type DataQualitySnapshot = {
  entities: CompletenessRow[]
  persons: CompletenessRow[]
  fieldStatuses: DataFieldStatus[]
}

export type SaveDataFieldStatusInput = {
  recordTable: DataQualityTargetKind
  recordId: string
  fieldName: string
  status: 'unknown' | 'not_applicable'
  notes: string | null
  userId: string | null
}

function throwIfError(error: { message: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback)
}

export async function getAuthenticatedUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser()
  throwIfError(error, 'No se pudo comprobar la sesión administrativa.')
  return data.user?.id ?? null
}

export async function loadStructureResponsibilityAlerts(
  supabase: SupabaseClient,
): Promise<StructureAlert[]> {
  const { data, error } = await supabase
    .from('admin_structure_responsibility_alerts')
    .select('node_id,template_name,kind_key,level_name,level_key,diocese_name,entity_id,entity_name,entity_slug,entity_type_name,municipality,province,responsible_office_name,responsible_office_key,responsible_count,responsible_names,has_registered_vacancy,alert_status,alert_label')
    .order('alert_status', { ascending: false })
    .order('diocese_name')
    .order('level_name')
    .order('entity_name')

  throwIfError(error, 'No se pudieron cargar las alertas de responsabilidad estructural.')
  return (data ?? []) as StructureAlert[]
}

export async function loadJurisdictionBishopAlerts(
  supabase: SupabaseClient,
): Promise<JurisdictionAlert[]> {
  const { data, error } = await supabase
    .from('admin_jurisdiction_bishop_alerts')
    .select('jurisdiction_id,jurisdiction_name,jurisdiction_slug,entity_type_name,entity_type_key,municipality,province,titular_count,titular_names,has_registered_vacancy,alert_status,alert_label')
    .order('alert_status', { ascending: false })
    .order('jurisdiction_name')

  throwIfError(error, 'No se pudieron cargar las alertas de jurisdicciones.')
  return (data ?? []) as JurisdictionAlert[]
}

export async function loadRecordCompleteness(
  supabase: SupabaseClient,
): Promise<DataQualitySnapshot> {
  const [entityResult, personResult, fieldStatusResult] = await Promise.all([
    supabase.from('admin_entity_completeness').select('*').order('completion_percent', { ascending: true }).limit(500),
    supabase.from('admin_person_completeness').select('*').order('completion_percent', { ascending: true }).limit(500),
    supabase.from('data_field_statuses').select('record_table,record_id,status').in('status', ['unknown', 'not_applicable']),
  ])

  throwIfError(entityResult.error, 'No se pudo cargar la completitud de entidades.')
  throwIfError(personResult.error, 'No se pudo cargar la completitud de personas.')
  throwIfError(fieldStatusResult.error, 'No se pudieron cargar las excepciones de calidad de datos.')

  return {
    entities: (entityResult.data ?? []) as CompletenessRow[],
    persons: (personResult.data ?? []) as CompletenessRow[],
    fieldStatuses: (fieldStatusResult.data ?? []) as DataFieldStatus[],
  }
}

export async function saveDataFieldStatus(
  supabase: SupabaseClient,
  input: SaveDataFieldStatusInput,
): Promise<void> {
  const { error } = await supabase.from('data_field_statuses').upsert({
    record_table: input.recordTable,
    record_id: input.recordId,
    field_name: input.fieldName,
    status: input.status,
    notes: input.notes,
    created_by: input.userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'record_table,record_id,field_name' })

  throwIfError(error, 'No se pudo guardar el estado del dato.')
}
