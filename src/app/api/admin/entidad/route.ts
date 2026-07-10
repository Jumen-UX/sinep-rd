import { NextRequest, NextResponse } from 'next/server'
import { recordAdminAudit } from '@/lib/admin/audit'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { isJsonObject, oneOf, optionalText, parseJsonObjectBody, requiredText, ValidationError } from '@/lib/admin/validation'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'

const allowedEntityTypes = ['parish', 'chapel'] as const

function getEntityId(value: unknown) {
  if (!isJsonObject(value)) return null
  return typeof value.entity_id === 'string' ? value.entity_id : null
}

function getCountryIso2(value: unknown) {
  const iso2 = optionalText(value, 10).toUpperCase()

  if (iso2 && !/^[A-Z]{2}$/.test(iso2)) {
    throw new ValidationError('Pais invalido.')
  }

  return iso2 || 'DO'
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAccess({
      permissionKey: 'entities.create_proposal',
      forbiddenMessage: 'No autorizado para crear entidades.',
    })
    if (!auth.ok) return auth.response

    const payload = await parseJsonObjectBody(request, 'Solicitud invalida.')
    const entityTypeKey = oneOf(payload.entity_type_key, allowedEntityTypes, 'tipo de entidad')
    const normalizedPayload = {
      ...payload,
      entity_type_key: entityTypeKey,
      name: requiredText(payload.name, 'nombre', 220),
      country_iso2: getCountryIso2(payload.country_iso2),
    }

    const { data, error } = await auth.supabase.rpc('admin_save_ecclesiastical_entity', { payload: normalizedPayload })

    if (error) {
      console.error('Failed to save ecclesiastical entity transactionally', error)
      return NextResponse.json({ error: toSpanishAdminError(error, 'No se pudo guardar la entidad.') }, { status: 400 })
    }

    await recordAdminAudit(auth.supabase, {
      action: 'ecclesiastical_entity.create',
      targetTable: 'ecclesiastical_entities',
      targetId: getEntityId(data),
      metadata: {
        entity_type_key: entityTypeKey,
        country_iso2: normalizedPayload.country_iso2,
        parent_entity_id: typeof payload.parent_entity_id === 'string' ? payload.parent_entity_id : null,
      },
    })

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Unexpected entity admin API error', error)
    return NextResponse.json({ error: 'No se pudo guardar la entidad' }, { status: 500 })
  }
}
