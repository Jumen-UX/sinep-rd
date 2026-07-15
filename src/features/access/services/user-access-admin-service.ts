import type { SupabaseClient } from '@supabase/supabase-js'

export type RoleAssignment = {
  assignment_id: string
  role_id: string
  role_key: string
  role_name: string
  scope_type: string
  scope_entity_id: string | null
  diocese_id: string | null
  pastoral_area_id: string | null
  organization_unit_id: string | null
  starts_at: string | null
  ends_at: string | null
  status: string
}

export type EffectivePermission = {
  key: string
  module: string
  description: string | null
}

type RawUserRow = {
  user_id: string
  email: string | null
  full_name: string | null
  phone: string | null
  profile_status: 'pending' | 'active' | 'suspended' | 'disabled' | string
  auth_created_at: string | null
  email_confirmed_at: string | null
  last_sign_in_at: string | null
  active_roles: RoleAssignment[] | string | null
  active_permissions: EffectivePermission[] | string | null
}

export type UserRow = Omit<RawUserRow, 'active_roles' | 'active_permissions'> & {
  active_roles: RoleAssignment[]
  active_permissions: EffectivePermission[]
  onboarding_step: 'profile' | 'access' | 'complete'
  onboarding_completed_at: string | null
  access_state: 'ready' | 'onboarding' | 'no_role' | 'blocked'
}

type UserOnboardingProgress = Pick<
  UserRow,
  'user_id' | 'onboarding_step' | 'onboarding_completed_at' | 'access_state'
>

type RawRoleMatrixRow = {
  role_id: string
  role_key: string
  role_name: string
  description: string | null
  is_system_role: boolean
  active_assignments_count: number
  permissions: EffectivePermission[] | string | null
}

export type RoleMatrixRow = Omit<RawRoleMatrixRow, 'permissions'> & {
  permissions: EffectivePermission[]
}

export type ScopeOption = {
  scope_type: string
  scope_entity_id: string
  label: string
  description: string | null
  source_table?: string
  diocese_id?: string | null
  parent_id?: string | null
}

export type UserAccessData = {
  users: UserRow[]
  roles: RoleMatrixRow[]
  scopeOptions: ScopeOption[]
}

export type UserProfileStatus = 'active' | 'suspended' | 'disabled'

export type AssignUserRoleInput = {
  userId: string
  roleId: string
  scopeType: string
  scopeEntityId: string | null
}

export type InviteUserInput = {
  email: string
  fullName: string
  phone: string
  roleId: string
  scopeType: string
  scopeEntityId: string | null
}

export type InviteUserResult = {
  warning: string | null
  existingUser: boolean
}

export const userScopeTypes = [
  { value: 'national', label: 'Nacional' },
  { value: 'diocese', label: 'Diócesis' },
  { value: 'vicariate', label: 'Vicaría' },
  { value: 'zone', label: 'Zona pastoral' },
  { value: 'parish', label: 'Parroquia' },
  { value: 'pastoral_area', label: 'Área pastoral' },
  { value: 'organization_unit', label: 'Unidad organizativa' },
  { value: 'entity', label: 'Entidad eclesial / nodo' },
  { value: 'global', label: 'Global técnico' },
] as const

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  pending_invitation: 'Invitación pendiente',
  active: 'Activo',
  suspended: 'Suspendido',
  disabled: 'Desactivado',
  inactive: 'Inactivo',
}

function throwIfError(error: { message: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback)
}

export function parseJsonArray<T>(value: T[] | string | null | undefined): T[] {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

export function getUserStatusLabel(status: string) {
  return statusLabels[status] ?? status
}

export function getUserOnboardingLabel(user: UserRow) {
  if (user.access_state === 'blocked') return 'Acceso bloqueado'
  if (user.access_state === 'no_role') return 'Perfil confirmado · sin rol activo'
  if (user.access_state === 'ready') return 'Onboarding completo · acceso habilitado'
  if (user.onboarding_step === 'access') return 'Perfil guardado · pendiente de rol'
  return 'Invitación enviada · perfil pendiente'
}

export function scopeNeedsEntity(scopeType: string) {
  return !['national', 'global'].includes(scopeType)
}

export function getScopeLabel(scopeType: string) {
  return userScopeTypes.find((scope) => scope.value === scopeType)?.label ?? scopeType
}

export function formatUserAccessDate(value: string | null) {
  if (!value) return 'No registrado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no válida'
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export async function hasUserAccessSession(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser()
  return !error && Boolean(data.user)
}

export async function loadUserAccessData(supabase: SupabaseClient): Promise<UserAccessData> {
  const [usersResponse, progressResponse, rolesResponse, scopesResponse] = await Promise.all([
    supabase.rpc('admin_list_users'),
    supabase.rpc('admin_list_user_onboarding_progress'),
    supabase.rpc('admin_list_roles_with_permissions'),
    supabase.rpc('admin_list_role_scope_options', { p_scope_type: null }),
  ])

  const error = usersResponse.error ?? progressResponse.error ?? rolesResponse.error ?? scopesResponse.error
  throwIfError(error, 'No pudimos cargar usuarios y permisos.')

  const progressByUser = new Map(
    parseJsonArray<UserOnboardingProgress>(progressResponse.data).map((progress) => [progress.user_id, progress]),
  )
  const users = ((usersResponse.data ?? []) as RawUserRow[]).map((user) => {
    const progress = progressByUser.get(user.user_id)
    return {
      ...user,
      active_roles: parseJsonArray<RoleAssignment>(user.active_roles),
      active_permissions: parseJsonArray<EffectivePermission>(user.active_permissions),
      onboarding_step: progress?.onboarding_step ?? 'profile',
      onboarding_completed_at: progress?.onboarding_completed_at ?? null,
      access_state: progress?.access_state ?? 'onboarding',
    }
  })

  const roles = ((rolesResponse.data ?? []) as RawRoleMatrixRow[]).map((role) => ({
    ...role,
    permissions: parseJsonArray<EffectivePermission>(role.permissions),
  }))

  return {
    users,
    roles,
    scopeOptions: (scopesResponse.data ?? []) as ScopeOption[],
  }
}

export async function loadUserInvitationOptions(supabase: SupabaseClient) {
  const [rolesResponse, scopesResponse] = await Promise.all([
    supabase.rpc('admin_list_roles_with_permissions'),
    supabase.rpc('admin_list_role_scope_options', { p_scope_type: null }),
  ])

  const error = rolesResponse.error ?? scopesResponse.error
  throwIfError(error, 'No se pudieron cargar las opciones de invitación.')

  const roles = ((rolesResponse.data ?? []) as RawRoleMatrixRow[]).map((role) => ({
    ...role,
    permissions: parseJsonArray<EffectivePermission>(role.permissions),
  }))

  return {
    roles,
    scopeOptions: (scopesResponse.data ?? []) as ScopeOption[],
  }
}

export async function assignUserRole(supabase: SupabaseClient, input: AssignUserRoleInput) {
  const { error } = await supabase.rpc('admin_assign_user_role', {
    payload: {
      user_id: input.userId,
      role_id: input.roleId,
      scope_type: input.scopeType,
      scope_entity_id: input.scopeEntityId,
    },
  })

  throwIfError(error, 'No se pudo asignar el rol.')
}

export async function updateUserProfileStatus(
  supabase: SupabaseClient,
  userId: string,
  status: UserProfileStatus,
) {
  const { error } = await supabase.rpc('admin_update_user_profile_status', {
    payload: { user_id: userId, status },
  })

  throwIfError(error, 'No se pudo actualizar el estado del usuario.')
}

export async function endUserRole(supabase: SupabaseClient, assignmentId: string) {
  const { error } = await supabase.rpc('admin_end_user_role', {
    payload: { assignment_id: assignmentId },
  })

  throwIfError(error, 'No se pudo cerrar el rol.')
}

export async function inviteUser(input: InviteUserInput): Promise<InviteUserResult> {
  const response = await fetch('/api/admin/users/create-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: input.email,
      full_name: input.fullName,
      phone: input.phone,
      role_id: input.roleId || undefined,
      scope_type: input.roleId ? input.scopeType : undefined,
      scope_entity_id: input.roleId && scopeNeedsEntity(input.scopeType)
        ? input.scopeEntityId ?? undefined
        : undefined,
    }),
  })

  const result = await response.json().catch(() => ({})) as { error?: string; warning?: string; existing_user?: boolean }
  if (!response.ok) throw new Error(result.error ?? 'No se pudo enviar la invitación.')

  return { warning: result.warning ?? null, existingUser: result.existing_user === true }
}
