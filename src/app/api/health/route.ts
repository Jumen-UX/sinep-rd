import { NextResponse } from 'next/server'
import { fetchSupabaseJson } from '@/lib/supabase/rest'

export const dynamic = 'force-dynamic'

type HealthStatus = 'ok' | 'degraded'

export async function GET() {
  const startedAt = Date.now()
  let database: HealthStatus = 'ok'

  try {
    await fetchSupabaseJson<Array<{ id: string }>>('entity_types', {
      select: 'id',
      limit: '1',
    })
  } catch {
    database = 'degraded'
  }

  const status: HealthStatus = database === 'ok' ? 'ok' : 'degraded'

  return NextResponse.json(
    {
      status,
      service: 'sinep-rd',
      checks: { database },
      response_time_ms: Date.now() - startedAt,
      checked_at: new Date().toISOString(),
    },
    {
      status: status === 'ok' ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}
