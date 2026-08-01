import { createHmac } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, getSupabaseServiceRoleKey } from '@/lib/supabase/admin'
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

type RateLimitDecision = {
  allowed: boolean
  retry_after_seconds: number
}

function nullable(value: string) {
  return value.length > 0 ? value : null
}

function clientIp(request: NextRequest) {
  const vercelIp = request.headers.get('x-vercel-forwarded-for')
  const localIp = process.env.VERCEL
    ? null
    : request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')

  return (vercelIp || localIp || 'unknown-client')
    .split(',')[0]
    .trim()
    .slice(0, 128)
}

function rateLimitFingerprint(request: NextRequest) {
  const derivedKey = createHmac('sha256', getSupabaseServiceRoleKey())
    .update('sinep-rd/public-suggestion-rate-limit/v1')
    .digest()

  return createHmac('sha256', derivedKey)
    .update(clientIp(request))
    .digest('hex')
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

    const admin = createAdminClient()
    const { data: rateLimitData, error: rateLimitError } = await admin.rpc(
      'consume_public_suggestion_rate_limit',
      { p_fingerprint: rateLimitFingerprint(request) },
    )

    if (rateLimitError) {
      console.error('Public suggestion rate limit failed', {
        code: rateLimitError.code,
        message: rateLimitError.message,
      })
      return NextResponse.json(
        { error: 'El servicio de sugerencias no está disponible temporalmente.' },
        { status: 503, headers: { 'Retry-After': '60' } },
      )
    }

    const rateLimit = rateLimitData as RateLimitDecision | null
    if (!rateLimit?.allowed) {
      const retryAfter = Math.max(1, Number(rateLimit?.retry_after_seconds) || 60)
      return NextResponse.json(
        { error: 'Has enviado demasiadas sugerencias. Inténtalo más tarde.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      )
    }

    const { data: suggestion, error: suggestionError } = await admin
      .from('public_change_suggestions')
      .insert(payload)
      .select('id,created_at')
      .single()

    if (suggestionError) {
      console.error('Public suggestion submission failed', {
        code: suggestionError.code,
        message: suggestionError.message,
      })
      return NextResponse.json({ error: 'No se pudo enviar la sugerencia.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, suggestion })
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Unexpected public suggestion API error', error)
    return NextResponse.json({ error: 'No se pudo procesar la sugerencia.' }, { status: 500 })
  }
}
