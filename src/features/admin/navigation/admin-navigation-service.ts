import type { SupabaseClient } from '@supabase/supabase-js'
import type { AdminNavigationAccessState } from './admin-navigation-policy'

export type AdminNavigationRole = {
  key: string
  name: string
  scopeType: string
  scopeEntityId: string | null
  scopeLabel: string
  isUnrestricted: boolean
}

export type AdminNavigationScope = {
  key: string
  type: string
  entityId: string | null
  label: string
  isUnrestricted: boolean
}

export type AdminNavigationContext = {
  userId: string
  accessState: AdminNavigationAccessState
  profileStatus: string
  roles: AdminNavigationRole[]
  permissionKeys: string[]
  modules: string[]
  activeScope: AdminNavigationScope
  availableScopes: AdminNavigationScope[]
}

type EntryContext = {
  user_id?: string
  profile_status?: string
  access_state?: AdminNavigationAccessState
}

type RawPermission = {
  key?: string
  module?: string
}

type RawRolePermission = {
  permissions?: RawPermission[] | RawPermission | null
}

type RawRole = {
  key?: string
  name?: string
  role_permissions?: RawRolePermission[] | RawRolePermission | null
}

type RawAssignment = {
  role_id?: string
  scope_type?: string
  scope_entity_id?: string | null
  diocese_id?: string | null
  pastoral_area_id?: string | null
  organization_unit_id?: string | null
  starts_at?: string | null
  ends_at?: string | null
  status?: string
  roles?: RawRole[] | RawRole | null
}

type NamedRow = {
  id: string
  name: string | null
}

const unrestrictedRoleKeys = new Set(['super_admin', 'national_admin'])

const scopeLabels: Record<string, string> = {
  global: 'Ámbito global',
  national: 'Ámbito nacional',
  diocese: 'Diócesis',
  vicariate: 'Vicaría',
  zone: 'Zona pastoral',
  parish: 'Parroquia',
  pastoral_area: 'Área pastoral',
  organization_unit: 'Unidad organizativa',
  entity: 'Entidad',
}

function asArray<T>(value: T[] | T | null | undefined): T[] {
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

function normalizedEntryContext(value: unknown): EntryContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as EntryContext
}

function isActiveAssignment(assignment: RawAssignment, today: string) {
  if (assignment.status !== 'active') return false
  if (assignment.starts_at && assignment.starts_at > today) return false
  if (assignment.ends_at && assignment.ends_at < today) return false
  return true
}

function assignmentEntityId(assignment: RawAssignment) {
  if (assignment.scope_entity_id) return assignment.scope_entity_id
  if (assignment.scope_type === 'diocese') return assignment.diocese_id ?? null
  if (assignment.scope_type === 'pastoral_area') return assignment.pastoral_area_id ?? null
  if (assignment.scope_type === 'organization_unit') return assignment.organization_unit_id ?? null
  return null
}

function fallbackScopeLabel(scopeType: string, entityId: string | null) {
  const base = scopeLabels[scopeType] ?? 'Alcance administrativo'
  return entityId ? `${base} · ${entityId.slice(0, 8)}` : base
}

function scopeKey(scopeType: string, entityId: string | null) {
  return `${scopeType}:${entityId ?? 'all'}`
}

function scopePriority(scope: AdminNavigationScope) {
  const priorities: Record<string, number> = {
    global: 10,
    national: 20,
    diocese: 30,
    vicariate: 40,
    zone: 50,
    parish: 60,
    pastoral_area: 70,
    organization_unit: 80,
    entity: 90,
  }
  return priorities[scope.type] ?? 100
}

async function loadNames(
  supabase: SupabaseClient,
  table: 'ecclesiastical_entities' | 'structure_nodes' | 'pastoral_areas' | 'organization_units',
  ids: string[],
) {
  if (ids.length === 0) return new Map<string, string>()

  const { data, error } = await supabase
    .from(table)
    .select('id,name')
    .in('id', ids)

  if (error) return new Map<string, string>()

  return new Map(
    ((data ?? []) as NamedRow[])
      .filter((row) => typeof row.id === 'string' && typeof row.name === 'string' && row.name.trim())
      .map((row) => [row.id, row.name!.trim()]),
  )
}

async function resolveScopeNames(
  supabase: SupabaseClient,
  assignments: RawAssignment[],
) {
  const idsBySource = {
    ecclesiastical_entities: new Set<string>(),
    structure_nodes: new Set<string>(),
    pastoral_areas: new Set<string>(),
    organization_units: new Set<string>(),
  }

  for (const assignment of assignments) {
    const entityId = assignmentEntityId(assignment)
    if (!entityId) continue

    switch (assignment.scope_type) {
      case 'diocese':
      case 'parish':
        idsBySource.ecclesiastical_entities.add(entityId)
        break
      case 'vicariate':
      case 'zone':
        idsBySource.structure_nodes.add(entityId)
        break
      case 'pastoral_area':
        idsBySource.pastoral_areas.add(entityId)
        break
      case 'organization_unit':
        idsBySource.organization_units.add(entityId)
        break
      case 'entity':
        idsBySource.ecclesiastical_entities.add(entityId)
        idsBySource.structure_nodes.add(entityId)
        break
    }
  }

  const [entities, structures, pastorals, units] = await Promise.all([
    loadNames(supabase, 'ecclesiastical_entities', [...idsBySource.ecclesiastical_entities]),
    loadNames(supabase, 'structure_nodes', [...idsBySource.structure_nodes]),
    loadNames(supabase, 'pastoral_areas', [...idsBySource.pastoral_areas]),
    loadNames(supabase, 'organization_units', [...idsBySource.organization_units]),
  ])

  return new Map([...entities, ...structures, ...pastorals, ...units])
}

function collectPermissions(assignments: RawAssignment[]) {
  const permissionKeys = new Set<string>()
  const modules = new Set<string>()

  for (const assignment of assignments) {
    for (const role of asArray(assignment.roles)) {
      for (const rolePermission of asArray(role.role_permissions)) {
        for (const permission of asArray(rolePermission.permissions)) {
          if (permission.key) permissionKeys.add(permission.key)
          if (permission.module) modules.add(permission.module)
        }
      }
    }
  }

  return {
    permissionKeys: [...permissionKeys].sort(),
    modules: [...modules].sort(),
  }
}

export async function loadAdminNavigationContext(
  supabase: SupabaseClient,
): Promise<AdminNavigationContext> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    throw new Error('No se encontró una sesión administrativa activa.')
  }

  const [entryResponse, assignmentsResponse] = await Promise.all([
    supabase.rpc('get_my_admin_entry_context'),
    supabase
      .from('user_role_assignments')
      .select('role_id,scope_type,scope_entity_id,diocese_id,pastoral_area_id,organization_unit_id,starts_at,ends_at,status,roles(key,name,role_permissions(permissions(key,module)))')
      .eq('user_id', userData.user.id)
      .eq('status', 'active'),
  ])

  if (entryResponse.error) {
    throw new Error(entryResponse.error.message || 'No se pudo validar el acceso administrativo.')
  }
  if (assignmentsResponse.error) {
    throw new Error(assignmentsResponse.error.message || 'No se pudieron cargar los roles administrativos.')
  }

  const entryContext = normalizedEntryContext(entryResponse.data)
  const today = new Date().toISOString().slice(0, 10)
  const assignments = ((assignmentsResponse.data ?? []) as unknown as RawAssignment[])
    .filter((assignment) => isActiveAssignment(assignment, today))
  const names = await resolveScopeNames(supabase, assignments)
  const { permissionKeys, modules } = collectPermissions(assignments)
  const roles: AdminNavigationRole[] = []
  const scopes = new Map<string, AdminNavigationScope>()

  for (const assignment of assignments) {
    const role = asArray(assignment.roles)[0]
    const roleKey = role?.key ?? 'administrative_role'
    const scopeType = assignment.scope_type || 'entity'
    const entityId = assignmentEntityId(assignment)
    const isUnrestricted = unrestrictedRoleKeys.has(roleKey) || ['global', 'national'].includes(scopeType)
    const label = isUnrestricted
      ? fallbackScopeLabel(scopeType, null)
      : names.get(entityId ?? '') ?? fallbackScopeLabel(scopeType, entityId)
    const scope: AdminNavigationScope = {
      key: scopeKey(scopeType, entityId),
      type: scopeType,
      entityId,
      label,
      isUnrestricted,
    }

    scopes.set(scope.key, scope)
    roles.push({
      key: roleKey,
      name: role?.name ?? 'Rol administrativo',
      scopeType,
      scopeEntityId: entityId,
      scopeLabel: label,
      isUnrestricted,
    })
  }

  const availableScopes = [...scopes.values()].sort((first, second) => {
    const priorityDifference = scopePriority(first) - scopePriority(second)
    return priorityDifference || first.label.localeCompare(second.label, 'es')
  })
  const activeScope = availableScopes[0] ?? {
    key: 'none:all',
    type: 'none',
    entityId: null,
    label: 'Sin alcance administrativo activo',
    isUnrestricted: false,
  }

  return {
    userId: entryContext.user_id ?? userData.user.id,
    accessState: entryContext.access_state ?? 'no_role',
    profileStatus: entryContext.profile_status ?? 'unknown',
    roles,
    permissionKeys,
    modules,
    activeScope,
    availableScopes,
  }
}
