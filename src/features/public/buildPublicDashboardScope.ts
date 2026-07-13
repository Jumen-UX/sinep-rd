import type { PastoralEntity, PublicDashboardData } from '@/lib/public/dashboard'
import { assignmentMatches, isSpecial, normalize, splitValues, type PersonCard } from './PublicDashboardShared'

export function buildPublicDashboardScope(
  initialData: PublicDashboardData,
  country: string,
  province: string,
  jurisdictionId: string,
) {
  const countryDioceses = initialData.dioceses.filter((item) => !item.country_iso2 || item.country_iso2 === country)
  const provinceMap = new Map<string, number>()
  countryDioceses.filter((item) => !isSpecial(item)).forEach((item) => {
    const name = item.ecclesiastical_province_name
    if (name) provinceMap.set(name, (provinceMap.get(name) ?? 0) + 1)
  })
  const provinces = Array.from(provinceMap, ([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const provinceDioceses = province
    ? countryDioceses.filter((item) => item.ecclesiastical_province_name === province)
    : countryDioceses
  const selectedJurisdiction = countryDioceses.find((item) => item.id === jurisdictionId) ?? null
  const scopedDioceses = selectedJurisdiction ? [selectedJurisdiction] : provinceDioceses
  const scopedIds = new Set(scopedDioceses.map((item) => item.id))
  const scopedSlugs = new Set(scopedDioceses.map((item) => item.slug))
  const scopeFiltered = Boolean(province || selectedJurisdiction)
  const inScope = (dioceseId: string | null, dioceseSlug: string | null) => !scopeFiltered || Boolean(
    (dioceseId && scopedIds.has(dioceseId)) || (dioceseSlug && scopedSlugs.has(dioceseSlug)),
  )
  const scopedParishes = initialData.parishes.filter((item) => inScope(item.diocese_id, item.diocese_slug))
  const scopedPastoral = initialData.pastoral_entities.filter((item) => inScope(item.diocese_id, item.diocese_slug))
  const pastoralGroups = Array.from(scopedPastoral.reduce((map, item) => {
    const name = item.level_name ?? 'Sin nivel configurado'
    const group = map.get(name) ?? { name, order: item.level_order ?? 999, items: [] as PastoralEntity[] }
    group.items.push(item)
    group.order = Math.min(group.order, item.level_order ?? 999)
    map.set(name, group)
    return map
  }, new Map<string, { name: string; order: number; items: PastoralEntity[] }>()).values())
    .sort((a, b) => a.order - b.order)

  const assignmentPeople = Array.from(new Map(initialData.assignments
    .filter((item) => !scopeFiltered || assignmentMatches(item, scopedSlugs))
    .map((item) => [item.person_id, {
      id: item.person_id,
      name: item.person_name ?? 'Persona sin nombre',
      slug: item.person_slug,
      personType: item.person_type,
      role: item.position_title ?? item.base_role_name ?? 'Asignación vigente',
      scope: item.direct_entity_name ?? item.pastoral_entity_name ?? item.parish_name ?? item.diocese_name ?? 'Ámbito no indicado',
    } satisfies PersonCard])).values())
  const ordinaryPeople: PersonCard[] = scopedDioceses.flatMap((item) => {
    const names = splitValues(item.current_ordinary_name).filter((name) => !normalize(name).includes('vacante'))
    const titles = splitValues(item.current_ordinary_title)
    return names.map((name, index) => ({
      id: `${item.id}-${index}`,
      name,
      slug: null,
      href: `/entidades/${item.slug}`,
      personType: 'bishop',
      role: titles[index] ?? titles[0] ?? 'Obispo u ordinario',
      scope: item.name,
    }))
  })

  return {
    provinces,
    provinceDioceses,
    selectedJurisdiction,
    scopedDioceses,
    scopedParishes,
    scopedPastoral,
    pastoralGroups,
    scopeFiltered,
    assignmentPeople,
    ordinaryPeople,
  }
}
