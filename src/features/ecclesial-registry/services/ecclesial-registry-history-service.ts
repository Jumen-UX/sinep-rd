import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CommunicationChannelRow,
  RegistryOwnerKind,
  SaveChannelInput,
} from './ecclesial-registry-admin-service'

export type EcclesiasticalPlaceDetail = {
  id: string
  place_type_key: string
  primary_entity_id: string
  managing_organization_unit_id: string | null
  country_iso2: string
  name: string
  official_name: string | null
  slug: string
  description: string | null
  dedication_title: string | null
  patron_name: string | null
  opened_at: string | null
  blessed_at: string | null
  dedicated_at: string | null
  consecrated_at: string | null
  closed_at: string | null
  capacity: number | null
  is_primary_seat: boolean
  province: string | null
  municipality: string | null
  sector: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  source_document_id: string | null
  source_name: string | null
  source_url: string | null
  source_checked_at: string | null
  status: string
  visibility: string
  created_at: string
  updated_at: string
}

export type EcclesialInstitutionDetail = {
  id: string
  category_key: string
  primary_entity_id: string
  managing_organization_unit_id: string | null
  country_iso2: string
  name: string
  official_name: string | null
  slug: string
  description: string | null
  civil_legal_name: string | null
  civil_registration_number: string | null
  founded_at: string | null
  canonical_erected_at: string | null
  civil_registered_at: string | null
  closed_at: string | null
  province: string | null
  municipality: string | null
  sector: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  source_document_id: string | null
  source_name: string | null
  source_url: string | null
  source_checked_at: string | null
  status: string
  visibility: string
  created_at: string
  updated_at: string
}

export type RegistryAffiliationTargetKind = Exclude<RegistryOwnerKind, 'place'>

export type RegistryAffiliationRow = {
  id: string
  relationship_type: string
  target_kind: RegistryAffiliationTargetKind
  target_id: string
  target_name: string
  valid_from: string | null
  valid_to: string | null
  is_current: boolean
  status: string
  notes: string | null
  source_document_id: string | null
  source_document_title: string | null
  is_primary_relation: boolean
  created_at: string
  updated_at: string
}

export type UpdatePlaceInput = {
  id: string
  placeTypeKey: string
  primaryEntityId: string
  managingOrganizationUnitId?: string
  name: string
  officialName?: string
  description?: string
  dedicationTitle?: string
  patronName?: string
  openedAt?: string
  blessedAt?: string
  dedicatedAt?: string
  consecratedAt?: string
  closedAt?: string
  capacity?: string
  province?: string
  municipality?: string
  sector?: string
  address?: string
  latitude?: string
  longitude?: string
  sourceName?: string
  sourceUrl?: string
  sourceCheckedAt?: string
  status: string
  visibility: string
  isPrimarySeat: boolean
}

export type UpdateInstitutionInput = {
  id: string
  categoryKey: string
  primaryEntityId: string
  managingOrganizationUnitId?: string
  name: string
  officialName?: string
  description?: string
  civilLegalName?: string
  civilRegistrationNumber?: string
  foundedAt?: string
  canonicalErectedAt?: string
  civilRegisteredAt?: string
  closedAt?: string
  province?: string
  municipality?: string
  sector?: string
  address?: string
  latitude?: string
  longitude?: string
  sourceName?: string
  sourceUrl?: string
  sourceCheckedAt?: string
  status: string
  visibility: string
}

export type UpdateChannelInput = SaveChannelInput & {
  id: string
  status: string
  verifiedAt?: string
}

export type SavePlaceAffiliationInput = {
  placeId: string
  relationshipType: string
  targetKind: RegistryAffiliationTargetKind
  targetId: string
  validFrom?: string
  validTo?: string
  notes?: string
}

export type SaveInstitutionAffiliationInput = {
  institutionId: string
  relationshipType: string
  targetKind: RegistryAffiliationTargetKind
  targetId: string
  validFrom?: string
  validTo?: string
  notes?: string
}

function normalizeError(error: { message?: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback)
}

function optional(value?: string) {
  return value?.trim() ?? ''
}

function targetPayload(kind: RegistryAffiliationTargetKind, id: string) {
  return {
    ecclesiastical_entity_id: kind === 'entity' ? id : undefined,
    organization_unit_id: kind === 'organization_unit' ? id : undefined,
    institution_id: kind === 'institution' ? id : undefined,
    parent_institution_id: kind === 'institution' ? id : undefined,
  }
}

export async function loadEcclesiasticalPlaceDetail(
  supabase: SupabaseClient,
  placeId: string,
): Promise<EcclesiasticalPlaceDetail> {
  const { data, error } = await supabase.rpc('admin_get_ecclesiastical_place', {
    p_place_id: placeId,
  })
  normalizeError(error, 'No se pudo cargar la ficha completa del lugar.')
  const row = (data ?? [])[0] as EcclesiasticalPlaceDetail | undefined
  if (!row) throw new Error('El lugar seleccionado ya no está disponible.')
  return row
}

export async function loadEcclesialInstitutionDetail(
  supabase: SupabaseClient,
  institutionId: string,
): Promise<EcclesialInstitutionDetail> {
  const { data, error } = await supabase.rpc('admin_get_ecclesial_institution', {
    p_institution_id: institutionId,
  })
  normalizeError(error, 'No se pudo cargar la ficha completa de la institución.')
  const row = (data ?? [])[0] as EcclesialInstitutionDetail | undefined
  if (!row) throw new Error('La institución seleccionada ya no está disponible.')
  return row
}

export async function loadEcclesiasticalPlaceAffiliations(
  supabase: SupabaseClient,
  placeId: string,
  includeHistory = true,
): Promise<RegistryAffiliationRow[]> {
  const { data, error } = await supabase.rpc('admin_list_ecclesiastical_place_affiliations', {
    p_place_id: placeId,
    p_include_history: includeHistory,
  })
  normalizeError(error, 'No se pudo cargar el historial de relaciones del lugar.')
  return (data ?? []) as RegistryAffiliationRow[]
}

export async function loadEcclesialInstitutionAffiliations(
  supabase: SupabaseClient,
  institutionId: string,
  includeHistory = true,
): Promise<RegistryAffiliationRow[]> {
  const { data, error } = await supabase.rpc('admin_list_ecclesial_institution_affiliations', {
    p_institution_id: institutionId,
    p_include_history: includeHistory,
  })
  normalizeError(error, 'No se pudo cargar el historial de relaciones de la institución.')
  return (data ?? []) as RegistryAffiliationRow[]
}

export async function updateEcclesiasticalPlace(
  supabase: SupabaseClient,
  input: UpdatePlaceInput,
) {
  const { data, error } = await supabase.rpc('admin_save_ecclesiastical_place', {
    payload: {
      id: input.id,
      place_type_key: input.placeTypeKey,
      primary_entity_id: input.primaryEntityId,
      managing_organization_unit_id: optional(input.managingOrganizationUnitId),
      name: input.name,
      official_name: optional(input.officialName),
      description: optional(input.description),
      dedication_title: optional(input.dedicationTitle),
      patron_name: optional(input.patronName),
      opened_at: optional(input.openedAt),
      blessed_at: optional(input.blessedAt),
      dedicated_at: optional(input.dedicatedAt),
      consecrated_at: optional(input.consecratedAt),
      closed_at: optional(input.closedAt),
      capacity: optional(input.capacity),
      province: optional(input.province),
      municipality: optional(input.municipality),
      sector: optional(input.sector),
      address: optional(input.address),
      latitude: optional(input.latitude),
      longitude: optional(input.longitude),
      source_name: optional(input.sourceName),
      source_url: optional(input.sourceUrl),
      source_checked_at: optional(input.sourceCheckedAt),
      status: input.status,
      visibility: input.visibility,
      is_primary_seat: input.isPrimarySeat,
    },
  })
  normalizeError(error, 'No se pudo actualizar el lugar eclesiástico.')
  return data as { place_id: string; slug: string; country_iso2: string; status: string; visibility: string }
}

export async function updateEcclesialInstitution(
  supabase: SupabaseClient,
  input: UpdateInstitutionInput,
) {
  const { data, error } = await supabase.rpc('admin_save_ecclesial_institution', {
    payload: {
      id: input.id,
      category_key: input.categoryKey,
      primary_entity_id: input.primaryEntityId,
      managing_organization_unit_id: optional(input.managingOrganizationUnitId),
      name: input.name,
      official_name: optional(input.officialName),
      description: optional(input.description),
      civil_legal_name: optional(input.civilLegalName),
      civil_registration_number: optional(input.civilRegistrationNumber),
      founded_at: optional(input.foundedAt),
      canonical_erected_at: optional(input.canonicalErectedAt),
      civil_registered_at: optional(input.civilRegisteredAt),
      closed_at: optional(input.closedAt),
      province: optional(input.province),
      municipality: optional(input.municipality),
      sector: optional(input.sector),
      address: optional(input.address),
      latitude: optional(input.latitude),
      longitude: optional(input.longitude),
      source_name: optional(input.sourceName),
      source_url: optional(input.sourceUrl),
      source_checked_at: optional(input.sourceCheckedAt),
      status: input.status,
      visibility: input.visibility,
    },
  })
  normalizeError(error, 'No se pudo actualizar la institución eclesial.')
  return data as { institution_id: string; slug: string; country_iso2: string; status: string; visibility: string }
}

export async function updateCommunicationChannel(
  supabase: SupabaseClient,
  input: UpdateChannelInput,
) {
  const ownerPayload = {
    owner_entity_id: input.ownerKind === 'entity' ? input.ownerId : undefined,
    owner_organization_unit_id: input.ownerKind === 'organization_unit' ? input.ownerId : undefined,
    owner_place_id: input.ownerKind === 'place' ? input.ownerId : undefined,
    owner_institution_id: input.ownerKind === 'institution' ? input.ownerId : undefined,
  }
  const { data, error } = await supabase.rpc('admin_save_communication_channel', {
    payload: {
      id: input.id,
      channel_type_key: input.channelTypeKey,
      ...ownerPayload,
      label: optional(input.label),
      value: input.value,
      is_primary: input.isPrimary,
      verified_at: optional(input.verifiedAt),
      visibility: input.visibility,
      status: input.status,
    },
  })
  normalizeError(error, 'No se pudo actualizar el canal de comunicación.')
  return data as { channel_id: string; country_iso2: string; status: string; visibility: string }
}

export async function saveEcclesiasticalPlaceAffiliation(
  supabase: SupabaseClient,
  input: SavePlaceAffiliationInput,
) {
  const targets = targetPayload(input.targetKind, input.targetId)
  const { data, error } = await supabase.rpc('admin_save_ecclesiastical_place_affiliation', {
    payload: {
      place_id: input.placeId,
      relationship_type: input.relationshipType,
      ecclesiastical_entity_id: targets.ecclesiastical_entity_id,
      organization_unit_id: targets.organization_unit_id,
      institution_id: targets.institution_id,
      valid_from: optional(input.validFrom),
      valid_to: optional(input.validTo),
      notes: optional(input.notes),
      is_current: true,
      status: 'active',
    },
  })
  normalizeError(error, 'No se pudo guardar la relación del lugar.')
  return data as { affiliation_id: string; place_id: string; country_iso2: string }
}

export async function saveEcclesialInstitutionAffiliation(
  supabase: SupabaseClient,
  input: SaveInstitutionAffiliationInput,
) {
  const targets = targetPayload(input.targetKind, input.targetId)
  const { data, error } = await supabase.rpc('admin_save_ecclesial_institution_affiliation', {
    payload: {
      institution_id: input.institutionId,
      relationship_type: input.relationshipType,
      ecclesiastical_entity_id: targets.ecclesiastical_entity_id,
      organization_unit_id: targets.organization_unit_id,
      parent_institution_id: targets.parent_institution_id,
      valid_from: optional(input.validFrom),
      valid_to: optional(input.validTo),
      notes: optional(input.notes),
      is_current: true,
      status: 'active',
    },
  })
  normalizeError(error, 'No se pudo guardar la relación de la institución.')
  return data as { affiliation_id: string; institution_id: string; country_iso2: string }
}

export async function closeEcclesiasticalPlaceAffiliation(
  supabase: SupabaseClient,
  affiliationId: string,
  validTo: string,
  notes?: string,
) {
  const { data, error } = await supabase.rpc('admin_close_ecclesiastical_place_affiliation', {
    payload: { id: affiliationId, valid_to: validTo, notes: optional(notes) },
  })
  normalizeError(error, 'No se pudo cerrar la relación del lugar.')
  return data as { affiliation_id: string; place_id: string; valid_to: string; status: string }
}

export async function closeEcclesialInstitutionAffiliation(
  supabase: SupabaseClient,
  affiliationId: string,
  validTo: string,
  notes?: string,
) {
  const { data, error } = await supabase.rpc('admin_close_ecclesial_institution_affiliation', {
    payload: { id: affiliationId, valid_to: validTo, notes: optional(notes) },
  })
  normalizeError(error, 'No se pudo cerrar la relación de la institución.')
  return data as { affiliation_id: string; institution_id: string; valid_to: string; status: string }
}

export function communicationChannelToUpdateInput(
  row: CommunicationChannelRow,
): UpdateChannelInput {
  return {
    id: row.id,
    channelTypeKey: row.channel_type_key,
    ownerKind: row.owner_kind,
    ownerId: row.owner_id,
    label: row.label ?? undefined,
    value: row.value,
    isPrimary: row.is_primary,
    visibility: row.visibility,
    status: row.status,
    verifiedAt: row.verified_at?.slice(0, 10),
  }
}
