from pathlib import Path
import json
import re

text_suffixes = {'.ts', '.tsx', '.js', '.jsx', '.mjs'}
replacements = [
    ('PastoralEntity', 'OrganizationUnit'),
    ('pastoralEntities', 'organizationUnits'),
    ('pastoral_entities', 'organization_units'),
    ('pastoralResult', 'organizationUnitResult'),
    ('pastoral_entity', 'organization_unit'),
    ('Entidades pastorales', 'Unidades organizativas'),
    ('entidades pastorales', 'unidades organizativas'),
    ('Entidad pastoral', 'Unidad organizativa'),
    ('entidad pastoral', 'unidad organizativa'),
]

for root_name in ('src', 'tests'):
    root = Path(root_name)
    if not root.exists():
        continue
    for path in root.rglob('*'):
        if not path.is_file() or path.suffix not in text_suffixes:
            continue
        original = path.read_text(encoding='utf-8')
        updated = original
        for old, new in replacements:
            updated = updated.replace(old, new)
        if updated != original:
            path.write_text(updated, encoding='utf-8')

Path('src/app/api/pastoral/route.ts').write_text("""import { NextRequest, NextResponse } from 'next/server'
import { fetchSupabaseJson } from '@/lib/supabase/rest'

const columns = [
  'id',
  'name',
  'slug',
  'description',
  'organization_chart_name',
  'organization_chart_key',
  'parent_unit_name',
  'parent_unit_slug',
  'ecclesiastical_entity_name',
  'ecclesiastical_entity_slug',
  'pastoral_area_name',
  'pastoral_area_slug',
  'valid_from',
  'valid_to',
  'is_current',
  'status',
  'visibility',
].join(',')

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')

  if (!slug) {
    return NextResponse.json({ error: 'Falta el identificador de la unidad organizativa' }, { status: 400 })
  }

  try {
    const rows = await fetchSupabaseJson<Record<string, unknown>[]>('public_organization_units', {
      slug: `eq.${slug}`,
      status: 'eq.active',
      visibility: 'eq.public',
      select: columns,
      limit: '1',
    })

    const item = rows[0]
    if (!item) {
      return NextResponse.json({ error: 'Unidad organizativa no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Unexpected organization unit API error', error)
    return NextResponse.json({ error: 'No se pudo cargar la unidad organizativa' }, { status: 500 })
  }
}
""", encoding='utf-8')

Path('src/app/(public)/pastoral/[slug]/page.tsx').write_text("""'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type OrganizationUnitDetail = {
  item: {
    name: string
    slug: string
    description: string | null
    organization_chart_name: string | null
    organization_chart_key: string | null
    parent_unit_name: string | null
    parent_unit_slug: string | null
    ecclesiastical_entity_name: string | null
    ecclesiastical_entity_slug: string | null
    pastoral_area_name: string | null
    pastoral_area_slug: string | null
    valid_from: string | null
  }
}

export default function OrganizationUnitPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const [detail, setDetail] = useState<OrganizationUnitDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDetail() {
      try {
        const response = await fetch(`/api/pastoral?slug=${encodeURIComponent(slug)}`)
        const payload = await response.json()
        if (!response.ok) {
          setError(payload.error ?? 'No se pudo cargar la unidad organizativa.')
          return
        }
        setDetail(payload as OrganizationUnitDetail)
      } finally {
        setLoading(false)
      }
    }

    loadDetail()
  }, [slug])

  if (loading) return <main className="container"><div className="empty-state">Cargando unidad organizativa...</div></main>
  if (error || !detail) return <main className="container"><div className="error-box">{error ?? 'Unidad organizativa no encontrada.'}</div></main>

  const item = detail.item

  return (
    <main className="container dashboard-page home-dashboard">
      <div className="detail-backlink"><Link href="/?vista=pastoral">← Volver al explorador</Link></div>
      <section className="home-hero-panel card">
        <div className="home-hero-copy">
          <p className="eyebrow">Unidad organizativa</p>
          <h1>{item.name}</h1>
          <p className="lead">{item.description ?? 'Ficha pública de la unidad organizativa seleccionada.'}</p>
          <div className="home-hero-actions">
            {item.ecclesiastical_entity_slug && <Link className="button button-primary" href={`/entidades/${item.ecclesiastical_entity_slug}`}>Ver entidad vinculada</Link>}
          </div>
        </div>
        <aside className="home-context-card">
          <p className="eyebrow">Ubicación organizativa</p>
          <h2>{item.organization_chart_name ?? 'Organigrama no indicado'}</h2>
          <p className="meta">
            {item.ecclesiastical_entity_name ?? item.pastoral_area_name ?? 'Sin ámbito registrado'}
            {item.parent_unit_name ? ` · ${item.parent_unit_name}` : ''}
          </p>
        </aside>
      </section>
    </main>
  )
}
""", encoding='utf-8')

Path('src/features/appointments/services/assignment-admin-service.ts').write_text("""import type { SupabaseClient } from '@supabase/supabase-js'
import { loadAllowedOfficeIds } from '@/features/personas/shared/services/person-placement-service'

export type AssignmentPerson = {
  id: string
  display_name: string
  slug: string
  highest_ordination_degree: 'diaconate' | 'presbyterate' | 'episcopate' | null
  effective_person_type: string | null
}

export type AssignmentOfficeConfiguration = {
  id: string
  key: string
  display_name: string
  organization_chart_id: string | null
  default_term_months: number | null
  continues_until_replaced: boolean
  required_ordination_degree: 'none' | 'diaconate' | 'presbyterate' | 'episcopate'
  allowed_person_types: string[]
  allowed_episcopal_role_types: string[]
  allowed_clerical_statuses: string[]
  holder_cardinality: 'single' | 'multiple'
  max_current_holders: number | null
}

export type AssignmentChart = {
  id: string
  key: string
  name: string
}

export type AssignmentUnit = {
  id: string
  name: string
  slug: string
  organization_chart_id: string
}

export type AssignmentRow = {
  id: string
  person_name: string | null
  person_slug: string | null
  position_title: string | null
  organization_chart_name: string | null
  organization_unit_name: string | null
  direct_entity_name: string | null
  hierarchy_path: string | null
  predecessor_person_name: string | null
  successor_person_name: string | null
  start_date: string | null
  term_start_date: string | null
  term_end_date: string | null
  actual_end_date: string | null
  assignment_status: string | null
}

export type RawAssignment = {
  id: string
  person_id: string | null
  office_configuration_id: string
  organization_chart_id: string | null
  organization_unit_id: string | null
  ecclesiastical_entity_id: string | null
  title_override: string | null
  is_current: boolean
  record_status: string
}

export type AssignmentEligibility = {
  eligible: boolean
  reason_code: string
  message: string
  person_category?: string
  highest_ordination_degree?: string | null
  current_clerical_status?: string
  required_ordination_degree?: string
  allowed_episcopal_role_types?: string[]
  office_name?: string
}

export type AssignmentCatalogs = {
  people: AssignmentPerson[]
  configs: AssignmentOfficeConfiguration[]
  charts: AssignmentChart[]
  units: AssignmentUnit[]
  assignments: AssignmentRow[]
  rawAssignments: RawAssignment[]
}

export type SaveAssignmentResponse = {
  assignment_id?: string
  closed_previous_current_count?: number
  holder_cardinality?: 'single' | 'multiple'
  max_current_holders?: number | null
  eligibility?: AssignmentEligibility
  error?: string
}

export { loadAllowedOfficeIds }

export async function loadAssignmentCatalogs(supabase: SupabaseClient): Promise<AssignmentCatalogs> {
  const [peopleResult, configResult, chartResult, unitResult, assignmentResult, rawAssignmentResult] = await Promise.all([
    supabase
      .from('person_ecclesial_state')
      .select('id,display_name,slug,highest_ordination_degree,effective_person_type')
      .eq('status', 'active')
      .order('display_name'),
    supabase
      .from('office_configurations')
      .select('id,key,display_name,organization_chart_id,default_term_months,continues_until_replaced,required_ordination_degree,allowed_person_types,allowed_episcopal_role_types,allowed_clerical_statuses,holder_cardinality,max_current_holders')
      .eq('status', 'active')
      .order('display_name'),
    supabase.from('organization_charts').select('id,key,name').eq('status', 'active').order('sort_order'),
    supabase.from('organization_units').select('id,name,slug,organization_chart_id').eq('status', 'active').order('name'),
    supabase
      .from('public_position_assignments_with_hierarchy')
      .select('id,person_name,person_slug,position_title,organization_chart_name,organization_unit_name,direct_entity_name,hierarchy_path,predecessor_person_name,successor_person_name,start_date,term_start_date,term_end_date,actual_end_date,assignment_status')
      .order('start_date', { ascending: false, nullsFirst: false })
      .limit(100),
    supabase
      .from('position_assignments')
      .select('id,person_id,office_configuration_id,organization_chart_id,organization_unit_id,ecclesiastical_entity_id,title_override,is_current,record_status')
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  const error = peopleResult.error
    ?? configResult.error
    ?? chartResult.error
    ?? unitResult.error
    ?? assignmentResult.error
    ?? rawAssignmentResult.error
  if (error) throw error

  return {
    people: (peopleResult.data ?? []) as AssignmentPerson[],
    configs: (configResult.data ?? []) as AssignmentOfficeConfiguration[],
    charts: (chartResult.data ?? []) as AssignmentChart[],
    units: (unitResult.data ?? []) as AssignmentUnit[],
    assignments: (assignmentResult.data ?? []) as AssignmentRow[],
    rawAssignments: (rawAssignmentResult.data ?? []) as RawAssignment[],
  }
}

export async function checkAssignmentEligibility(
  supabase: SupabaseClient,
  personId: string,
  officeConfigurationId: string,
  ecclesiasticalEntityId: string | null,
): Promise<AssignmentEligibility> {
  const { data, error } = await supabase.rpc('admin_check_position_assignment_eligibility', {
    p_person_id: personId,
    p_office_configuration_id: officeConfigurationId,
    p_ecclesiastical_entity_id: ecclesiasticalEntityId,
  })

  if (error) throw error
  return data as AssignmentEligibility
}

export async function saveAssignment(payload: Record<string, unknown>): Promise<SaveAssignmentResponse> {
  const response = await fetch('/api/admin/asignacion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json() as SaveAssignmentResponse
  if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar la asignación.')
  return data
}
""", encoding='utf-8')

manager_path = Path('src/features/appointments/admin/AssignmentManagerPage.tsx')
manager = manager_path.read_text(encoding='utf-8')
manager = manager.replace('  organizationUnits: [],\n', '')
manager = manager.replace(
    "      organization_unit_id: emptyToNull(form.get('organization_unit_id')),\n      ecclesiastical_entity_id: selectedEntityId || null,\n      organization_unit_id: emptyToNull(form.get('organization_unit_id')),\n",
    "      organization_unit_id: emptyToNull(form.get('organization_unit_id')),\n      ecclesiastical_entity_id: selectedEntityId || null,\n",
)
manager = re.sub(
    r'\n\s*<select name="organization_unit_id" defaultValue="">\n\s*<option value="">Unidad organizativa</option>\n\s*\{catalogs\.organizationUnits\.map\([^\n]+\}\n\s*</select>\n',
    '\n',
    manager,
)
manager_path.write_text(manager, encoding='utf-8')

Path('src/lib/public/dashboard.ts').write_text("""import { fetchSupabaseJson } from '@/lib/supabase/rest'

export type PublicView = 'territorial' | 'clero' | 'pastoral' | 'administrativa' | 'colegial'

export type Diocese = {
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
  country_iso2: string | null
  country_name: string | null
}

export type Parish = {
  id: string
  name?: string | null
  slug?: string | null
  diocese_id: string | null
  diocese_name: string | null
  diocese_slug: string | null
}

export type Person = {
  id: string
  display_name: string
  slug: string
  person_type: string | null
  is_religious?: boolean | null
  status: string | null
  death_date: string | null
}

export type Assignment = {
  id: string
  person_id: string
  person_name: string | null
  person_slug: string | null
  person_type: string | null
  position_title: string | null
  base_role_name: string | null
  direct_entity_name: string | null
  direct_entity_slug: string | null
  direct_entity_type_name: string | null
  parish_name: string | null
  parish_slug: string | null
  zone_name: string | null
  zone_slug: string | null
  vicariate_name: string | null
  vicariate_slug: string | null
  diocese_name: string | null
  diocese_slug: string | null
  organization_unit_name: string | null
  organization_unit_slug: string | null
  is_current: boolean | null
  assignment_status: string | null
}

export type OrganizationChart = {
  id: string
  key: string
  name: string
  description: string | null
}

export type OrganizationUnit = {
  id: string
  organization_chart_id: string
  organization_chart_key: string
  organization_chart_name: string
  organization_chart_sort_order: number | null
  parent_unit_id: string | null
  parent_unit_name: string | null
  parent_unit_slug: string | null
  ecclesiastical_entity_id: string | null
  ecclesiastical_entity_name: string | null
  ecclesiastical_entity_slug: string | null
  pastoral_area_id: string | null
  pastoral_area_name: string | null
  pastoral_area_slug: string | null
  key: string
  slug: string
  name: string
  description: string | null
  sort_order: number | null
  valid_from: string | null
  valid_to: string | null
  is_current: boolean
}

export type PublicDashboardData = {
  countries: { key: string; name: string }[]
  dioceses: Diocese[]
  parishes: Parish[]
  people: Person[]
  assignments: Assignment[]
  organization_charts: OrganizationChart[]
  organization_units: OrganizationUnit[]
}

export type DashboardSummary = {
  dioceses: {
    total: number
    archdioceses: number
    dioceses: number
    military: number
    provinces: { name: string; count: number }[]
    total_catholics: number
    total_population: number
    total_parishes: number
    loaded_parishes: number
    reported_parishes: number
  }
  people: {
    total: number
    bishops: number
    priests: number
    deacons: number
    religious: number
    laypeople: number
    active: number
  }
}

function normalizeText(value?: string | null) {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function isArchdiocese(item: Pick<Diocese, 'entity_type_name'>) {
  return normalizeText(item.entity_type_name).includes('arquidiocesis')
}

function isDiocese(item: Pick<Diocese, 'entity_type_name'>) {
  const name = normalizeText(item.entity_type_name)
  return name.includes('diocesis') && !name.includes('arquidiocesis')
}

function isMilitary(item: Pick<Diocese, 'entity_type_name' | 'name'>) {
  const name = normalizeText(`${item.entity_type_name ?? ''} ${item.name}`)
  return name.includes('castrense') || name.includes('militar')
}

async function safeFetch<T>(table: string, params: Record<string, string>) {
  try {
    return await fetchSupabaseJson<T[]>(table, params)
  } catch (error) {
    console.warn(`Public dashboard optional source unavailable: ${table}`, error)
    return []
  }
}

export async function loadPublicDashboardData(): Promise<PublicDashboardData> {
  const [countries, dioceses, parishes, people, assignments, organizationCharts, organizationUnits] = await Promise.all([
    safeFetch<{ key: string; name: string }>('public_countries', { select: 'key,name', order: 'name.asc' }),
    fetchSupabaseJson<Diocese[]>('public_dioceses', { select: 'id,slug,name,entity_type_name,ecclesiastical_province_name,current_ordinary_name,current_ordinary_title,population_total,catholics_total,parishes_count,country_iso2,country_name', order: 'name.asc' }),
    safeFetch<Parish>('public_parishes', { select: 'id,name,slug,diocese_id,diocese_name,diocese_slug', status: 'eq.active', visibility: 'eq.public', order: 'name.asc' }),
    fetchSupabaseJson<Person[]>('person_public_directory', { select: 'id,display_name,slug,person_type,is_religious,status,death_date', status: 'eq.active', visibility: 'eq.public', death_date: 'is.null', order: 'display_name.asc' }),
    safeFetch<Assignment>('public_position_assignments_with_hierarchy', { select: 'id,person_id,person_name,person_slug,person_type,position_title,base_role_name,direct_entity_name,direct_entity_slug,direct_entity_type_name,parish_name,parish_slug,zone_name,zone_slug,vicariate_name,vicariate_slug,diocese_name,diocese_slug,organization_unit_name,organization_unit_slug,is_current,assignment_status', is_current: 'eq.true', order: 'person_name.asc' }),
    safeFetch<OrganizationChart>('organization_charts', { select: 'id,key,name,description', status: 'eq.active', visibility: 'eq.public', order: 'sort_order.asc,name.asc' }),
    safeFetch<OrganizationUnit>('public_organization_units', { select: 'id,organization_chart_id,organization_chart_key,organization_chart_name,organization_chart_sort_order,parent_unit_id,parent_unit_name,parent_unit_slug,ecclesiastical_entity_id,ecclesiastical_entity_name,ecclesiastical_entity_slug,pastoral_area_id,pastoral_area_name,pastoral_area_slug,key,slug,name,description,sort_order,valid_from,valid_to,is_current', status: 'eq.active', visibility: 'eq.public', is_current: 'eq.true', order: 'organization_chart_sort_order.asc,sort_order.asc,name.asc' }),
  ])

  return {
    countries: countries.length > 0 ? countries : [{ key: 'DO', name: 'República Dominicana' }],
    dioceses,
    parishes,
    people,
    assignments,
    organization_charts: organizationCharts,
    organization_units: organizationUnits,
  }
}

export async function loadDashboardSummary(): Promise<DashboardSummary> {
  const [dioceses, parishes, people] = await Promise.all([
    fetchSupabaseJson<Diocese[]>('public_dioceses', { select: 'id,slug,name,entity_type_name,ecclesiastical_province_name,current_ordinary_name,current_ordinary_title,population_total,catholics_total,parishes_count,country_iso2,country_name', order: 'name.asc' }),
    fetchSupabaseJson<{ id: string }[]>('public_ecclesiastical_entities', { select: 'id', entity_type_key: 'eq.parish', status: 'eq.active', visibility: 'eq.public' }),
    fetchSupabaseJson<Person[]>('person_public_directory', { select: 'id,display_name,slug,person_type,is_religious,status,death_date' }),
  ])

  const provinceMap = dioceses.reduce((map, item) => {
    if (item.ecclesiastical_province_name) map.set(item.ecclesiastical_province_name, (map.get(item.ecclesiastical_province_name) ?? 0) + 1)
    return map
  }, new Map<string, number>())
  const provinces = Array.from(provinceMap, ([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const countPeople = (type: string) => people.filter((item) => item.person_type === type).length

  return {
    dioceses: {
      total: dioceses.length,
      archdioceses: dioceses.filter(isArchdiocese).length,
      dioceses: dioceses.filter(isDiocese).length,
      military: dioceses.filter(isMilitary).length,
      provinces,
      total_catholics: dioceses.reduce((sum, item) => sum + (item.catholics_total ?? 0), 0),
      total_population: dioceses.reduce((sum, item) => sum + (item.population_total ?? 0), 0),
      total_parishes: parishes.length,
      loaded_parishes: parishes.length,
      reported_parishes: parishes.length,
    },
    people: {
      total: people.length,
      bishops: countPeople('bishop'),
      priests: countPeople('priest'),
      deacons: countPeople('deacon'),
      religious: people.filter((item) => item.is_religious).length,
      laypeople: countPeople('layperson'),
      active: people.filter((item) => item.status === 'active' && !item.death_date).length,
    },
  }
}
""", encoding='utf-8')

scope_path = Path('src/features/public/buildPublicDashboardScope.ts')
scope_text = scope_path.read_text(encoding='utf-8')
scope_text = scope_text.replace(
    'const scopedPastoral = initialData.organization_units.filter((item) => inScope(item.diocese_id, item.diocese_slug))',
    'const scopedPastoral = initialData.organization_units.filter((item) => inScope(item.ecclesiastical_entity_id, item.ecclesiastical_entity_slug))',
)
scope_text = scope_text.replace('item.level_name', 'item.organization_chart_name')
scope_text = scope_text.replace('item.level_order', 'item.organization_chart_sort_order')
scope_path.write_text(scope_text, encoding='utf-8')

shared_path = Path('src/features/public/PublicDashboardShared.tsx')
shared = shared_path.read_text(encoding='utf-8')
shared = shared.replace('item.linked_entity_slug', 'item.ecclesiastical_entity_slug')
shared = shared.replace('item.level_name', 'item.organization_chart_name')
shared = shared.replace('item.diocese_name', 'item.ecclesiastical_entity_name')
shared_path.write_text(shared, encoding='utf-8')

enhancement_path = Path('src/features/public/components/public-pastoral-enhancements.tsx')
enhancement = enhancement_path.read_text(encoding='utf-8')
enhancement = enhancement.replace('diocese_id', 'ecclesiastical_entity_id')
enhancement = enhancement.replace('diocese_name', 'ecclesiastical_entity_name')
enhancement = enhancement.replace('diocese_slug', 'ecclesiastical_entity_slug')
enhancement = enhancement.replace('level_name', 'organization_chart_name')
enhancement = enhancement.replace('level_order', 'organization_chart_sort_order')
enhancement_path.write_text(enhancement, encoding='utf-8')

people_pastoral_path = Path('src/features/public/PublicPeoplePastoralViews.tsx')
people_pastoral = people_pastoral_path.read_text(encoding='utf-8')
people_pastoral = people_pastoral.replace('item.level_name', 'item.organization_chart_name')
people_pastoral_path.write_text(people_pastoral, encoding='utf-8')

history_path = Path('src/features/personas/admin/PersonAssignmentHistory.tsx')
history = history_path.read_text(encoding='utf-8')
history = history.replace('  organization_unit_name: string | null\n  direct_entity_name', '  direct_entity_name', 1)
history = history.replace('organization_chart_name,organization_unit_name,direct_entity_name', 'organization_chart_name,direct_entity_name', 1)
history_path.write_text(history, encoding='utf-8')

entity_detail_path = Path('src/lib/public/entity-detail.ts')
entity_detail = entity_detail_path.read_text(encoding='utf-8')
entity_detail = entity_detail.replace('  organization_unit_name: string | null\n  direct_entity_name', '  direct_entity_name', 1)
entity_detail = entity_detail.replace("'organization_chart_name','organization_chart_key','organization_unit_name',\n  'direct_entity_name'", "'organization_chart_name','organization_chart_key',\n  'direct_entity_name'", 1)
entity_detail_path.write_text(entity_detail, encoding='utf-8')

person_detail_path = Path('src/lib/public/person-detail.ts')
person_detail = person_detail_path.read_text(encoding='utf-8')
person_detail = person_detail.replace('  organization_unit_name: string | null\n  ecclesiastical_entity_name', '  ecclesiastical_entity_name', 1)
person_detail = person_detail.replace("'id','position_title','organization_chart_name','organization_chart_key','organization_unit_name',\n  'ecclesiastical_entity_name'", "'id','position_title','organization_chart_name','organization_chart_key',\n  'ecclesiastical_entity_name'", 1)
person_detail_path.write_text(person_detail, encoding='utf-8')

package_path = Path('package.json')
package = json.loads(package_path.read_text(encoding='utf-8'))
package['scripts']['check:legacy'] = 'node scripts/check-no-legacy-pastoral.mjs'
package['scripts']['check'] = 'pnpm check:legacy && pnpm typecheck && pnpm test && pnpm build'
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

Path('scripts/check-no-legacy-pastoral.mjs').write_text("""import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const roots = ['src', 'tests']
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs'])
const patterns = [/pastoral_entity/i, /PastoralEntity/, /pastoralEntities/]
const findings = []

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await walk(absolute)
      continue
    }
    if (!extensions.has(path.extname(entry.name))) continue

    const content = await readFile(absolute, 'utf8')
    content.split(/\r?\n/).forEach((line, index) => {
      if (patterns.some((pattern) => pattern.test(line))) {
        findings.push(`${absolute}:${index + 1}: ${line.trim()}`)
      }
    })
  }
}

for (const root of roots) await walk(root)

if (findings.length > 0) {
  console.error('Se encontraron referencias al modelo pastoral heredado:')
  findings.forEach((finding) => console.error(`- ${finding}`))
  process.exit(1)
}

console.log('No se encontraron referencias al modelo pastoral heredado.')
""", encoding='utf-8')
