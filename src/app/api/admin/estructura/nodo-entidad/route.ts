import { NextRequest, NextResponse } from 'next/server'
import { recordAdminAudit } from '@/lib/admin/audit'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { isJsonObject, parseJsonObjectBody, ValidationError } from '@/lib/admin/validation'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'
import { revalidatePublicContent } from '@/lib/public/cache'

type SaveNodeEntityResult = {
  entityId: string | null
  nodeId: string | null
}

function toText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function getSaveResult(value: unknown): SaveNodeEntityResult {
  if (!isJsonObject(value)) return { entityId: null, nodeId: null }

  return {
    entityId: typeof value.entity_id === 'string' ? value.entity_id : null,
    nodeId: typeof value.node_id === 'string' ? value.node_id : null,
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAccess({
      permissionKey: 'structures.manage',
      forbiddenMessage: 'No autorizado para modificar estructuras.',
    })
    if (!auth.ok) return auth.response

    const payload = await parseJsonObjectBody(request, 'Solicitud invalida.')
    const templateId = toText(payload.template_id)
    const levelId = toText(payload.level_id)
    const parentNodeId = toText(payload.parent_node_id)
    const name = toText(payload.name)
    const slug = toText(payload.slug)

    if (!templateId || !levelId || !parentNodeId || !name || !slug) {
      return NextResponse.json({ error: 'Faltan datos para crear la unidad estructural.' }, { status: 400 })
    }

    const normalizedPayload = {
      ...payload,
      template_id: templateId,
      level_id: levelId,
      parent_node_id: parentNodeId,
      parent_entity_id: toText(payload.parent_entity_id) || null,
      entity_type_key: toText(payload.entity_type_key) || 'parish',
      name,
      official_name: toText(payload.official_name) || name,
      slug,
      start_date: toText(payload.start_date) || new Date().toISOString().slice(0, 10),
      country_iso2: toText(payload.country_iso2) || 'DO',
      country: toText(payload.country) || 'Republica Dominicana',
      status: 'active',
      visibility: 'public',
    }

    const { data, error } = await auth.supabase.rpc('admin_create_structure_node_entity', {
      payload: normalizedPayload,
    })

    if (error) {
      console.error('Failed to create structure node and entity transactionally', error)
      return NextResponse.json(
        { error: toSpanishAdminError(error, 'No se pudo crear la unidad estructural.') },
        { status: 400 },
      )
    }

    const result = getSaveResult(data)
    if (!result.entityId || !result.nodeId) {
      return NextResponse.json({ error: 'La operación terminó sin identificadores válidos.' }, { status: 400 })
    }

    await recordAdminAudit(auth.supabase, {
      action: 'structure.node_entity.create',
      targetTable: 'structure_nodes',
      targetId: result.nodeId,
      metadata: {
        entity_id: result.entityId,
        template_id: templateId,
        level_id: levelId,
        entity_type_key: normalizedPayload.entity_type_key,
      },
    })

    revalidatePublicContent({ entitySlug: slug })
    return NextResponse.json({
      entity_id: result.entityId,
      node_id: result.nodeId,
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Unexpected structure node entity API error', error)
    return NextResponse.json({ error: 'No se pudo crear la unidad estructural.' }, { status: 500 })
  }
}
