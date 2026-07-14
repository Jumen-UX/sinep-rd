import type { SupabaseClient } from '@supabase/supabase-js'

export type ActivityRow = {
  id: string
  actor_email: string | null
  actor_name: string | null
  action: string
  target_table: string
  target_id: string | null
  created_at: string
}

export async function loadRecentAdministrativeActivity(
  supabase: SupabaseClient,
  limit = 150,
): Promise<ActivityRow[] | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError) throw new Error(userError.message)
  if (!userData.user) return null

  const { data, error } = await supabase.rpc('admin_list_recent_audit_logs', {
    p_limit: limit,
  })

  if (error) throw new Error(error.message)
  return (data ?? []) as ActivityRow[]
}
