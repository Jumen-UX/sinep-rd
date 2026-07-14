import type { SupabaseClient } from '@supabase/supabase-js'

export type CanonicalOfficeDefinition = {
  id: string
  key: string
  name: string
  short_definition: string
  full_definition: string | null
  canon_reference: string
  requires_priest: boolean
  requires_bishop: boolean
  canonical_context: string | null
  source_title: string | null
  source_url: string | null
}

function throwIfError(error: { message: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback)
}

export async function hasCanonicalReferenceAdminSession(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser()
  throwIfError(error, 'No se pudo comprobar la sesión administrativa.')
  return Boolean(data.user)
}

export async function loadCanonicalOfficeDefinitions(supabase: SupabaseClient): Promise<CanonicalOfficeDefinition[]> {
  const { data, error } = await supabase.from('public_canonical_office_definitions').select('*').order('name')
  throwIfError(error, 'No se pudieron cargar las referencias canónicas de cargos.')
  return (data ?? []) as CanonicalOfficeDefinition[]
}
