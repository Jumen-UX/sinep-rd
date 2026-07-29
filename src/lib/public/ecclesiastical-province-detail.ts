import 'server-only'

import { fetchSupabaseJson } from '@/lib/supabase/rest'

export type PublicProvinceDiocese = {
  id: string
  slug: string
  name: string
  entity_type_name: string | null
  ecclesiastical_province_name: string | null
  current_ordinary_name: string | null
  current_ordinary_title: string | null
  population_total: number | null
  catholics_total: number | null
  parishes_count: number | null
  territory_summary: string | null
  statistics_year: number | null
}

export type PublicEcclesiasticalProvinceDetail = {
  province: {
    name: string
    slug: string
    country_name: string
    metropolitan_see: PublicProvinceDiocese | null
    current_metropolitan_name: string | null
    current_metropolitan_title: string | null
    jurisdiction_count: number
    total_population: number
    total_catholics: number
    reported_parishes: number
  }
  jurisdictions: PublicProvinceDiocese[]
}

function normalizeText(value?: string | null) {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function slugify(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function isArchdiocese(item: PublicProvinceDiocese) {
  return normalizeText(item.entity_type_name).includes('arquidiocesis')
}

export async function loadUncachedPublicEcclesiasticalProvinceDetail(
  requestedSlug: string,
): Promise<PublicEcclesiasticalProvinceDetail | null> {
  const dioceses = await fetchSupabaseJson<PublicProvinceDiocese[]>('public_dioceses', {
    select: 'id,slug,name,entity_type_name,ecclesiastical_province_name,current_ordinary_name,current_ordinary_title,population_total,catholics_total,parishes_count,territory_summary,statistics_year',
    order: 'name.asc',
  })

  const jurisdictions = dioceses.filter(
    (item) => item.ecclesiastical_province_name && slugify(item.ecclesiastical_province_name) === requestedSlug,
  )
  const name = jurisdictions[0]?.ecclesiastical_province_name ?? null
  if (!name) return null

  const metropolitanSee = jurisdictions.find(isArchdiocese) ?? jurisdictions[0] ?? null

  return {
    province: {
      name,
      slug: requestedSlug,
      country_name: 'República Dominicana',
      metropolitan_see: metropolitanSee,
      current_metropolitan_name: metropolitanSee?.current_ordinary_name ?? null,
      current_metropolitan_title: metropolitanSee?.current_ordinary_title ?? null,
      jurisdiction_count: jurisdictions.length,
      total_population: jurisdictions.reduce((sum, item) => sum + (item.population_total ?? 0), 0),
      total_catholics: jurisdictions.reduce((sum, item) => sum + (item.catholics_total ?? 0), 0),
      reported_parishes: jurisdictions.reduce((sum, item) => sum + (item.parishes_count ?? 0), 0),
    },
    jurisdictions,
  }
}
