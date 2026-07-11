import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type RouteContext = {
  params: Promise<{ rowId: string }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAdminAccess({
    permissionKey: 'imports.prepare',
    forbiddenMessage: 'No autorizado para corregir filas de importación.',
  })
  if (!auth.ok) return auth.response

  const { rowId } = await context.params
  if (!uuidPattern.test(rowId)) {
    return NextResponse.json({ error: 'El identificador de la fila no es válido.' }, { status: 400 })
  }

  try {
    const body: unknown = await request.json()
    if (!isRecord(body) || !isRecord(body.normalized_data)) {
      return NextResponse.json({ error: 'La corrección debe contener un objeto normalized_data.' }, { status: 400 })
    }

    const normalizedData = Object.fromEntries(
      Object.entries(body.normalized_data).map(([key, value]) => [
        key.trim().toLowerCase(),
        typeof value === 'string' ? value : String(value ?? ''),
      ]),
    )

    if (Object.keys(normalizedData).length === 0 || Object.keys(normalizedData).some((key) => !key)) {
      return NextResponse.json({ error: 'La corrección no contiene columnas válidas.' }, { status: 400 })
    }

    const { data, error } = await auth.supabase.rpc('admin_update_import_batch_row', {
      p_row_id: rowId,
      p_normalized_data: normalizedData,
    })

    if (error) {
      console.error('Failed to update import batch row', error)
      return NextResponse.json(
        { error: toSpanishAdminError(error, 'No se pudo corregir la fila de importación.') },
        { status: 400 },
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected import row update error', error)
    return NextResponse.json({ error: 'No se pudo corregir la fila de importación.' }, { status: 500 })
  }
}
