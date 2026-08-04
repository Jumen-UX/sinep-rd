import type { SupabaseClient } from '@supabase/supabase-js'

export type AccountRole = {
  assignment_id: string
  role_key: string
  role_name: string
  scope_type: string
  scope_entity_id: string | null
}

export type AccountAccessRequest = {
  id: string
  request_type: 'initial_access' | 'person_link' | 'scope_change' | 'role_change' | 'account_closure'
  status: 'draft' | 'submitted' | 'under_review' | 'information_required' | 'approved' | 'rejected' | 'cancelled'
  requested_person_id: string | null
  requested_country_entity_id: string | null
  requested_role_id: string | null
  requested_scope_type: string | null
  requested_scope_id: string | null
  justification: string | null
  requester_notes: string | null
  reviewer_notes: string | null
  submitted_at: string | null
  reviewed_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export type AccountProfile = {
  user_id: string
  email: string
  full_name: string
  phone: string | null
  status: string
  person_id: string | null
  registration_source: 'invitation' | 'self_registration' | 'administrative_provisioning'
  preferred_locale: string
  timezone: string
  avatar_url: string | null
  terms_accepted_at: string | null
  terms_version: string | null
  privacy_accepted_at: string | null
  privacy_version: string | null
  onboarding_step: 'profile' | 'access' | 'complete'
  onboarding_completed_at: string | null
}

export type AccountContext = {
  profile: AccountProfile
  roles: AccountRole[]
  access_requests: AccountAccessRequest[]
}

export type AccountProfileInput = {
  fullName: string
  phone: string
  preferredLocale: string
  timezone: string
  avatarUrl: string
}

export type AccountRequestInput = {
  requestId?: string
  requestType: Exclude<AccountAccessRequest['request_type'], 'person_link'>
  justification: string
  requesterNotes: string
}

const AVATAR_BUCKET = 'profile-avatars'
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_AVATAR_BYTES = 5 * 1024 * 1024

function avatarExtension(file: File) {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

function avatarObjectPathFromUrl(url: string | null | undefined) {
  if (!url) return null
  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`
  const index = url.indexOf(marker)
  if (index < 0) return null
  return decodeURIComponent(url.slice(index + marker.length).split('?')[0] ?? '') || null
}

export function validateProfileAvatar(file: File) {
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    throw new Error('Selecciona una imagen JPG, PNG o WEBP.')
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error('La fotografía no puede superar los 5 MB.')
  }
}

export async function loadMyAccountContext(supabase: SupabaseClient): Promise<AccountContext> {
  const { data, error } = await supabase.rpc('get_my_account_context')
  if (error) throw new Error(error.message || 'No se pudo cargar tu cuenta.')
  return data as AccountContext
}

export async function saveMyAccountProfile(
  supabase: SupabaseClient,
  input: AccountProfileInput,
): Promise<AccountContext> {
  const { data, error } = await supabase.rpc('save_my_account_profile', {
    payload: {
      full_name: input.fullName.trim(),
      phone: input.phone.trim() || null,
      preferred_locale: input.preferredLocale.trim(),
      timezone: input.timezone.trim(),
      avatar_url: input.avatarUrl.trim() || null,
    },
  })

  if (error) throw new Error(error.message || 'No se pudo guardar tu perfil.')
  return data as AccountContext
}

export async function uploadMyProfileAvatar(
  supabase: SupabaseClient,
  file: File,
  previousAvatarUrl?: string | null,
) {
  validateProfileAvatar(file)

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('Tu sesión no está disponible para subir la fotografía.')

  const objectPath = `${userData.user.id}/avatar.${avatarExtension(file)}`
  const previousPath = avatarObjectPathFromUrl(previousAvatarUrl)

  if (previousPath && previousPath !== objectPath) {
    await supabase.storage.from(AVATAR_BUCKET).remove([previousPath])
  }

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(objectPath, file, { cacheControl: '3600', contentType: file.type, upsert: true })

  if (uploadError) throw new Error(uploadError.message || 'No se pudo subir la fotografía.')

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(objectPath)
  return `${data.publicUrl}?v=${Date.now()}`
}

export async function removeMyProfileAvatar(
  supabase: SupabaseClient,
  avatarUrl?: string | null,
) {
  const objectPath = avatarObjectPathFromUrl(avatarUrl)
  if (!objectPath) return

  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([objectPath])
  if (error) throw new Error(error.message || 'No se pudo eliminar la fotografía.')
}

export async function submitMyAccessRequest(
  supabase: SupabaseClient,
  input: AccountRequestInput,
): Promise<AccountAccessRequest> {
  const { data, error } = await supabase.rpc('submit_my_access_request', {
    payload: {
      request_id: input.requestId || null,
      request_type: input.requestType,
      justification: input.justification.trim(),
      requester_notes: input.requesterNotes.trim() || null,
    },
  })

  if (error) throw new Error(error.message || 'No se pudo enviar la solicitud.')
  return data as AccountAccessRequest
}

export async function cancelMyAccessRequest(
  supabase: SupabaseClient,
  requestId: string,
): Promise<AccountAccessRequest> {
  const { data, error } = await supabase.rpc('cancel_my_access_request', {
    p_request_id: requestId,
  })

  if (error) throw new Error(error.message || 'No se pudo cancelar la solicitud.')
  return data as AccountAccessRequest
}
