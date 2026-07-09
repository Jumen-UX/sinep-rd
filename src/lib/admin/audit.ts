import { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

type AdminAuditEvent = {
  action: string
  targetTable?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown>
}

export async function recordAdminAudit(supabase: SupabaseServerClient, event: AdminAuditEvent) {
  try {
    const { error } = await supabase.rpc('admin_write_audit_log', {
      p_action: event.action,
      p_target_table: event.targetTable ?? null,
      p_target_id: event.targetId ?? null,
      p_metadata: event.metadata ?? {},
    })

    if (error) {
      console.error('Failed to record admin audit event', {
        action: event.action,
        targetTable: event.targetTable,
        targetId: event.targetId,
        error,
      })
    }
  } catch (error) {
    console.error('Unexpected admin audit error', {
      action: event.action,
      targetTable: event.targetTable,
      targetId: event.targetId,
      error,
    })
  }
}
