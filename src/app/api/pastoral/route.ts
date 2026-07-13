import { NextRequest, NextResponse } from 'next/server'
import { fetchSupabaseJson } from '@/lib/supabase/rest'

const columns = [
  'id',
  'name',
  'slug',
  'description',
  'organization_chart_name',
  'organization_chart_key',
  'parent_unit_name',
  'parent_unit_slug',
  'ecclesiastical_entity_name',
  'ecclesiastical_entity_slug',
  'pastoral_area_name',
  'pastoral_area_slug',
  'valid_from',
  'valid_to',
  'is_current',
  'status',
  'visibility',
].join(',')

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')

  if (!slug) {
    return NextResponse.json({ error: 'Falta el identificador de la unidad organizativa' }, { status: 400 })
  }

  try {
    const rows = await fetchSupabaseJson<Record<string, unknown>[]>('public_organization_units', {
      slug: `eq.${slug}`,
      status: 'eq.active',
      visibility: 'eq.public',
      select: columns,
      limit: '1',
    })

    const item = rows[0]
    if (!item) {
      return NextResponse.json({ error: 'Unidad organizativa no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Unexpected organization unit API error', error)
    return NextResponse.json({ error: 'No se pudo cargar la unidad organizativa' }, { status: 500 })
  }
}
