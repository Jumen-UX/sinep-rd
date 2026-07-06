const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function getRequiredEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }

  return value
}

export function getSupabaseUrl() {
  return getRequiredEnv(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
}

export function getSupabasePublishableKey() {
  return getRequiredEnv(
    supabasePublishableKey || supabaseAnonKey,
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY',
  )
}

export function getSupabaseRestHeaders() {
  const key = getSupabasePublishableKey()

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  }
}
