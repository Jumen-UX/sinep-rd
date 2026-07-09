import { NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'

export async function GET() {
  try {
    const auth = await requireAdminAccess()
    if (!auth.ok) return auth.response

    const { data, error } = await auth.supabase.rpc('admin_review_queue', { payload: { limit: 200 } })

    if (error) {
      console.error('Failed to load admin review queue', error)
      return NextResponse.json({ error: toSpanishAdminError(error, 'No se pudo cargar la cola de revisión.') }, { status: 400 })
    }

    return NextResponse.json({ items: data ?? [] })
  } catch (error) {
    console.error('Unexpected admin review queue API error', error)
    return NextResponse.json({ error: 'No se pudo cargar la cola de revisión.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminAccess()
    if (!auth.ok) return auth.response

    const body = await request.json().catch(() => null) as {
      assignment_id?: string
      decision?: 'approve_internal' | 'publish' | 'needs_correction' | 'dispute' | 'keep_internal'
      notes?: string
      publish_person?: boolean
    } | null

    if (!body?.assignment_id || !body?.decision) {
      return NextResponse.json({ error: 'Faltan assignment_id o decision.' }, { status: 400 })
    }

    const { data, error } = await auth.supabase.rpc('admin_review_imported_appointment', {
      payload: {
        assignment_id: body.assignment_id,
        decision: body.decision,
        notes: body.notes ?? null,
        publish_person: body.publish_person ?? false,
      },
    })

    if (error) {
      console.error('Failed to review imported appointment', error)
      return NextResponse.json({ error: toSpanishAdminError(error, 'No se pudo actualizar el nombramiento importado.') }, { status: 400 })
    }

    return NextResponse.json({ result: data })
  } catch (error) {
    console.error('Unexpected imported appointment review API error', error)
    return NextResponse.json({ error: 'No se pudo actualizar el nombramiento importado.' }, { status: 500 })
  }
}
