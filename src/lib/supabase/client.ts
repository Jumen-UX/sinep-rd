import { createBrowserClient } from '@supabase/ssr'
import { getSupabasePublishableKey, getSupabaseUrl } from './config'

type JsonObject = Record<string, unknown>

type RoutedRpcError = {
  message: string
  details: string
  hint: string
  code: string
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function reviewPersonChangeRequest(args: unknown) {
  const input = isJsonObject(args) ? args : {}
  const response = await fetch('/api/admin/solicitudes/revisar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      change_request_id: input.p_change_request_id,
      decision: input.p_decision,
      rejection_reason: input.p_rejection_reason,
    }),
  })

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  const errorBody = isJsonObject(body) ? body : {}
  const error: RoutedRpcError | null = response.ok
    ? null
    : {
        message: typeof errorBody.error === 'string' ? errorBody.error : 'No se pudo revisar la solicitud.',
        details: '',
        hint: '',
        code: 'ADMIN_REVIEW_FAILED',
      }

  return {
    data: response.ok ? body : null,
    error,
    count: null,
    status: response.status,
    statusText: response.statusText,
  }
}

export function createClient() {
  const client = createBrowserClient(getSupabaseUrl(), getSupabasePublishableKey())
  const originalRpc = client.rpc.bind(client)

  const routedRpc = ((functionName: string, args?: unknown, options?: unknown) => {
    if (functionName === 'admin_review_person_change_request') {
      return reviewPersonChangeRequest(args)
    }

    return Reflect.apply(originalRpc, client, [functionName, args, options])
  }) as typeof client.rpc

  Object.defineProperty(client, 'rpc', {
    configurable: true,
    value: routedRpc,
    writable: true,
  })

  return client
}
