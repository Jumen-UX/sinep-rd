import type { SupabaseClient } from '@supabase/supabase-js'
import { createCsv, downloadCsv } from '@/lib/csv'

export type AdministrativeDocumentRow = {
  id: string
  title: string
  document_type: string
  document_number: string | null
  issuing_authority: string | null
  document_date: string | null
  file_path: string | null
  external_url: string | null
  mime_type: string | null
  file_size_bytes: number | null
  description: string | null
  visibility: string
  status: string
  related_person_id: string | null
  related_entity_id: string | null
  related_organization_unit_id: string | null
  related_appointment_id: string | null
  related_movement_id: string | null
  matched_scope_entity_id: string | null
  country_iso2: string | null
  created_at: string
  updated_at: string
}

export type DocumentFilters = {
  scopeId: string | null
  search: string | null
  visibility: string | null
  includeInactive?: boolean
  limit?: number
}

export async function loadAdministrativeDocuments(
  supabase: SupabaseClient,
  filters: DocumentFilters,
): Promise<AdministrativeDocumentRow[]> {
  const { data, error } = await supabase.rpc('admin_list_documents', {
    p_scope_entity_id: filters.scopeId,
    p_search: filters.search,
    p_visibility: filters.visibility,
    p_include_inactive: filters.includeInactive ?? false,
    p_limit: filters.limit ?? 500,
  })

  if (error) throw new Error(error.message)
  return (data ?? []) as AdministrativeDocumentRow[]
}

export function createDocumentsCsv(rows: readonly AdministrativeDocumentRow[]) {
  return createCsv(
    [
      'Título',
      'Tipo',
      'Número',
      'Autoridad emisora',
      'Fecha',
      'Visibilidad',
      'Estado',
      'País',
      'Entidad de alcance',
      'Persona relacionada',
      'Unidad relacionada',
      'Nombramiento relacionado',
      'Movimiento relacionado',
      'URL externa',
      'Ruta interna',
      'Descripción',
    ],
    rows.map((row) => [
      row.title,
      row.document_type,
      row.document_number,
      row.issuing_authority,
      row.document_date,
      row.visibility,
      row.status,
      row.country_iso2,
      row.matched_scope_entity_id,
      row.related_person_id,
      row.related_organization_unit_id,
      row.related_appointment_id,
      row.related_movement_id,
      row.external_url,
      row.file_path,
      row.description,
    ]),
  )
}

export function downloadDocumentsCsv(rows: readonly AdministrativeDocumentRow[]) {
  const date = new Date().toISOString().slice(0, 10)
  downloadCsv(`documentos-administrativos-${date}.csv`, createDocumentsCsv(rows))
}
