import { NextResponse } from 'next/server'
import { fetchSupabaseJson } from '@/lib/supabase/rest'

type RelationshipRow = {
  id: string
  relationship_type: string | null
  parent_name: string | null
  parent_slug: string | null
  parent_type_key: string | null
  parent_type_name: string | null
  child_name: string | null
  child_slug: string | null
  child_type_key: string | null
  child_type_name: string | null
}

type ParishRow = {
  id: string
  diocese_id: string | null
  diocese_name: string | null
  diocese_slug: string | null
}

async function safeFetch<T>(table: string, params: Record<string, string>) {
  try {
    return await fetchSupabaseJson<T[]>(table, params)
  } catch (error) {
    console.warn(`Dashboard territorial levels source unavailable: ${table}`, error)
    return []
  }
}

export async function GET() {
  try {
    const [relationships, parishes] = await Promise.all([
      safeFetch<RelationshipRow>('public_entity_relationships_current', {
        select: 'id,relationship_type,parent_name,parent_slug,parent_type_key,parent_type_name,child_name,child_slug,child_type_key,child_type_name',
        order: 'parent_name.asc,child_type_name.asc,child_name.asc',
      }),
      safeFetch<ParishRow>('public_parishes', {
        select: 'id,diocese_id,diocese_name,diocese_slug',
        status: 'eq.active',
        visibility: 'eq.public',
        order: 'name.asc',
      }),
    ])

    return NextResponse.json({ relationships, parishes })
  } catch (error) {
    console.error('Unexpected territorial levels API error', error)
    return NextResponse.json({ error: 'No se pudieron cargar los niveles territoriales' }, { status: 500 })
  }
}
