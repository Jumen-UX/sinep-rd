import { getSupabaseRestHeaders, getSupabaseUrl } from './config'

type QueryValue = string | number | boolean | null | undefined

type QueryParams = Record<string, QueryValue | QueryValue[]>

export class SupabaseRestError extends Error {
  status: number
  details: string
  endpoint: string

  constructor(endpoint: string, status: number, details: string) {
    super(`Supabase REST request failed with status ${status}`)
    this.name = 'SupabaseRestError'
    this.status = status
    this.details = details
    this.endpoint = endpoint
  }
}

export function buildSupabaseRestUrl(table: string, params: QueryParams = {}) {
  const url = new URL(`/rest/v1/${table.replace(/^\/+/, '')}`, getSupabaseUrl())

  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== null && item !== undefined && item !== '') {
          url.searchParams.append(key, String(item))
        }
      })
      return
    }

    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })

  return url.toString()
}

export async function fetchSupabaseJson<T>(table: string, params: QueryParams = {}) {
  const endpoint = buildSupabaseRestUrl(table, params)
  const response = await fetch(endpoint, {
    headers: getSupabaseRestHeaders(),
    cache: 'no-store',
  })

  if (!response.ok) {
    const details = await response.text()
    console.error('Supabase REST request failed', {
      endpoint,
      status: response.status,
      details,
    })
    throw new SupabaseRestError(endpoint, response.status, details)
  }

  return response.json() as Promise<T>
}
