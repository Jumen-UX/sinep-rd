import type { SupabaseClient } from '@supabase/supabase-js'
import { loadEventApplicationPlan } from './event-application-admin-service'
import {
  buildDeterministicImpactPlan,
  type DeterministicImpactPlan,
} from './event-impact-plan'

export async function loadDeterministicEventImpactPlan(
  supabase: SupabaseClient,
  eventId: string,
): Promise<DeterministicImpactPlan | null> {
  const { plan, conflictPreview } = await loadEventApplicationPlan(supabase, eventId)
  if (!plan) return null
  return buildDeterministicImpactPlan(plan, conflictPreview)
}
