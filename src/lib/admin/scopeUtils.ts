/**
 * Scope Management Utilities for P1 Jurisdiction-based Permissions
 * 
 * These utilities help UI components:
 * 1. Obtain the current user's jurisdiction scope
 * 2. Filter entity lists based on scope
 * 3. Validate that selected entities are within scope
 */

import { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface UserScope {
  userId: string
  scopeType: string | null
  scopeEntityId: string | null
  scopeName: string | null
  isUnrestricted: boolean // true for super_admin, national_admin
}

export interface ScopeOption {
  scopeType: string
  scopeEntityId: string | null
  label: string
  dioceseId: string | null
  parentId: string | null
}

/**
 * Get the current user's jurisdiction scope
 * 
 * Returns:
 * - scope_type: The level of restriction (diocese, vicariate, etc.)
 * - scope_entity_id: The entity UUID restricting the user
 * - isUnrestricted: True if user is super_admin or national_admin
 */
export async function getUserScope(
  supabase: SupabaseServerClient,
  userId: string
): Promise<UserScope> {
  try {
    // Try to get scope via RPC (includes validation of active role)
    const { data: rootJurisdiction, error: rpcError } = await supabase
      .rpc('current_user_root_jurisdiction_id')

    // Query user_role_assignments directly for scope details
    const { data: assignments, error: assignError } = await supabase
      .from('user_role_assignments')
      .select(
        `
        user_id,
        scope_type,
        scope_entity_id,
        role_id,
        roles (
          id,
          key
        )
      `
      )
      .eq('user_id', userId)
      .eq('status', 'active')
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (assignError || !assignments) {
      return {
        userId,
        scopeType: null,
        scopeEntityId: null,
        scopeName: null,
        isUnrestricted: false,
      }
    }

    // Check if user is unrestricted (super_admin or national_admin)
    const roleKey = assignments.role_id
      ? assignments.roles?.[0]?.key ?? null
      : null
    const isUnrestricted =
      roleKey === 'super_admin' || roleKey === 'national_admin'

    // If unrestricted, return empty scope
    if (isUnrestricted) {
      return {
        userId,
        scopeType: assignments.scope_type,
        scopeEntityId: null,
        scopeName: null,
        isUnrestricted: true,
      }
    }

    // Get entity name for restricted users
    let scopeName = null
    if (assignments.scope_entity_id) {
      if (assignments.scope_type === 'organization_unit') {
        const { data: unit } = await supabase
.from('organization_units')
.select('name')
.eq('id', assignments.scope_entity_id)
.single()
        scopeName = unit?.name || null
      } else {
        const { data: entity } = await supabase
.from('ecclesiastical_entities')
.select('name')
.eq('id', assignments.scope_entity_id)
.single()
        scopeName = entity?.name || null
      }
    }

    return {
      userId,
      scopeType: assignments.scope_type,
      scopeEntityId: assignments.scope_entity_id,
      scopeName,
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

/**
 * Get available scope options for the current user
 * Used to populate filter dropdowns
 */
export async function getScopeOptionsForUser(
  supabase: SupabaseServerClient
): Promise<ScopeOption[]> {
  try {
    const { data, error } = await supabase
      .rpc('admin_list_role_scope_options', {
        p_scope_type: null,
      })

    if (error || !data) {
      console.error('Error getting scope options:', error)
      return []
    }

    return data as ScopeOption[]
  } catch (error) {
    console.error('Error in getScopeOptionsForUser:', error)
    return []
  }
}

/**
 * Filter ecclesiastical_entities by user scope
 * 
 * Usage:
 *   const filtered = await filterEntitiesByScope(supabase, userId)
 */
export async function filterEntitiesByScope(
  supabase: SupabaseServerClient,
  userId: string,
  options?: {
    entityTypeKey?: string
    includeChildren?: boolean
    limit?: number
  }
) {
  const scope = await getUserScope(supabase, userId)
  const selectColumns = options?.entityTypeKey
    ? 'id, name, official_name, slug, entity_type_id, entity_types!inner(key)'
    : 'id, name, official_name, slug, entity_type_id'

  // If unrestricted, return all entities (or filtered by type)
  if (scope.isUnrestricted) {
    let query = supabase
      .from('ecclesiastical_entities')
      .select(selectColumns)
      .eq('status', 'active')

    if (options?.entityTypeKey) {
      query = query.eq('entity_types.key', options.entityTypeKey)
    }

    const { data } = await query
      .order('name')
      .limit(options?.limit ?? 250)

    return data || []
  }

  // If restricted by entity, get entity + descendants
  if (scope.scopeEntityId) {
    // Get the scope entity
    let scopeQuery = supabase
      .from('ecclesiastical_entities')
      .select(selectColumns)
      .eq('id', scope.scopeEntityId)
      .eq('status', 'active')

    if (options?.entityTypeKey) {
      scopeQuery = scopeQuery.eq('entity_types.key', options.entityTypeKey)
    }

    const { data: scopeEntity } = await scopeQuery
      .single()

    if (!options?.includeChildren) {
      return scopeEntity ? [scopeEntity] : []
    }

    // Get all descendants (children)
    const { data: descendants } = await supabase
      .rpc('get_entity_descendants', {
        p_entity_id: scope.scopeEntityId,
        p_max_depth: 10,
      })

    if (!descendants || descendants.length === 0) {
      return scopeEntity ? [scopeEntity] : []
    }

    // Combine scope entity with descendants
    const allEntityIds = [
      scope.scopeEntityId,
      ...descendants.map((d: { id: string }) => d.id),
    ]

    let allEntitiesQuery = supabase
      .from('ecclesiastical_entities')
      .select(selectColumns)
      .in('id', allEntityIds)
      .eq('status', 'active')

    if (options?.entityTypeKey) {
      allEntitiesQuery = allEntitiesQuery.eq('entity_types.key', options.entityTypeKey)
    }

    const { data: allEntities } = await allEntitiesQuery
      .order('name')

    return allEntities || []
  }

  // No scope -> return empty
  return []
}

/**
 * Validate that an entity is within user's scope
 * 
 * Useful in client-side to prevent sending invalid selection to RPC
 */
export async function isEntityInUserScope(
  supabase: SupabaseServerClient,
  userId: string,
  entityId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('current_user_has_scope_for_entity', {
        p_entity_id: entityId,
      })

    if (error) {
      console.error('Error validating entity scope:', error)
      return false
    }

    return data === true
  } catch (error) {
    console.error('Error in isEntityInUserScope:', error)
    return false
  }
}

/**
 * Helper for React components to filter options in a select/combobox
 * 
 * Usage in component:
 *   const scope = await getUserScope(supabase, userId)
 *   const options = await getFilteredJurisdictionOptions(supabase, scope)
 */
export async function getFilteredJurisdictionOptions(
  supabase: SupabaseServerClient,
  userScope: UserScope,
  options?: {
    includeChildren?: boolean
    limit?: number
  }
) {
  if (userScope.isUnrestricted) {
    // Super/national admin can select any entity
    const { data } = await supabase
      .from('ecclesiastical_entities')
      .select('id, name, official_name, slug')
      .eq('status', 'active')
      .order('name')
      .limit(options?.limit ?? 500)

    return data || []
  }

  if (!userScope.scopeEntityId) {
    return []
  }

  // Restricted user - include root + children if flag set
  const { data: root } = await supabase
    .from('ecclesiastical_entities')
    .select('id, name, official_name, slug')
    .eq('id', userScope.scopeEntityId)
    .eq('status', 'active')
    .single()

  if (!root) return []

  if (!options?.includeChildren) {
    return [root]
  }

  // Get children
  const { data: children } = await supabase
    .rpc('get_entity_descendants', {
      p_entity_id: userScope.scopeEntityId,
      p_max_depth: 3,
    })

  if (!children || children.length === 0) {
    return [root]
  }

  const childIds = children.map((c: { id: string }) => c.id)

  const { data: childEntities } = await supabase
    .from('ecclesiastical_entities')
    .select('id, name, official_name, slug')
    .in('id', childIds)
    .eq('status', 'active')
    .order('name')
    .limit(options?.limit ?? 500)

  return [root, ...(childEntities || [])]
}

/**
 * Get human-readable scope label
 * 
 * Example: { scopeType: 'diocese', scopeName: 'Santo Domingo' }
 * Returns: "Diócesis: Santo Domingo"
 */
export function getScopeLabel(scope: UserScope): string {
  if (scope.isUnrestricted) {
    return 'Acceso Nacional (Sin restricción)'
  }

  if (!scope.scopeType || !scope.scopeName) {
    return 'Sin acceso definido'
  }

  const typeLabels: Record<string, string> = {
    national: 'Nacional',
    diocese: 'Diócesis',
    vicariate: 'Vicariato',
    zone: 'Zona Pastoral',
    parish: 'Parroquia',
    pastoral_area: 'Área Pastoral',
    organization_unit: 'Unidad organizativa',
    entity: 'Entidad',
  }

  const typeLabel = typeLabels[scope.scopeType] || scope.scopeType

  return `${typeLabel}: ${scope.scopeName}`
}
