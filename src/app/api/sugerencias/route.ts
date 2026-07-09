import { NextRequest, NextResponse } from 'next/server'
import { buildSupabaseRestUrl } from '@/lib/supabase/rest'
import { getSupabaseRestHeaders } from '@/lib/supabase/config'
import {
  optionalEmail,
  optionalText,
  optionalUrl,
  optionalUuid,
  oneOf,
  parseJsonObjectBody,
  requiredText,
  ValidationError,
} from '@/lib/admin/validation'

const allowedSuggestionTargetTables = ['persons', 'ecclesiastical_entities'] as const
const allowedSuggestionTypes = ['correction', 'addition', 'source', 'country_data'] as const

function nullable(value: string) {
  return value.length > 0 ? value : null
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonObjectBody(request, 'Solicitud invalida.')
    const targetTable = oneOf(body.target_table, allowedSuggestionTargetTables, 'tabla objetivo')
    const targetId = optionalUuid(body.target_id)
    const targetSlug = optionalText(body.target_slug, 180)
    const suggestionType = oneOf(optionalText(body.suggestion_type, 40) || 'correction', allowedSuggestionTypes, 'tipo de sugerencia')
    const title = requiredText(body.title, 'titulo', 160)
    const description = requiredText(body.description, 'descripcion', 3000)

    if (!targetId && !targetSlug) {
      throw new ValidationError('Falta la ficha.')
    }

    const payload = {
      target_table: targetTable,
      target_id: nullable(targetId),
      target_slug: nullable(targetSlug),
      target_title: nullable(optionalText(body.target_title, 220)),
      page_url: nullable(optionalText(body.page_url, 500)),
      suggestion_type: suggestionType,
      title,
      description,
      proposed_data: {
        field_name: nullable(optionalText(body.field_name, 120)),
        current_value: nullable(optionalText(body.current_value, 2000)),
        proposed_value: nullable(optionalText(body.proposed_value, 2000)),
      },
      source_name: nullable(optionalText(body.source_name, 220)),
      source_url: nullable(optionalUrl(body.source_url, 'URL de fuente')),
      submitter_name: nullable(optionalText(body.submitter_name, 180)),
      submitter_email: nullable(optionalEmail(body.submitter_email)),
      submitter_country: nullable(optionalText(body.submitter_country, 120)),
      status: 'pending_review',
      priority: 'normal',
    }

    const response = await fetch(buildSupabaseRestUrl('public_change_suggestions'), {
      method: 'POST',
      headers: {
        ...getSupabaseRestHeaders(),
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    if (!response.ok) {
      const details = await response.text()
      console.error('Public suggestion submission failed', {
        status: response.status,
        details,
      })
      return NextResponse.json({ error: 'No se pudo enviar la sugerencia.' }, { status: response.status })
    }

    const result = await response.json()
    return NextResponse.json({ ok: true, suggestion: result[0] ?? null })
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Unexpected public suggestion API error', error)
    return NextResponse.json({ error: 'No se pudo procesar la sugerencia.' }, { status: 500 })
  }
}
