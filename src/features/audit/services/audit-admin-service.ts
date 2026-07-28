import type { SupabaseClient } from '@supabase/supabase-js'
import { createCsv, downloadCsv } from '@/lib/csv'

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

export function createAdministrativeActivityCsv(rows: readonly ActivityRow[]) {
  return createCsv(
    ['Fecha', 'Usuario', 'Correo', 'Acción', 'Tabla', 'Identificador'],
    rows.map((row) => [
      row.created_at,
      row.actor_name,
      row.actor_email,
      row.action,
      row.target_table,
      row.target_id,
    ]),
  )
}

export function downloadAdministrativeActivityCsv(rows: readonly ActivityRow[]) {
  const date = new Date().toISOString().slice(0, 10)
  downloadCsv(`actividad-administrativa-${date}.csv`, createAdministrativeActivityCsv(rows))
}
