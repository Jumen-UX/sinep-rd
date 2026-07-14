import type { SupabaseClient } from '@supabase/supabase-js'

export async function hasConfigurationAdminSession(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    throw new Error(error.message || 'No se pudo comprobar la sesión administrativa.')
  }

  return Boolean(data.user)
}
