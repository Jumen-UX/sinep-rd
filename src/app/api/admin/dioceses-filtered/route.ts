import { requireAdminAccess } from '@/lib/admin/authorization'
import { filterEntitiesByScope } from '@/lib/admin/scopeUtils'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/dioceses-filtered
 *
 * Retorna lista de diócesis accesibles para el usuario actual.
 * Filtra por scope y jerarquía.
 *
 * Query Parameters:
 * - include_children: boolean (default: true) - incluir diócesis hijas
 * - limit: number (default: 250) - límite de resultados
 *
 * Response:
 * - 200: { dioceses: Entity[] }
 * - 403: { error: "Not authorized" }
 * - 500: { error: "Server error" }
 */
export async function GET(request: Request) {
  const auth = await requireAdminAccess()
  if (!auth.ok) return auth.response

  try {
    const url = new URL(request.url)
    const includeChildren = url.searchParams.get('include_children') !== 'false'
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '250'), 500)

    // Get dioceses filtered by user's scope
    const dioceses = await filterEntitiesByScope(auth.supabase, auth.user!.id, {
      limit,
    })

    return NextResponse.json({
      dioceses,
      count: dioceses.length,
      filtered: true,
    })
  } catch (error) {
    console.error('Error fetching filtered dioceses:', error)
    return NextResponse.json(
      { error: 'Error loading dioceses' },
      { status: 500 }
    )
  }
}
