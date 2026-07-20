const baseUrl = process.env.HEALTH_BASE_URL ?? process.env.APP_BASE_URL
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET

if (!baseUrl) {
  console.error('Define HEALTH_BASE_URL o APP_BASE_URL para verificar /api/health.')
  process.exit(1)
}

const endpoint = new URL('/api/health', baseUrl).toString()
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 15_000)

try {
  const headers = bypassSecret
    ? { 'x-vercel-protection-bypass': bypassSecret }
    : undefined
  const response = await fetch(endpoint, {
    headers,
    cache: 'no-store',
    signal: controller.signal,
  })
  const payload = await response.json().catch(() => null)
  const requestId = response.headers.get('x-request-id')

  if (
    !response.ok
    || payload?.status !== 'ok'
    || payload?.checks?.application !== 'ok'
    || payload?.checks?.database !== 'ok'
    || !requestId
    || payload?.request_id !== requestId
  ) {
    console.error('Health check degradado.', {
      status: response.status,
      request_id: requestId,
    })
    process.exit(1)
  }

  console.log('Health check correcto.', {
    endpoint,
    request_id: requestId,
    response_time_ms: payload.response_time_ms,
    checked_at: payload.checked_at,
  })
} catch (error) {
  console.error('No se pudo completar el health check.', error instanceof Error ? error.message : error)
  process.exit(1)
} finally {
  clearTimeout(timeout)
}
