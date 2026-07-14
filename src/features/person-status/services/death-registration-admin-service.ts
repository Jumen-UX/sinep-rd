import type { SupabaseClient } from '@supabase/supabase-js'

export type PersonOption = {
  id: string
  display_name: string
  slug: string
  person_type: string
  status: string | null
  death_date: string | null
}

export type DeathRegistrationInput = {
  person_id: string
  death_date: string
  death_place: string | null
  source_name: string | null
  source_url: string | null
  source_checked_at: string | null
  notes_public: string | null
  notes_internal: string | null
  close_active_assignments: boolean
  register_parish_vacancy: boolean
  register_jurisdiction_vacancy: boolean
}

export type DeathRegistrationResult = {
  slug?: string
  closed_assignments_count?: number
  registered_vacancies_count?: number
}

export async function hasDeathRegistrationSession(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw new Error(error.message)
  return Boolean(data.user)
}

export async function loadDeathRegistrationPeople(supabase: SupabaseClient): Promise<PersonOption[]> {
  const { data, error } = await supabase
    .from('persons')
    .select('id,display_name,slug,person_type,status,death_date')
    .in('person_type', ['bishop', 'priest', 'deacon', 'religious', 'layperson'])
    .neq('status', 'deceased')
    .order('display_name')

  if (error) throw new Error(error.message)
  return (data ?? []) as PersonOption[]
}

export async function registerDeath(input: DeathRegistrationInput): Promise<DeathRegistrationResult> {
  const response = await fetch('/api/admin/fallecimiento', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  const result = await response.json().catch(() => ({})) as DeathRegistrationResult & { error?: string }
  if (!response.ok) throw new Error(result.error ?? 'No se pudo marcar el fallecimiento.')
  return result
}
