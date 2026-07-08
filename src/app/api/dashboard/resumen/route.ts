import { NextResponse } from 'next/server'
import { fetchSupabaseJson } from '@/lib/supabase/rest'

type DioceseSummaryRow = {
  id: string
  name: string
  entity_type_name: string | null
  ecclesiastical_province_name: string | null
  population_total: number | null
  catholics_total: number | null
  parishes_count: number | null
}

type ParishRow = {
  id: string
}

type PersonSummaryRow = {
  id: string
  person_type: string | null
  status: string | null
  death_date: string | null
}

function normalizeText(value?: string | null) {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function isArchdiocese(item: DioceseSummaryRow) {
  return normalizeText(item.entity_type_name).includes('arquidiocesis')
}

function isDiocese(item: DioceseSummaryRow) {
  const name = normalizeText(item.entity_type_name)
  return name.includes('diocesis') && !name.includes('arquidiocesis')
}

function isMilitary(item: DioceseSummaryRow) {
  const name = normalizeText(`${item.entity_type_name ?? ''} ${item.name}`)
  return name.includes('castrense') || name.includes('militar')
}

export async function GET() {
  try {
    const [dioceses, parishes, people] = await Promise.all([
      fetchSupabaseJson<DioceseSummaryRow[]>('public_dioceses', {
        select: 'id,name,entity_type_name,ecclesiastical_province_name,population_total,catholics_total,parishes_count',
        order: 'name.asc',
      }),
      fetchSupabaseJson<ParishRow[]>('public_ecclesiastical_entities', {
        select: 'id',
        entity_type_key: 'eq.parish',
        status: 'eq.active',
        visibility: 'eq.public',
      }),
      fetchSupabaseJson<PersonSummaryRow[]>('persons', {
        select: 'id,person_type,status,death_date',
        status: 'eq.active',
        visibility: 'eq.public',
      }),
    ])

    const provinces = Array.from(
      dioceses.reduce((map, item) => {
        const name = item.ecclesiastical_province_name
        if (!name) return map
        map.set(name, (map.get(name) ?? 0) + 1)
        return map
      }, new Map<string, number>())
    )
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))

    const countPeople = (type: string) => people.filter((item) => item.person_type === type).length
    const registeredParishes = parishes.length

    return NextResponse.json({
      dioceses: {
        total: dioceses.length,
        archdioceses: dioceses.filter(isArchdiocese).length,
        dioceses: dioceses.filter(isDiocese).length,
        military: dioceses.filter(isMilitary).length,
        provinces,
        total_catholics: dioceses.reduce((sum, item) => sum + (item.catholics_total ?? 0), 0),
        total_population: dioceses.reduce((sum, item) => sum + (item.population_total ?? 0), 0),
        total_parishes: registeredParishes,
        loaded_parishes: registeredParishes,
        reported_parishes: registeredParishes,
      },
      people: {
        total: people.length,
        bishops: countPeople('bishop'),
        priests: countPeople('priest'),
        deacons: countPeople('deacon'),
        religious: countPeople('religious'),
        laypeople: countPeople('layperson'),
        active: people.filter((item) => item.status === 'active' && !item.death_date).length,
      },
    })
  } catch (error) {
    console.error('Unexpected dashboard summary API error', error)
    return NextResponse.json({ error: 'No se pudo cargar el resumen del dashboard' }, { status: 500 })
  }
}
