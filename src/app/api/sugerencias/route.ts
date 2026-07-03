import { NextRequest, NextResponse } from 'next/server'

const fallbackUrl = 'https://hrvgpceqaxujlttpimdz.supabase.co'
const fallbackKey = 'sb_publishable_RJkFs3kYh4BoAzfGivOlvg_xBCEklGP'

function getApiKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || fallbackKey
}

function clean(value: unknown) {
  const text = String(value ?? '').trim()
  return text.length > 0 ? text : null
}

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl
  const key = getApiKey()

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

    const response = await fetch(`${url}/rest/v1/public_change_suggestions`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    if (!response.ok) {
      const details = await response.text()
      return NextResponse.json({ error: 'No se pudo enviar la sugerencia.', details }, { status: response.status })
    }

    const result = await response.json()
    return NextResponse.json({ ok: true, suggestion: result[0] ?? null })
  } catch (error) {
    return NextResponse.json({ error: 'No se pudo procesar la sugerencia.', details: error instanceof Error ? error.message : 'Error desconocido' }, { status: 500 })
  }
}
