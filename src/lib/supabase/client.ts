import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const fallbackUrl = 'https://hrvgpceqaxujlttpimdz.supabase.co'
const fallbackPublishableKey = 'sb_publishable_RJkFs3kYh4BoAzfGivOlvg_xBCEklGP'

export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || fallbackPublishableKey
  )
}
