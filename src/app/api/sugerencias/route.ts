import { NextRequest, NextResponse } from 'next/server'
import { buildSupabaseRestUrl } from '@/lib/supabase/rest'
import { getSupabaseRestHeaders } from '@/lib/supabase/config'

function clean(value: unknown) {
  const text = String(value ?? '').trim()
  return text.length > 0 ? text : null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const targetTable = clean(body.target_table)
    const title = clean(body.title)
    const description = clean(body.description)

    if (!targetTable || !title || !description) {
      return NextResponse.json({ error: 'Faltan datos obligatorios.' }, { status: 400 })
    }

    const payload = {
      target_table: targetTable,
      target_id: clean(body.target_id),
      target_slug: clean(body.target_slug),
      target_title: clean(body.target_title),
      page_url: clean(body.page_url),
      suggestion_type: clean(body.suggestion_type) ?? 'correction',
      title,
      description,
      proposed_data: {
        field_name: clean(body.field_name),
        current_value: clean(body.current_value),
        proposed_value: clean(body.proposed_value),
      },
      source_name: clean(body.source_name),
      source_url: clean(body.source_url),
      submitter_name: clean(body.submitter_name),
      submitter_email: clean(body.submitter_email),
      submitter_country: clean(body.submitter_country),
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
    console.error('Unexpected public suggestion API error', error)
    return NextResponse.json({ error: 'No se pudo procesar la sugerencia.' }, { status: 500 })
  }
}
