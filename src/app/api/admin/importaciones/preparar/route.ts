import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'

const allowedImportTypes = new Set(['personas', 'parroquias', 'asignaciones', 'eventos'])
const allowedExtensions = new Set(['csv', 'xlsx', 'xls'])
const sha256Pattern = /^[0-9a-f]{64}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string')
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminAccess({
    permissionKey: 'imports.prepare',
    forbiddenMessage: 'No autorizado para preparar importaciones por lotes.',
  })
  if (!auth.ok) return auth.response

  try {
    const payload: unknown = await request.json()
    if (!isRecord(payload)) {
      return NextResponse.json({ error: 'La solicitud de importación es inválida.' }, { status: 400 })
    }

    const importType = typeof payload.import_type === 'string' ? payload.import_type : ''
    const file = payload.file
    const rows = payload.rows
    const headers = payload.headers

    if (!allowedImportTypes.has(importType)) {
      return NextResponse.json({ error: 'El tipo de importación no está permitido.' }, { status: 400 })
    }

    if (!isRecord(file)) {
      return NextResponse.json({ error: 'Faltan los metadatos del archivo.' }, { status: 400 })
    }

    const extension = typeof file.extension === 'string' ? file.extension.toLowerCase() : ''
    const sizeBytes = typeof file.size_bytes === 'number' ? file.size_bytes : Number.NaN
    const sha256 = typeof file.sha256 === 'string' ? file.sha256.toLowerCase() : ''

    if (
      typeof file.name !== 'string'
      || !file.name.trim()
      || !allowedExtensions.has(extension)
      || !Number.isSafeInteger(sizeBytes)
      || sizeBytes < 0
      || sizeBytes > 10 * 1024 * 1024
      || !sha256Pattern.test(sha256)
    ) {
      return NextResponse.json({ error: 'Los metadatos del archivo no son válidos.' }, { status: 400 })
    }

    if (!Array.isArray(headers) || headers.length === 0 || !headers.every((header) => typeof header === 'string' && header.trim())) {
      return NextResponse.json({ error: 'El encabezado del archivo no es válido.' }, { status: 400 })
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'El archivo no contiene filas para preparar.' }, { status: 400 })
    }

    if (rows.length > 5000) {
      return NextResponse.json({ error: 'El lote supera el límite inicial de 5,000 filas.' }, { status: 400 })
    }

    if (!rows.every(isStringRecord)) {
      return NextResponse.json({ error: 'Todas las filas deben contener únicamente columnas y valores de texto.' }, { status: 400 })
    }

    const rpcPayload = {
      ...payload,
      import_type: importType,
      file: {
        ...file,
        extension,
        size_bytes: sizeBytes,
        sha256,
      },
      headers,
      rows,
    }

    const { data, error } = await auth.supabase.rpc('admin_prepare_import_batch', {
      payload: rpcPayload,
    })

    if (error) {
      console.error('Failed to prepare import batch', error)
      return NextResponse.json(
        { error: toSpanishAdminError(error, 'No se pudo preparar el lote de importación.') },
        { status: 400 },
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected import batch preparation error', error)
    return NextResponse.json({ error: 'No se pudo preparar el lote de importación.' }, { status: 500 })
  }
}
