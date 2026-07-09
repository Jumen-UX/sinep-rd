import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type SaveEntityResponse = {
  entity_id?: string
  id?: string
  error?: string
}

type SaveNodeResponse = {
  id?: string
  node_id?: string
  error?: string
}

function toText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: hasAdminRole, error: roleError } = await supabase.rpc('current_user_has_admin_role')

    if (roleError) {
      console.error('Failed to validate admin role for structure node entity API', roleError)
      return NextResponse.json({ error: 'No se pudo validar el rol administrativo.' }, { status: 403 })
    }

    if (hasAdminRole !== true) {
      return NextResponse.json({ error: 'No tienes un rol administrativo activo.' }, { status: 403 })
    }

    const payload = await request.json()
    const templateId = toText(payload.template_id)
    const levelId = toText(payload.level_id)
    const parentNodeId = toText(payload.parent_node_id)
    const parentEntityId = toText(payload.parent_entity_id)
    const entityTypeKey = toText(payload.entity_type_key) || 'parish'
    const name = toText(payload.name)
    const slug = toText(payload.slug)
    const startDate = toText(payload.start_date)

    if (!templateId || !levelId || !parentNodeId || !name || !slug) {
      return NextResponse.json({ error: 'Faltan datos para crear la unidad estructural.' }, { status: 400 })
    }

    const { data: entityData, error: entityError } = await supabase.rpc('admin_save_ecclesiastical_entity', {
      payload: {
        entity_type_key: entityTypeKey,
        name,
        slug,
        country: 'República Dominicana',
        parent_entity_id: parentEntityId || null,
        status: 'active',
        visibility: 'public',
      },
    })

    if (entityError) {
      console.error('Failed to create ecclesiastical entity for structure node', entityError)
      return NextResponse.json({ error: entityError.message }, { status: 400 })
    }

    const savedEntity = entityData as SaveEntityResponse | null
    const entityId = savedEntity?.entity_id ?? savedEntity?.id

    if (!entityId) {
      return NextResponse.json({ error: 'La entidad fue creada sin identificador retornado.' }, { status: 400 })
    }

    const { data: nodeData, error: nodeError } = await supabase.rpc('admin_save_structure_node', {
      payload: {
        template_id: templateId,
        level_id: levelId,
        parent_node_id: parentNodeId,
        name,
        official_name: name,
        slug,
        linked_ecclesiastical_entity_id: entityId,
        start_date: startDate || new Date().toISOString().slice(0, 10),
        status: 'active',
        visibility: 'public',
      },
    })

    if (nodeError) {
      console.error('Failed to create structure node for entity', nodeError)
      return NextResponse.json({ error: nodeError.message, entity_id: entityId }, { status: 400 })
    }

    const savedNode = nodeData as SaveNodeResponse | null

    return NextResponse.json({
      entity_id: entityId,
      node_id: savedNode?.id ?? savedNode?.node_id ?? null,
    })
  } catch (error) {
    console.error('Unexpected structure node entity API error', error)
    return NextResponse.json({ error: 'No se pudo crear la unidad estructural.' }, { status: 500 })
  }
}
