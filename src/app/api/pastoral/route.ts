import { NextRequest, NextResponse } from 'next/server'
import { fetchSupabaseJson } from '@/lib/supabase/rest'

const columns = [
  'id',
  'name',
  'slug',
  'description',
  'diocese_name',
  'diocese_slug',
  'level_name',
  'level_key',
  'parent_pastoral_entity_name',
  'parent_pastoral_entity_slug',
  'linked_entity_name',
  'linked_entity_slug',
  'start_date',
  'status',
  'visibility'
].join(',')

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')

  if (!slug) {
    return NextResponse.json({ error: 'Falta el identificador pastoral' }, { status: 400 })
  }

  try {
    const rows = await fetchSupabaseJson<Record<string, unknown>[]>('public_pastoral_entities', {
      slug: `eq.${slug}`,
      status: 'eq.active',
      visibility: 'eq.public',
      select: columns,
      limit: '1',
    })

    const item = rows[0]

    if (!item) {
      return NextResponse.json({ error: 'Entidad pastoral no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Unexpected pastoral entity API error', error)
    return NextResponse.json({ error: 'No se pudo cargar la entidad pastoral' }, { status: 500 })
  }
}
