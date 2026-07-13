'use client'

import { createClient } from '@/lib/supabase/client'
import type { SearchableSelectOption } from '@/components/admin/SearchableSelect'
import type { ImportReferenceType } from '@/features/importaciones/domain/import-row-field-contract'

type CatalogRow = Record<string, unknown>

const cache = new Map<ImportReferenceType, Promise<SearchableSelectOption[]>>()

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function uniqueSorted(options: SearchableSelectOption[]) {
  const unique = new Map<string, SearchableSelectOption>()
  options.forEach((option) => {
    if (option.value && !unique.has(option.value)) unique.set(option.value, option)
  })
  return Array.from(unique.values()).sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

async function loadPeople(): Promise<SearchableSelectOption[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('persons')
    .select('id,display_name,person_type,status')
    .eq('status', 'active')
    .order('display_name')
    .limit(500)

  if (error) throw error
  return uniqueSorted(((data ?? []) as CatalogRow[]).map((row) => ({
    value: text(row.display_name),
    label: text(row.display_name),
    description: [text(row.person_type), text(row.id)].filter(Boolean).join(' · '),
  })))
}

async function loadEntities(): Promise<SearchableSelectOption[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('ecclesiastical_entities')
    .select('id,name,official_name,status')
    .eq('status', 'active')
    .order('name')
    .limit(1000)

  if (error) throw error
  return uniqueSorted(((data ?? []) as CatalogRow[]).map((row) => ({
    value: text(row.name),
    label: text(row.name),
    description: [text(row.official_name), text(row.id)].filter(Boolean).join(' · '),
  })))
}

async function loadOffices(): Promise<SearchableSelectOption[]> {
  const supabase = createClient()
  const canonical = await supabase
    .from('public_canonical_office_definitions')
    .select('key,name')
    .order('name')
    .limit(500)

  if (!canonical.error) {
    return uniqueSorted(((canonical.data ?? []) as CatalogRow[]).map((row) => ({
      value: text(row.key) || text(row.name),
      label: text(row.name) || text(row.key),
      description: text(row.key),
    })))
  }

  const fallback = await supabase
    .from('office_configurations')
    .select('id,key,status')
    .eq('status', 'active')
    .order('key')
    .limit(500)

  if (fallback.error) throw fallback.error
  return uniqueSorted(((fallback.data ?? []) as CatalogRow[]).map((row) => ({
    value: text(row.key),
    label: text(row.key),
    description: text(row.id),
  })))
}

async function loadEventTypes(): Promise<SearchableSelectOption[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('canonical_event_types')
    .select('id,key,name,is_active')
    .eq('is_active', true)
    .order('name')
    .limit(200)

  if (error) throw error
  return uniqueSorted(((data ?? []) as CatalogRow[]).map((row) => ({
    value: text(row.key),
    label: text(row.name) || text(row.key),
    description: [text(row.key), text(row.id)].filter(Boolean).join(' · '),
  })))
}

async function loadCatalog(referenceType: ImportReferenceType) {
  if (referenceType === 'person') return loadPeople()
  if (referenceType === 'entity') return loadEntities()
  if (referenceType === 'office') return loadOffices()
  return loadEventTypes()
}

export function getImportReferenceOptions(referenceType: ImportReferenceType) {
  const cached = cache.get(referenceType)
  if (cached) return cached

  const request = loadCatalog(referenceType).catch((error) => {
    cache.delete(referenceType)
    throw error
  })
  cache.set(referenceType, request)
  return request
}
