import { cache } from 'react'
import { fetchSupabaseJson } from '@/lib/supabase/rest'

export type PublicRegistryAffiliation = {
  id: string
  relationship_type: string
  target_kind: 'entity' | 'organization_unit' | 'institution'
  target_id: string
  target_name: string
  target_slug: string | null
  valid_from: string | null
  valid_to: string | null
  is_current: boolean
  period_status: 'current' | 'historical'
}

export type PublicRegistryChannel = {
  id: string
  channel_type_id: string
  label: string | null
  value: string
  is_primary: boolean
  verified_at: string | null
}

export type PublicPlaceProfile = {
  kind: 'place'
  record: Record<string, unknown>
  type_name: string | null
  primary_entity_name: string | null
  primary_entity_slug: string | null
  affiliations: PublicRegistryAffiliation[]
  channels: PublicRegistryChannel[]
}

export type PublicInstitutionProfile = {
  kind: 'institution'
  record: Record<string, unknown>
  category_name: string | null
  primary_entity_name: string | null
  primary_entity_slug: string | null
  affiliations: PublicRegistryAffiliation[]
  channels: PublicRegistryChannel[]
}

const placeColumns = [
  'id','place_type_id','primary_entity_id','name','official_name','slug','description','dedication_title','patron_name',
  'opened_at','blessed_at','dedicated_at','consecrated_at','closed_at','capacity','is_primary_seat','country_iso2',
  'province','municipality','sector','address','latitude','longitude','source_name','source_url','source_checked_at',
].join(',')

const institutionColumns = [
  'id','category_id','primary_entity_id','name','official_name','slug','description','civil_legal_name',
  'civil_registration_number','founded_at','canonical_erected_at','civil_registered_at','closed_at','country_iso2',
  'province','municipality','sector','address','latitude','longitude','source_name','source_url','source_checked_at',
].join(',')

async function loadEntity(entityId: string) {
  const rows = await fetchSupabaseJson<Array<{ name: string; slug: string }>>('ecclesiastical_entities', {
    id: `eq.${entityId}`,
    status: 'eq.active',
    visibility: 'eq.public',
    select: 'name,slug',
    limit: '1',
  }).catch(() => [])
  return rows[0] ?? null
}

export const loadPublicPlaceProfile = cache(async (slug: string): Promise<PublicPlaceProfile | null> => {
  const rows = await fetchSupabaseJson<Array<Record<string, unknown>>>('ecclesiastical_places', {
    slug: `eq.${slug}`,
    status: 'eq.active',
    visibility: 'eq.public',
    select: placeColumns,
    limit: '1',
  })
  const record = rows[0]
  if (!record) return null

  const id = String(record.id)
  const typeId = String(record.place_type_id)
  const entityId = String(record.primary_entity_id)
  const [types, entity, affiliations, channels] = await Promise.all([
    fetchSupabaseJson<Array<{ name: string }>>('ecclesiastical_place_types', { id: `eq.${typeId}`, select: 'name', limit: '1' }).catch(() => []),
    loadEntity(entityId),
    fetchSupabaseJson<PublicRegistryAffiliation[]>('public_ecclesiastical_place_affiliations', {
      place_id: `eq.${id}`,
      select: '*',
      order: 'is_current.desc,valid_from.desc.nullslast',
    }).catch(() => []),
    fetchSupabaseJson<PublicRegistryChannel[]>('communication_channels', {
      owner_place_id: `eq.${id}`,
      status: 'eq.active',
      visibility: 'eq.public',
      select: 'id,channel_type_id,label,value,is_primary,verified_at',
      order: 'is_primary.desc,sort_order.asc',
    }).catch(() => []),
  ])

  return {
    kind: 'place',
    record,
    type_name: types[0]?.name ?? null,
    primary_entity_name: entity?.name ?? null,
    primary_entity_slug: entity?.slug ?? null,
    affiliations,
    channels,
  }
})

export const loadPublicInstitutionProfile = cache(async (slug: string): Promise<PublicInstitutionProfile | null> => {
  const rows = await fetchSupabaseJson<Array<Record<string, unknown>>>('ecclesial_institutions', {
    slug: `eq.${slug}`,
    status: 'eq.active',
    visibility: 'eq.public',
    select: institutionColumns,
    limit: '1',
  })
  const record = rows[0]
  if (!record) return null

  const id = String(record.id)
  const categoryId = String(record.category_id)
  const entityId = String(record.primary_entity_id)
  const [categories, entity, affiliations, channels] = await Promise.all([
    fetchSupabaseJson<Array<{ name: string }>>('ecclesial_institution_categories', { id: `eq.${categoryId}`, select: 'name', limit: '1' }).catch(() => []),
    loadEntity(entityId),
    fetchSupabaseJson<PublicRegistryAffiliation[]>('public_ecclesial_institution_affiliations', {
      institution_id: `eq.${id}`,
      select: '*',
      order: 'is_current.desc,valid_from.desc.nullslast',
    }).catch(() => []),
    fetchSupabaseJson<PublicRegistryChannel[]>('communication_channels', {
      owner_institution_id: `eq.${id}`,
      status: 'eq.active',
      visibility: 'eq.public',
      select: 'id,channel_type_id,label,value,is_primary,verified_at',
      order: 'is_primary.desc,sort_order.asc',
    }).catch(() => []),
  ])

  return {
    kind: 'institution',
    record,
    category_name: categories[0]?.name ?? null,
    primary_entity_name: entity?.name ?? null,
    primary_entity_slug: entity?.slug ?? null,
    affiliations,
    channels,
  }
})
