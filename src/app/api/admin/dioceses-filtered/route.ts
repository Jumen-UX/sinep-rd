import { requireAdminAccess } from '@/lib/admin/authorization'
import { filterEntitiesByScope, getUserScope } from '@/lib/admin/scopeUtils'
import { NextResponse } from 'next/server'

const JURISDICTION_TYPE_KEYS = [
  'archdiocese',
  'diocese',
  'apostolic_vicariate',
  'apostolic_prefecture',
  'territorial_prelature',
  'territorial_abbey',
  'apostolic_administration',
  'military_ordinariate',
  'personal_ordinariate',
  'mission_sui_iuris',
]

/**
 * GET /api/admin/dioceses-filtered
 *
 * Retorna jurisdicciones eclesiásticas accesibles para el usuario actual.
 * Conserva el nombre histórico del endpoint por compatibilidad.
 *
 * Query Parameters:
 * - include_children: boolean (default: true) - incluir jurisdicciones descendientes
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
    const parsedLimit = Number.parseInt(url.searchParams.get('limit') ?? '250', 10)
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 250
    const userId = auth.user!.id
    const scope = await getUserScope(auth.supabase, userId)

    let query = auth.supabase
      .from('ecclesiastical_entities')
      .select('id,name,official_name,slug,entity_type_id,entity_types!inner(key)')
      .eq('status', 'active')
      .in('entity_types.key', JURISDICTION_TYPE_KEYS)

    if (!scope.isUnrestricted) {
      const scopedEntities = await filterEntitiesByScope(auth.supabase, userId, {
        includeChildren,
        limit: 500,
      })
      const scopedIds = scopedEntities.map((entity) => entity.id)

      if (scopedIds.length === 0) {
        return NextResponse.json({ dioceses: [], count: 0, filtered: true })
      }

      query = query.in('id', scopedIds)
    }

    const { data, error } = await query.order('name').limit(limit)
    if (error) throw error

    const dioceses = data ?? []
    return NextResponse.json({
      dioceses,
      count: dioceses.length,
      filtered: true,
    })
  } catch (error) {
    console.error('Error fetching filtered dioceses:', error)
    return NextResponse.json(
      { error: 'Error loading dioceses' },
      { status: 500 },
    )
  }
}
