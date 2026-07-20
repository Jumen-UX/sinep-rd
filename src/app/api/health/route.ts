import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { probeSupabaseRestAvailability } from '@/lib/supabase/rest'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type HealthStatus = 'ok' | 'degraded'

export async function GET() {
  const startedAt = Date.now()
  const requestId = randomUUID()
  let database: HealthStatus = 'ok'

  try {
    if (!await probeSupabaseRestAvailability()) database = 'degraded'
  } catch {
    database = 'degraded'
  }

  const status: HealthStatus = database === 'ok' ? 'ok' : 'degraded'
  const responseTimeMs = Date.now() - startedAt
  const checks = { application: 'ok' as const, database }

  if (status === 'degraded') {
    console.error('Operational health check degraded', {
      event: 'health_check_degraded',
      request_id: requestId,
      checks,
      response_time_ms: responseTimeMs,
    })
  }

  return NextResponse.json(
    {
      status,
      service: 'sinep-rd',
      request_id: requestId,
      checks,
      response_time_ms: responseTimeMs,
      checked_at: new Date().toISOString(),
    },
    {
      status: status === 'ok' ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Request-Id': requestId,
      },
    },
  )
}
