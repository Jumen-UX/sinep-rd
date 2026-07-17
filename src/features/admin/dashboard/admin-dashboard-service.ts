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
  active_pastoral_areas: number
  pending_change_requests: number
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
  activities: DashboardActivity[]
}

type AuditRow = Omit<DashboardActivity, 'actor_name'>

function throwIfError(error: { message: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback)
}

export async function loadAdminDashboardData(supabase: SupabaseClient): Promise<AdminDashboardData> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('AUTH_REQUIRED')

  const userId = userData.user.id
  const [profileResponse, roleResponse, summaryResponse, assignmentResponse, peopleResponse, auditResponse] = await Promise.all([
    supabase.from('profiles').select('id,full_name,email').eq('id', userId).maybeSingle(),
    supabase.from('user_role_assignments').select('scope_type,status,roles(key,name)').eq('user_id', userId).eq('status', 'active'),
    supabase.from('admin_dashboard_summary').select('active_entities,active_dioceses,active_pastoral_areas,pending_change_requests').maybeSingle(),
    supabase.from('position_assignments').select('id', { count: 'exact', head: true }).eq('is_current', true).eq('assignment_status', 'active'),
    supabase.from('persons').select('id', { count: 'exact', head: true }),
    supabase.from('admin_audit_log').select('id,actor_user_id,action,target_table,target_id,metadata,created_at').order('created_at', { ascending: false }).limit(5),
  ])

  throwIfError(roleResponse.error, 'No se pudieron cargar los roles activos.')

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
    summary: summaryResponse.error ? null : (summaryResponse.data as DashboardSummary | null),
    activeAssignments: assignmentResponse.error ? null : assignmentResponse.count ?? 0,
    peopleCount: peopleResponse.error ? null : peopleResponse.count ?? 0,
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
