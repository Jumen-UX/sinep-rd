import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/admin/authorization'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAccess()
    if (!auth.ok) return auth.response

    const body = await request.json() as {
      action?: 'preview' | 'update'
      office_configuration_id?: string
      payload?: Record<string, unknown>
    }

    if (!body.office_configuration_id || !body.payload) {
      return NextResponse.json({ error: 'Falta el cargo o las reglas propuestas.' }, { status: 400 })
    }

    const functionName = body.action === 'update'
      ? 'admin_update_office_configuration'
      : 'admin_preview_office_rule_change'

    const { data, error } = await auth.supabase.rpc(functionName, {
      p_office_configuration_id: body.office_configuration_id,
      payload: body.payload,
    })

    if (error) {
      console.error('Failed to process office rule change', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected office edit API error', error)
    return NextResponse.json({ error: 'No se pudo procesar la edición del cargo.' }, { status: 500 })
  }
}
