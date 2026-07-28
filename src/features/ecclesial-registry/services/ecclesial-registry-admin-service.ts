import type { SupabaseClient } from '@supabase/supabase-js'

export type RegistryScope = {
  type: string | null
  id: string | null
}

export type RegistryFilters = {
  search?: string | null
  typeKey?: string | null
  status?: string | null
  visibility?: string | null
  limit?: number
}

export type EcclesiasticalPlaceRow = {
  id: string
  name: string
  official_name: string | null
  slug: string
  place_type_key: string
  place_type_name: string
  primary_entity_id: string
  primary_entity_name: string
  managing_organization_unit_id: string | null
  managing_organization_unit_name: string | null
  country_iso2: string
  municipality: string | null
  address: string | null
  dedicated_at: string | null
  consecrated_at: string | null
  is_primary_seat: boolean
  status: string
  visibility: string
  channel_count: number
  affiliation_count: number
  legacy_entity_id: string | null
  created_at: string
  updated_at: string
}

export type EcclesialInstitutionRow = {
  id: string
  name: string
  official_name: string | null
  slug: string
  category_key: string
  category_name: string
  domain: string
  primary_entity_id: string
  primary_entity_name: string
  managing_organization_unit_id: string | null
  managing_organization_unit_name: string | null
  country_iso2: string
  municipality: string | null
  address: string | null
  founded_at: string | null
  canonical_erected_at: string | null
  status: string
  visibility: string
  channel_count: number
  affiliation_count: number
  legacy_entity_id: string | null
  created_at: string
  updated_at: string
}

export type CommunicationChannelRow = {
  id: string
  channel_type_key: string
  channel_type_name: string
  channel_group: string
  label: string | null
  value: string
  owner_kind: RegistryOwnerKind
  owner_id: string
  owner_name: string
  country_iso2: string
  is_primary: boolean
  status: string
  visibility: string
  verified_at: string | null
  created_at: string
  updated_at: string
}

export type PlaceTypeOption = {
  key: string
  name: string
  description: string | null
  allows_dedication: boolean
  allows_consecration: boolean
  sort_order: number
}

export type InstitutionCategoryOption = {
  key: string
  name: string
  description: string | null
  domain: string
  parent_category_id: string | null
  sort_order: number
}

export type ChannelTypeOption = {
  key: string
  name: string
  description: string | null
  channel_group: string
  value_kind: string
  sort_order: number
}

export type RegistryOwnerKind = 'entity' | 'organization_unit' | 'place' | 'institution'

export type RegistryOwnerOption = {
  owner_kind: RegistryOwnerKind
  owner_id: string
  label: string
  country_iso2: string
  allowed_for_places: boolean
  allowed_for_institutions: boolean
  allowed_for_communications: boolean
}

export type SavePlaceInput = {
  placeTypeKey: string
  primaryEntityId: string
  name: string
  officialName?: string
  description?: string
  dedicationTitle?: string
  patronName?: string
  dedicatedAt?: string
  consecratedAt?: string
  address?: string
  municipality?: string
  status: string
  visibility: string
  isPrimarySeat: boolean
}

export type SaveInstitutionInput = {
  categoryKey: string
  primaryEntityId: string
  name: string
  officialName?: string
  description?: string
  foundedAt?: string
  canonicalErectedAt?: string
  address?: string
  municipality?: string
  status: string
  visibility: string
}

export type SaveChannelInput = {
  channelTypeKey: string
  ownerKind: RegistryOwnerKind
  ownerId: string
  label?: string
  value: string
  isPrimary: boolean
  visibility: string
}

function normalizeError(error: { message?: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback)
}

function rpcScope(scope: RegistryScope) {
  return {
    p_scope_type: scope.type,
    p_scope_id: scope.id,
  }
}

export async function loadEcclesiasticalPlaces(
  supabase: SupabaseClient,
  scope: RegistryScope,
  filters: RegistryFilters,
): Promise<EcclesiasticalPlaceRow[]> {
  const { data, error } = await supabase.rpc('admin_list_ecclesiastical_places', {
    ...rpcScope(scope),
    p_search: filters.search ?? null,
    p_place_type_key: filters.typeKey ?? null,
    p_status: filters.status ?? null,
    p_visibility: filters.visibility ?? null,
    p_limit: filters.limit ?? 500,
  })

  normalizeError(error, 'No se pudieron cargar los lugares eclesiásticos.')
  return (data ?? []) as EcclesiasticalPlaceRow[]
}

export async function loadEcclesialInstitutions(
  supabase: SupabaseClient,
  scope: RegistryScope,
  filters: RegistryFilters,
): Promise<EcclesialInstitutionRow[]> {
  const { data, error } = await supabase.rpc('admin_list_ecclesial_institutions', {
    ...rpcScope(scope),
    p_search: filters.search ?? null,
    p_category_key: filters.typeKey ?? null,
    p_status: filters.status ?? null,
    p_visibility: filters.visibility ?? null,
    p_limit: filters.limit ?? 500,
  })

  normalizeError(error, 'No se pudieron cargar las instituciones eclesiales.')
  return (data ?? []) as EcclesialInstitutionRow[]
}

export async function loadCommunicationChannels(
  supabase: SupabaseClient,
  scope: RegistryScope,
  filters: RegistryFilters,
): Promise<CommunicationChannelRow[]> {
  const { data, error } = await supabase.rpc('admin_list_communication_channels', {
    ...rpcScope(scope),
    p_search: filters.search ?? null,
    p_channel_type_key: filters.typeKey ?? null,
    p_status: filters.status ?? null,
    p_visibility: filters.visibility ?? null,
    p_limit: filters.limit ?? 1000,
  })

  normalizeError(error, 'No se pudieron cargar los canales de comunicación.')
  return (data ?? []) as CommunicationChannelRow[]
}

export async function loadRegistryCatalogs(supabase: SupabaseClient) {
  const [places, institutions, channels] = await Promise.all([
    supabase
      .from('ecclesiastical_place_types')
      .select('key,name,description,allows_dedication,allows_consecration,sort_order')
      .eq('status', 'active')
      .order('sort_order')
      .order('name'),
    supabase
      .from('ecclesial_institution_categories')
      .select('key,name,description,domain,parent_category_id,sort_order')
      .eq('status', 'active')
      .order('sort_order')
      .order('name'),
    supabase
      .from('communication_channel_types')
      .select('key,name,description,channel_group,value_kind,sort_order')
      .eq('status', 'active')
      .order('sort_order')
      .order('name'),
  ])

  normalizeError(places.error, 'No se pudo cargar el catálogo de lugares.')
  normalizeError(institutions.error, 'No se pudo cargar el catálogo institucional.')
  normalizeError(channels.error, 'No se pudo cargar el catálogo de canales.')

  return {
    placeTypes: (places.data ?? []) as PlaceTypeOption[],
    institutionCategories: (institutions.data ?? []) as InstitutionCategoryOption[],
    channelTypes: (channels.data ?? []) as ChannelTypeOption[],
  }
}

export async function loadRegistryOwnerOptions(
  supabase: SupabaseClient,
  scope: RegistryScope,
): Promise<RegistryOwnerOption[]> {
  const { data, error } = await supabase.rpc('admin_list_ecclesial_registry_owner_options', {
    ...rpcScope(scope),
    p_limit: 1500,
  })

  normalizeError(error, 'No se pudieron cargar las entidades y propietarios disponibles.')
  return (data ?? []) as RegistryOwnerOption[]
}

export async function saveEcclesiasticalPlace(
  supabase: SupabaseClient,
  input: SavePlaceInput,
) {
  const { data, error } = await supabase.rpc('admin_save_ecclesiastical_place', {
    payload: {
      place_type_key: input.placeTypeKey,
      primary_entity_id: input.primaryEntityId,
      name: input.name,
      official_name: input.officialName || undefined,
      description: input.description || undefined,
      dedication_title: input.dedicationTitle || undefined,
      patron_name: input.patronName || undefined,
      dedicated_at: input.dedicatedAt || undefined,
      consecrated_at: input.consecratedAt || undefined,
      address: input.address || undefined,
      municipality: input.municipality || undefined,
      status: input.status,
      visibility: input.visibility,
      is_primary_seat: input.isPrimarySeat,
    },
  })

  normalizeError(error, 'No se pudo guardar el lugar eclesiástico.')
  return data as { place_id: string; slug: string; country_iso2: string; status: string; visibility: string }
}

export async function saveEcclesialInstitution(
  supabase: SupabaseClient,
  input: SaveInstitutionInput,
) {
  const { data, error } = await supabase.rpc('admin_save_ecclesial_institution', {
    payload: {
      category_key: input.categoryKey,
      primary_entity_id: input.primaryEntityId,
      name: input.name,
      official_name: input.officialName || undefined,
      description: input.description || undefined,
      founded_at: input.foundedAt || undefined,
      canonical_erected_at: input.canonicalErectedAt || undefined,
      address: input.address || undefined,
      municipality: input.municipality || undefined,
      status: input.status,
      visibility: input.visibility,
    },
  })

  normalizeError(error, 'No se pudo guardar la institución eclesial.')
  return data as { institution_id: string; slug: string; country_iso2: string; status: string; visibility: string }
}

export async function saveCommunicationChannel(
  supabase: SupabaseClient,
  input: SaveChannelInput,
) {
  const ownerPayload = {
    owner_entity_id: input.ownerKind === 'entity' ? input.ownerId : undefined,
    owner_organization_unit_id: input.ownerKind === 'organization_unit' ? input.ownerId : undefined,
    owner_place_id: input.ownerKind === 'place' ? input.ownerId : undefined,
    owner_institution_id: input.ownerKind === 'institution' ? input.ownerId : undefined,
  }
  const { data, error } = await supabase.rpc('admin_save_communication_channel', {
    payload: {
      channel_type_key: input.channelTypeKey,
      ...ownerPayload,
      label: input.label || undefined,
      value: input.value,
      is_primary: input.isPrimary,
      visibility: input.visibility,
      status: 'active',
    },
  })

  normalizeError(error, 'No se pudo guardar el canal de comunicación.')
  return data as { channel_id: string; country_iso2: string; status: string; visibility: string }
}
