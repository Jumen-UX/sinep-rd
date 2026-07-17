import type { SupabaseClient } from '@supabase/supabase-js'

export type DashboardProfile = {
  id?: string
  full_name: string | null
  email: string | null
}

export type DashboardRoleInfo = {
  key: string
  name: string
}

export type DashboardRoleRow = {
  scope_type: string | null
  status: string
  roles: DashboardRoleInfo[] | DashboardRoleInfo | null
}

export type DashboardSummary = {
  active_entities: number
  active_dioceses: number
  active_parishes: number
  active_people: number
  active_priests: number
  active_deacons: number
  bishops_and_emeriti: number
  active_pastoral_areas: number
  active_organization_units: number
  pending_change_requests: number
  pending_documents: number
}

export type DashboardActivity = {
  id: string
  actor_user_id: string
  actor_name: string
  action: string
  target_table: string | null
  target_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export type AdminDashboardData = {
  profile: DashboardProfile
  roles: DashboardRoleRow[]
  summary: DashboardSummary | null
  peopleCount: number | null
  activeAssignments: number | null
  contextualKpis: Record<string, number> | null
  activities: DashboardActivity[]
}

export type AdminDashboardLoadOptions = {
  includeGlobalMetrics: boolean
  includeActivity: boolean
  activeScopeType: string | null
  activeScopeEntityId: string | null
}

type AuditRow = Omit<DashboardActivity, 'actor_name'>

const contextualEntityScopeTypes = new Set(['diocese', 'parish', 'entity'])

function throwIfError(error: { message: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback)
}

function normalizeContextualKpis(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const entries = Object.entries(value).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]),
  )
  return entries.length > 0 ? Object.fromEntries(entries) : null
}

export async function loadAdminDashboardData(
  supabase: SupabaseClient,
  options: AdminDashboardLoadOptions,
): Promise<AdminDashboardData> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('AUTH_REQUIRED')

  const userId = userData.user.id
  const [profileResponse, roleResponse, auditResponse] = await Promise.all([
    supabase.from('profiles').select('id,full_name,email').eq('id', userId).maybeSingle(),
    supabase.from('user_role_assignments').select('scope_type,status,roles(key,name)').eq('user_id', userId).eq('status', 'active'),
    options.includeActivity
      ? supabase.from('admin_audit_log').select('id,actor_user_id,action,target_table,target_id,metadata,created_at').order('created_at', { ascending: false }).limit(5)
      : Promise.resolve({ data: [], error: null }),
  ])

  throwIfError(roleResponse.error, 'No se pudieron cargar los roles activos.')

  let summary: DashboardSummary | null = null
  let activeAssignments: number | null = null
  let peopleCount: number | null = null
  let contextualKpis: Record<string, number> | null = null

  if (options.includeGlobalMetrics) {
    const [summaryResponse, assignmentResponse, peopleResponse] = await Promise.all([
      supabase
        .from('admin_dashboard_summary')
        .select('active_entities,active_dioceses,active_parishes,active_people,active_priests,active_deacons,bishops_and_emeriti,active_pastoral_areas,active_organization_units,pending_change_requests,pending_documents')
        .maybeSingle(),
      supabase.from('position_assignments').select('id', { count: 'exact', head: true }).eq('is_current', true).eq('assignment_status', 'active'),
      supabase.from('persons').select('id', { count: 'exact', head: true }),
    ])

    summary = summaryResponse.error ? null : (summaryResponse.data as DashboardSummary | null)
    activeAssignments = assignmentResponse.error ? null : assignmentResponse.count ?? 0
    peopleCount = peopleResponse.error ? null : peopleResponse.count ?? 0
  } else if (
    options.activeScopeEntityId
    && options.activeScopeType
    && contextualEntityScopeTypes.has(options.activeScopeType)
  ) {
    const { data, error } = await supabase.rpc('get_admin_contextual_kpis', {
      p_scope_type: options.activeScopeType,
      p_scope_entity_id: options.activeScopeEntityId,
    })
    throwIfError(error, 'No se pudieron cargar los indicadores del alcance activo.')
    contextualKpis = normalizeContextualKpis(data)
  }

  const auditRows = (auditResponse.data ?? []) as AuditRow[]
  const actorIds = Array.from(new Set(auditRows.map((row) => row.actor_user_id).filter(Boolean)))
  const actorProfiles = new Map<string, string>()

  if (actorIds.length > 0) {
    const { data: actors, error: actorError } = await supabase.from('profiles').select('id,full_name,email').in('id', actorIds)
    if (!actorError) {
      for (const actor of actors ?? []) {
        const typedActor = actor as DashboardProfile & { id: string }
        actorProfiles.set(typedActor.id, typedActor.full_name ?? typedActor.email ?? 'Usuario administrativo')
      }
    }
  }

  return {
    profile: (profileResponse.data as DashboardProfile | null) ?? {
      id: userId,
      full_name: userData.user.email ?? null,
      email: userData.user.email ?? null,
    },
    roles: (roleResponse.data ?? []) as unknown as DashboardRoleRow[],
    summary,
    activeAssignments,
    peopleCount,
    contextualKpis,
    activities: auditRows.map((row) => ({
      ...row,
      actor_name: actorProfiles.get(row.actor_user_id) ?? 'Usuario administrativo',
    })),
  }
}

export async function signOutAdminDashboard(supabase: SupabaseClient) {
  const { error } = await supabase.auth.signOut()
  throwIfError(error, 'No se pudo cerrar la sesión.')
}
