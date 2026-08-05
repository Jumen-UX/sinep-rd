import type { OrganizationUnit, PublicDashboardData } from '@/lib/public/dashboard'
import { assignmentMatches, isSpecial, normalize, splitValues, type PersonCard } from './PublicDashboardShared'

export function buildPublicDashboardScope(
  initialData: PublicDashboardData,
  country: string,
  province: string,
  jurisdictionId: string,
  parishId = '',
) {
  const jurisdictionsWithExplicitCoverage = new Set(
    initialData.jurisdiction_coverages.map((coverage) => coverage.jurisdiction_id),
  )
  const jurisdictionIdsForCountry = new Set(
    initialData.jurisdiction_coverages
      .filter((coverage) => coverage.country_iso2 === country)
      .map((coverage) => coverage.jurisdiction_id),
  )
  const countryDioceses = country
    ? initialData.dioceses.filter((item) => (
      jurisdictionIdsForCountry.has(item.id)
      || (!jurisdictionsWithExplicitCoverage.has(item.id)
        && (item.country_iso2 ? item.country_iso2 === country : country === 'DO'))
    ))
    : initialData.dioceses
  const provinceMap = new Map<string, number>()
  if (country) {
    countryDioceses.filter((item) => !isSpecial(item)).forEach((item) => {
      const name = item.ecclesiastical_province_name
      if (name) provinceMap.set(name, (provinceMap.get(name) ?? 0) + 1)
    })
  }
  const provinces = Array.from(provinceMap, ([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const provinceDioceses = province
    ? countryDioceses.filter((item) => item.ecclesiastical_province_name === province)
    : countryDioceses
  const selectedJurisdiction = countryDioceses.find((item) => item.id === jurisdictionId) ?? null
  const scopedDioceses = selectedJurisdiction ? [selectedJurisdiction] : provinceDioceses
  const scopedIds = new Set(scopedDioceses.map((item) => item.id))
  const scopedSlugs = new Set(scopedDioceses.map((item) => item.slug))
  const jurisdictionParishes = initialData.parishes.filter((item) => (
    (item.diocese_id && scopedIds.has(item.diocese_id))
    || (item.diocese_slug && scopedSlugs.has(item.diocese_slug))
  ))
  const selectedParish = jurisdictionParishes.find((item) => item.id === parishId) ?? null
  const scopedParishes = selectedParish ? [selectedParish] : jurisdictionParishes
  const selectedParishSlugs = new Set(selectedParish?.slug ? [selectedParish.slug] : [])
  const effectiveSlugs = selectedParish ? selectedParishSlugs : scopedSlugs
  const scopeFiltered = Boolean(country || province || selectedJurisdiction || selectedParish)
  const inTerritorialScope = (dioceseId: string | null, dioceseSlug: string | null) => Boolean(
    (dioceseId && scopedIds.has(dioceseId)) || (dioceseSlug && scopedSlugs.has(dioceseSlug)),
  )
  const scopedPastoral = initialData.organization_units.filter((item) => inTerritorialScope(item.ecclesiastical_entity_id, item.ecclesiastical_entity_slug))
  const pastoralGroups = Array.from(scopedPastoral.reduce((map, item) => {
    const name = item.organization_chart_name ?? 'Sin organigrama configurado'
    const group = map.get(name) ?? {
      name,
      order: item.organization_chart_sort_order ?? 999,
      items: [] as OrganizationUnit[],
    }
    group.items.push(item)
    group.order = Math.min(group.order, item.organization_chart_sort_order ?? 999)
    map.set(name, group)
    return map
  }, new Map<string, { name: string; order: number; items: OrganizationUnit[] }>()).values())
    .sort((a, b) => a.order - b.order)

  const assignmentPeople = Array.from(new Map(initialData.assignments
    .filter((item) => assignmentMatches(item, effectiveSlugs))
    .map((item) => [item.person_id, {
      id: item.person_id,
      name: item.person_name ?? 'Persona sin nombre',
      slug: item.person_slug,
      personType: item.person_type,
      role: item.position_title ?? item.base_role_name ?? 'Asignación vigente',
      scope: item.direct_entity_name ?? item.organization_unit_name ?? item.parish_name ?? item.diocese_name ?? 'Ámbito no indicado',
    } satisfies PersonCard])).values())
  const ordinaryPeople: PersonCard[] = selectedParish ? [] : scopedDioceses.flatMap((item) => {
    const names = splitValues(item.current_ordinary_name).filter((name) => !normalize(name).includes('vacante'))
    const titles = splitValues(item.current_ordinary_title)
    const territorialScope = [item.name, country ? null : item.country_name].filter(Boolean).join(' · ')
    return names.map((name, index) => ({
      id: `${item.id}-${index}`,
      name,
      slug: null,
      href: `/entidades/${item.slug}`,
      personType: 'bishop',
      role: titles[index] ?? titles[0] ?? 'Obispo u ordinario',
      scope: territorialScope,
    }))
  })

  return {
    provinces,
    provinceDioceses,
    selectedJurisdiction,
    jurisdictionParishes,
    selectedParish,
    scopedDioceses,
    scopedParishes,
    scopedPastoral,
    pastoralGroups,
    scopeFiltered,
    assignmentPeople,
    ordinaryPeople,
  }
}
