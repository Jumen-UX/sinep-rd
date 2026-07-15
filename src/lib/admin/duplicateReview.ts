export type DuplicateReviewKind = 'person' | 'entity'

export type DuplicateMatch = {
  record_id: string
  display_name: string | null
  slug: string | null
  similarity_score: number | string | null
  match_reason: string | null
  birth_date?: string | null
  hierarchy_path?: string | null
}

type DuplicateResponse = {
  items?: DuplicateMatch[]
  error?: string
}

const duplicateEndpoints: Record<DuplicateReviewKind, string> = {
  person: '/api/admin/duplicados/personas',
  entity: '/api/admin/duplicados/entidades',
}

function duplicateDetail(item: DuplicateMatch) {
  const context = item.birth_date ?? item.hierarchy_path
  const reason = item.match_reason ?? 'Coincidencia por nombre'
  return `• ${item.display_name ?? 'Registro sin nombre'}${context ? ` — ${context}` : ''} (${reason})`
}

export async function findPotentialDuplicates(
  kind: DuplicateReviewKind,
  payload: Record<string, unknown>,
): Promise<DuplicateMatch[]> {
  const response = await fetch(duplicateEndpoints[kind], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => null) as DuplicateResponse | null

  if (!response.ok) {
    throw new Error(data?.error ?? 'No se pudo completar la revisión de duplicados.')
  }

  return data?.items ?? []
}

export async function reviewPotentialDuplicates(
  kind: DuplicateReviewKind,
  payload: Record<string, unknown>,
): Promise<number> {
  const matches = await findPotentialDuplicates(kind, payload)
  if (matches.length === 0) return 0

  const noun = kind === 'person' ? 'persona' : 'entidad'
  const details = matches.slice(0, 5).map(duplicateDetail).join('\n')
  const remaining = matches.length > 5 ? `\n• ${matches.length - 5} coincidencia(s) adicional(es)` : ''
  const confirmed = globalThis.confirm(
    `Se encontraron ${matches.length} posible(s) coincidencia(s) para esta ${noun}:\n\n${details}${remaining}\n\nRevisa cuidadosamente. ¿Deseas crear un registro nuevo de todos modos?`,
  )

  if (!confirmed) {
    throw new Error('Creación cancelada para revisar una posible ficha existente.')
  }

  return matches.length
}
