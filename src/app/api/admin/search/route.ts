import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/admin/authorization'

const MIN_QUERY_LENGTH = 2
const MAX_QUERY_LENGTH = 120
const DEFAULT_LIMIT = 30

function normalizeQuery(value: string | null) {
  return value?.trim().replace(/\s+/g, ' ') ?? ''
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminAccess({
    forbiddenMessage: 'Tu cuenta no tiene acceso administrativo activo.',
  })
  if (!auth.ok) return auth.response

  const query = normalizeQuery(request.nextUrl.searchParams.get('q'))
  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ query, results: [] })
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: 'La búsqueda no puede superar 120 caracteres.' }, { status: 400 })
  }

  const requestedLimit = Number(request.nextUrl.searchParams.get('limit'))
  const limit = Number.isInteger(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 60)
    : DEFAULT_LIMIT

  const { data, error } = await auth.supabase.rpc('admin_search_catalog', {
    p_query: query,
    p_limit: limit,
  })

  if (error) {
    console.error('Failed to execute canonical admin search', {
      userId: auth.user.id,
      message: error.message,
    })
    return NextResponse.json({ error: 'No se pudo completar la búsqueda administrativa.' }, { status: 500 })
  }

  return NextResponse.json({ query, results: data ?? [] })
}
