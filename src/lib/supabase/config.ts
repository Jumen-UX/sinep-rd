function getRequiredEnv(name: string, fallbackName?: string) {
  const value = process.env[name] || (fallbackName ? process.env[fallbackName] : undefined)

  if (!value) {
    throw new Error(`Missing environment variable: ${fallbackName ? `${name} or ${fallbackName}` : name}`)
  }

  return value
}

export function getSupabaseUrl() {
  return getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
}

export function getSupabasePublishableKey() {
  return getRequiredEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export function getSupabaseRestHeaders() {
  const key = getSupabasePublishableKey()

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  }
}
