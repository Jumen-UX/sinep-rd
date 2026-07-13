import { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface UserScope {
  userId: string
  scopeType: string | null
  scopeEntityId: string | null
  scopeName: string | null
  isUnrestricted: boolean
}

export interface ScopeOption {
  scopeType: string
  scopeEntityId: string | null
  label: string
  dioceseId: string | null
  parentId: string | null
}

type RoleRelation = { id: string; key: string }

type ScopeAssignment = {
  user_id: string
  scope_type: string
  scope_entity_id: string | null
  role_id: string | null
  roles: RoleRelation[] | RoleRelation | null
}

function roleKeyFromAssignment(assignment: ScopeAssignment) {
  if (!assignment.role_id || !assignment.roles) return null
  return Array.isArray(assignment.roles)
    ? assignment.roles[0]?.key ?? null
    : assignment.roles.key
}

async function scopeNameForAssignment(
  supabase: SupabaseServerClient,
  assignment: ScopeAssignment,
) {
  if (!assignment.scope_entity_id) return null

  if (assignment.scope_type === 'organization_unit') {
    const { data } = await supabase
      .from('organization_units')
      .select('name')
      .eq('id', assignment.scope_entity_id)
      .maybeSingle()
    return data?.name ?? null
  }

  if (assignment.scope_type === 'pastoral_area') {
    const { data } = await supabase
      .from('pastoral_areas')
      .select('name')
      .eq('id', assignment.scope_entity_id)
      .maybeSingle()
    return data?.name ?? null
  }

  const { data } = await supabase
    .from('ecclesiastical_entities')
    .select('name')
    .eq('id', assignment.scope_entity_id)
    .maybeSingle()
  return data?.name ?? null
}

export async function getUserScope(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<UserScope> {
  try {
    const { data, error } = await supabase
      .from('user_role_assignments')
      .select('user_id,scope_type,scope_entity_id,role_id,roles(id,key)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .lte('starts_at', new Date().toISOString().slice(0, 10))
      .or(`ends_at.is.null,ends_at.gte.${new Date().toISOString().slice(0, 10)}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      return {
        userId,
        scopeType: null,
        scopeEntityId: null,
        scopeName: null,
        isUnrestricted: false,
      }
    }

    const assignment = data as unknown as ScopeAssignment
    const roleKey = roleKeyFromAssignment(assignment)
    const isUnrestricted = roleKey === 'super_admin' || roleKey === 'national_admin'

    return {
      userId,
      scopeType: assignment.scope_type,
      scopeEntityId: isUnrestricted ? null : assignment.scope_entity_id,
      scopeName: isUnrestricted ? null : await scopeNameForAssignment(supabase, assignment),
      isUnrestricted,
    }
  } catch (error) {
    console.error('Error getting user scope:', error)
    return {
      userId,
      scopeType: null,
      scopeEntityId: null,
      scopeName: null,
      isUnrestricted: false,
    }
  }
}

export async function getScopeOptionsForUser(
  supabase: SupabaseServerClient,
): Promise<ScopeOption[]> {
  try {
    const { data, error } = await supabase.rpc('admin_list_role_scope_options', {
      p_scope_type: null,
    })

    if (error || !data) {
      console.error('Error getting scope options:', error)
      return []
    }

    return (data as Array<{
      scope_type: string
      scope_entity_id: string | null
      label: string
      diocese_id: string | null
      parent_id: string | null
    }>).map((item) => ({
      scopeType: item.scope_type,
      scopeEntityId: item.scope_entity_id,
      label: item.label,
      dioceseId: item.diocese_id,
      parentId: item.parent_id,
    }))
  } catch (error) {
    console.error('Error in getScopeOptionsForUser:', error)
    return []
  }
}

export async function filterEntitiesByScope(
  supabase: SupabaseServerClient,
  userId: string,
  options?: {
    entityTypeKey?: string
    includeChildren?: boolean
    limit?: number
  },
) {
  const scope = await getUserScope(supabase, userId)
  const selectColumns = options?.entityTypeKey
    ? 'id,name,official_name,slug,entity_type_id,entity_types!inner(key)'
    : 'id,name,official_name,slug,entity_type_id'

  if (scope.isUnrestricted) {
    let query = supabase
      .from('ecclesiastical_entities')
      .select(selectColumns)
      .eq('status', 'active')

    if (options?.entityTypeKey) {
      query = query.eq('entity_types.key', options.entityTypeKey)
    }

    const { data } = await query.order('name').limit(options?.limit ?? 250)
    return data ?? []
  }

  if (!scope.scopeEntityId || scope.scopeType === 'organization_unit' || scope.scopeType === 'pastoral_area') {
    return []
  }

  let scopeQuery = supabase
    .from('ecclesiastical_entities')
    .select(selectColumns)
    .eq('id', scope.scopeEntityId)
    .eq('status', 'active')

  if (options?.entityTypeKey) {
    scopeQuery = scopeQuery.eq('entity_types.key', options.entityTypeKey)
  }

  const { data: scopeEntity } = await scopeQuery.single()
  if (!options?.includeChildren) return scopeEntity ? [scopeEntity] : []

  const { data: descendants } = await supabase.rpc('get_entity_descendants', {
    p_entity_id: scope.scopeEntityId,
    p_max_depth: 10,
  })

  if (!descendants?.length) return scopeEntity ? [scopeEntity] : []

  const allEntityIds = [
    scope.scopeEntityId,
    ...descendants.map((item: { id: string }) => item.id),
  ]

  let allEntitiesQuery = supabase
    .from('ecclesiastical_entities')
    .select(selectColumns)
    .in('id', allEntityIds)
    .eq('status', 'active')

  if (options?.entityTypeKey) {
    allEntitiesQuery = allEntitiesQuery.eq('entity_types.key', options.entityTypeKey)
  }

  const { data: allEntities } = await allEntitiesQuery.order('name')
  return allEntities ?? []
}

export async function isEntityInUserScope(
  supabase: SupabaseServerClient,
  userId: string,
  entityId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('current_user_has_scope_for_entity', {
      p_entity_id: entityId,
    })

    if (error) {
      console.error(`Error validating entity scope for ${userId}:`, error)
      return false
    }

    return data === true
  } catch (error) {
    console.error('Error in isEntityInUserScope:', error)
    return false
  }
}

export async function getFilteredJurisdictionOptions(
  supabase: SupabaseServerClient,
  userScope: UserScope,
  options?: {
    includeChildren?: boolean
    limit?: number
  },
) {
  if (userScope.isUnrestricted) {
    const { data } = await supabase
      .from('ecclesiastical_entities')
      .select('id,name,official_name,slug')
      .eq('status', 'active')
      .order('name')
      .limit(options?.limit ?? 500)

    return data ?? []
  }

  if (!userScope.scopeEntityId || userScope.scopeType === 'organization_unit' || userScope.scopeType === 'pastoral_area') {
    return []
  }

  const { data: root } = await supabase
    .from('ecclesiastical_entities')
    .select('id,name,official_name,slug')
    .eq('id', userScope.scopeEntityId)
    .eq('status', 'active')
    .single()

  if (!root) return []
  if (!options?.includeChildren) return [root]

  const { data: children } = await supabase.rpc('get_entity_descendants', {
    p_entity_id: userScope.scopeEntityId,
    p_max_depth: 3,
  })

  if (!children?.length) return [root]

  const childIds = children.map((item: { id: string }) => item.id)
  const { data: childEntities } = await supabase
    .from('ecclesiastical_entities')
    .select('id,name,official_name,slug')
    .in('id', childIds)
    .eq('status', 'active')
    .order('name')
    .limit(options?.limit ?? 500)

  return [root, ...(childEntities ?? [])]
}

export function getScopeLabel(scope: UserScope): string {
  if (scope.isUnrestricted) return 'Acceso Nacional (Sin restricción)'
  if (!scope.scopeType || !scope.scopeName) return 'Sin acceso definido'

  const typeLabels: Record<string, string> = {
    national: 'Nacional',
    diocese: 'Diócesis',
    vicariate: 'Vicariato',
    zone: 'Zona Pastoral',
    parish: 'Parroquia',
    pastoral_area: 'Área Pastoral',
    organization_unit: 'Unidad Organizativa',
    entity: 'Entidad',
  }

  return `${typeLabels[scope.scopeType] ?? scope.scopeType}: ${scope.scopeName}`
}
