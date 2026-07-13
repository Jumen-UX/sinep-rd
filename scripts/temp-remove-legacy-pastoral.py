from __future__ import annotations

import json
import re
from pathlib import Path

ROOTS = (Path('src'), Path('tests'))
TEXT_SUFFIXES = {'.ts', '.tsx', '.js', '.jsx', '.mjs'}

REPLACEMENTS = [
    ('current_pastoral_entity_name', 'current_organization_unit_name'),
    ('current_pastoral_entity_id', 'current_organization_unit_id'),
    ('parent_pastoral_entity_name', 'parent_unit_name'),
    ('parent_pastoral_entity_slug', 'parent_unit_slug'),
    ('parent_pastoral_entity_id', 'parent_unit_id'),
    ('linked_pastoral_entity_id', 'linked_organization_unit_id'),
    ('pastoral_entity_name', 'organization_unit_name'),
    ('pastoral_entity_slug', 'organization_unit_slug'),
    ('pastoral_entity_id', 'organization_unit_id'),
    ('public_pastoral_entities', 'public_organization_units'),
    ('pastoral_entities', 'organization_units'),
    ('pastoralEntities', 'organizationUnits'),
    ('PastoralEntity', 'OrganizationUnit'),
    ('pastoralResult', 'organizationUnitResult'),
    ("'pastoral_entity'", "'organization_unit'"),
    ('"pastoral_entity"', '"organization_unit"'),
    ('Entidad pastoral', 'Unidad organizativa'),
    ('entidad pastoral', 'unidad organizativa'),
    ('Entidades pastorales', 'Unidades organizativas'),
    ('entidades pastorales', 'unidades organizativas'),
]


def write(path: str, content: str) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content.rstrip() + '\n', encoding='utf-8')


def transform_text_files() -> None:
    for root in ROOTS:
        if not root.exists():
            continue
        for path in root.rglob('*'):
            if not path.is_file() or path.suffix not in TEXT_SUFFIXES:
                continue
            original = path.read_text(encoding='utf-8')
            updated = original
            for old, new in REPLACEMENTS:
                updated = updated.replace(old, new)
            if updated != original:
                path.write_text(updated, encoding='utf-8')


def dedupe_type_block(text: str, marker: str) -> str:
    start = text.find(marker)
    if start < 0:
        return text
    body_start = text.find('\n', start) + 1
    end = text.find('\n}', body_start)
    if body_start <= 0 or end < 0:
        return text
    lines = text[body_start:end].splitlines()
    seen: set[str] = set()
    output: list[str] = []
    for line in lines:
        match = re.match(r'\s*([A-Za-z_][A-Za-z0-9_]*)\??:', line)
        if match:
            key = match.group(1)
            if key in seen:
                continue
            seen.add(key)
        output.append(line)
    return text[:body_start] + '\n'.join(output) + text[end:]


def dedupe_column_arrays(text: str) -> str:
    pattern = re.compile(r"const\s+(\w+Columns)\s*=\s*\[(.*?)\]\.join\(','\)", re.S)

    def replace(match: re.Match[str]) -> str:
        name = match.group(1)
        values = re.findall(r"'([^']+)'", match.group(2))
        seen: set[str] = set()
        unique: list[str] = []
        for value in values:
            if value in seen:
                continue
            seen.add(value)
            unique.append(value)
        rows = '\n'.join(f"  '{value}'," for value in unique)
        return f"const {name} = [\n{rows}\n].join(',')"

    return pattern.sub(replace, text)


transform_text_files()

write('src/lib/public/dashboard.ts', r"""import { fetchSupabaseJson } from '@/lib/supabase/rest'

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
""")

write('src/features/appointments/services/assignment-admin-service.ts', r"""import type { SupabaseClient } from '@supabase/supabase-js'
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

export type AssignmentChart = { id: string; key: string; name: string }

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
    supabase.from('person_ecclesial_state').select('id,display_name,slug,highest_ordination_degree,effective_person_type').eq('status', 'active').order('display_name'),
    supabase.from('office_configurations').select('id,key,display_name,organization_chart_id,default_term_months,continues_until_replaced,required_ordination_degree,allowed_person_types,allowed_episcopal_role_types,allowed_clerical_statuses,holder_cardinality,max_current_holders').eq('status', 'active').order('display_name'),
    supabase.from('organization_charts').select('id,key,name').eq('status', 'active').order('sort_order'),
    supabase.from('organization_units').select('id,name,slug,organization_chart_id').eq('status', 'active').eq('is_current', true).order('name'),
    supabase.from('public_position_assignments_with_hierarchy').select('id,person_name,person_slug,position_title,organization_chart_name,organization_unit_name,direct_entity_name,hierarchy_path,predecessor_person_name,successor_person_name,start_date,term_start_date,term_end_date,actual_end_date,assignment_status').order('start_date', { ascending: false, nullsFirst: false }).limit(100),
    supabase.from('position_assignments').select('id,person_id,office_configuration_id,organization_chart_id,organization_unit_id,ecclesiastical_entity_id,title_override,is_current,record_status').order('created_at', { ascending: false }).limit(500),
  ])

  const error = peopleResult.error ?? configResult.error ?? chartResult.error ?? unitResult.error ?? assignmentResult.error ?? rawAssignmentResult.error
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

export async function checkAssignmentEligibility(supabase: SupabaseClient, personId: string, officeConfigurationId: string, ecclesiasticalEntityId: string | null): Promise<AssignmentEligibility> {
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
""")

write('src/features/public/buildPublicDashboardScope.ts', r"""import type { OrganizationUnit, PublicDashboardData } from '@/lib/public/dashboard'
import { assignmentMatches, isSpecial, normalize, splitValues, type PersonCard } from './PublicDashboardShared'

export function buildPublicDashboardScope(initialData: PublicDashboardData, country: string, province: string, jurisdictionId: string) {
  const countryDioceses = initialData.dioceses.filter((item) => !item.country_iso2 || item.country_iso2 === country)
  const provinceMap = new Map<string, number>()
  countryDioceses.filter((item) => !isSpecial(item)).forEach((item) => {
    const name = item.ecclesiastical_province_name
    if (name) provinceMap.set(name, (provinceMap.get(name) ?? 0) + 1)
  })
  const provinces = Array.from(provinceMap, ([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const provinceDioceses = province ? countryDioceses.filter((item) => item.ecclesiastical_province_name === province) : countryDioceses
  const selectedJurisdiction = countryDioceses.find((item) => item.id === jurisdictionId) ?? null
  const scopedDioceses = selectedJurisdiction ? [selectedJurisdiction] : provinceDioceses
  const scopedIds = new Set(scopedDioceses.map((item) => item.id))
  const scopedSlugs = new Set(scopedDioceses.map((item) => item.slug))
  const scopeFiltered = Boolean(province || selectedJurisdiction)
  const inScope = (dioceseId: string | null, dioceseSlug: string | null) => !scopeFiltered || Boolean(
    (dioceseId && scopedIds.has(dioceseId)) || (dioceseSlug && scopedSlugs.has(dioceseSlug)),
  )
  const scopedParishes = initialData.parishes.filter((item) => inScope(item.diocese_id, item.diocese_slug))
  const scopedPastoral = initialData.organization_units.filter((item) => inScope(item.ecclesiastical_entity_id, item.ecclesiastical_entity_slug))
  const pastoralGroups = Array.from(scopedPastoral.reduce((map, item) => {
    const name = item.organization_chart_name ?? 'Sin organigrama configurado'
    const group = map.get(name) ?? { name, order: item.organization_chart_sort_order ?? 999, items: [] as OrganizationUnit[] }
    group.items.push(item)
    group.order = Math.min(group.order, item.organization_chart_sort_order ?? 999)
    map.set(name, group)
    return map
  }, new Map<string, { name: string; order: number; items: OrganizationUnit[] }>()).values()).sort((a, b) => a.order - b.order)

  const assignmentPeople = Array.from(new Map(initialData.assignments
    .filter((item) => !scopeFiltered || assignmentMatches(item, scopedSlugs))
    .map((item) => [item.person_id, {
      id: item.person_id,
      name: item.person_name ?? 'Persona sin nombre',
      slug: item.person_slug,
      personType: item.person_type,
      role: item.position_title ?? item.base_role_name ?? 'Asignación vigente',
      scope: item.direct_entity_name ?? item.organization_unit_name ?? item.parish_name ?? item.diocese_name ?? 'Ámbito no indicado',
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

  return { provinces, provinceDioceses, selectedJurisdiction, scopedDioceses, scopedParishes, scopedPastoral, pastoralGroups, scopeFiltered, assignmentPeople, ordinaryPeople }
}
""")

write('src/features/public/PublicDashboardShared.tsx', r"""'use client'

import Link from 'next/link'
import type { Assignment, DashboardSummary, Diocese, OrganizationUnit, PublicDashboardData, PublicView } from '@/lib/public/dashboard'

export type Props = {
  initialData: PublicDashboardData
  initialSummary: DashboardSummary
  initialView: PublicView
  initialProvince: string
}

export type PersonCard = { id: string; name: string; slug: string | null; href?: string; personType: string | null; role: string; scope: string }

export const views: { key: PublicView; title: string; icon: string; description: string }[] = [
  { key: 'territorial', title: 'Territorial', icon: '▱', description: 'Provincias, jurisdicciones y parroquias.' },
  { key: 'clero', title: 'Clero y agentes', icon: '♙', description: 'Obispos, sacerdotes, diáconos, consagrados y laicos.' },
  { key: 'pastoral', title: 'Pastoral', icon: '✝', description: 'Organigramas y unidades de la organización pastoral.' },
  { key: 'administrativa', title: 'Administración', icon: '▣', description: 'Curia, oficinas, departamentos y servicios.' },
  { key: 'colegial', title: 'Colegial', icon: '♧', description: 'Consejos, comisiones, comités y equipos.' },
]

export const sideNav = [
  { label: 'Inicio', icon: '⌂', href: '/' },
  { label: 'Territorio', icon: '◇', href: '/?vista=territorial' },
  { label: 'Personas', icon: '♙', href: '/?vista=clero' },
  { label: 'Pastoral', icon: '✝', href: '/?vista=pastoral' },
  { label: 'Administración', icon: '▣', href: '/?vista=administrativa' },
  { label: 'Colegial', icon: '♧', href: '/?vista=colegial' },
  { label: 'Diócesis', icon: '✥', href: '/diocesis' },
  { label: 'Directorio', icon: '▤', href: '/personas' },
  { label: 'Portal administrativo', icon: '⚙', href: '/admin' },
]

export function normalize(value?: string | null) { return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() }
export function slugify(value: string) { return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') }
export function formatNumber(value: number | null | undefined) { return new Intl.NumberFormat('es-DO').format(value ?? 0) }
export function isSpecial(item: Diocese) { const value = normalize(`${item.entity_type_name ?? ''} ${item.name}`); return ['militar', 'castrense', 'ordinariato', 'personal'].some((term) => value.includes(term)) }
export function isArchdiocese(item: Diocese) { return normalize(item.entity_type_name).includes('arquidiocesis') }
export function isDiocese(item: Diocese) { const value = normalize(item.entity_type_name); return value.includes('diocesis') && !value.includes('arquidiocesis') }
export function splitValues(value?: string | null) { return (value ?? '').split(';').map((item) => item.trim()).filter(Boolean) }

export function assignmentMatches(assignment: Assignment, slugs: Set<string>) {
  return [assignment.direct_entity_slug, assignment.parish_slug, assignment.zone_slug, assignment.vicariate_slug, assignment.diocese_slug, assignment.organization_unit_slug]
    .some((slug) => Boolean(slug && slugs.has(slug)))
}

export function personTypeLabel(value: string | null) {
  const labels: Record<string, string> = { bishop: 'Obispo', priest: 'Sacerdote', deacon: 'Diácono', religious: 'Religioso/a', layperson: 'Laico/a' }
  return value ? labels[value] ?? value : 'Persona'
}

export function Metric({ label, value, detail, onClick, active = false }: { label: string; value: string | number; detail: string; onClick?: () => void; active?: boolean }) {
  const content = <><strong>{label}</strong><b>{value}</b><small>{detail}</small></>
  return onClick ? <button className={`public-metric-card ${active ? 'active' : ''}`} onClick={onClick} type="button">{content}</button> : <article className="public-metric-card">{content}</article>
}

export function Empty({ title, detail }: { title: string; detail: string }) { return <div className="public-empty"><strong>{title}</strong><br /><span>{detail}</span></div> }

export function JurisdictionRow({ item }: { item: Diocese }) {
  const ordinary = splitValues(item.current_ordinary_name).find((name) => !normalize(name).includes('vacante'))
  return <Link className="public-row" href={`/entidades/${item.slug}`}><span className="public-row-main"><span className="public-row-icon" aria-hidden="true">{isSpecial(item) ? '盾' : '⌂'}</span><span><strong>{item.name}</strong><small>{ordinary ?? 'Ordinario no publicado'}</small></span></span><span className="public-type">{item.entity_type_name ?? 'Jurisdicción'}</span><span className="public-link">Ver ficha →</span></Link>
}

export function PersonItem({ item }: { item: PersonCard }) {
  const content = <><strong>{item.name}</strong><span>{item.role} · {item.scope}</span><span>{personTypeLabel(item.personType)}</span></>
  const href = item.href ?? (item.slug ? `/personas/${item.slug}` : null)
  return href ? <Link className="public-directory-item" href={href}>{content}</Link> : <article className="public-directory-item">{content}</article>
}

export function PastoralItem({ item }: { item: OrganizationUnit }) {
  const href = item.ecclesiastical_entity_slug ? `/entidades/${item.ecclesiastical_entity_slug}` : `/pastoral/${item.slug}`
  const scope = item.ecclesiastical_entity_name ?? item.pastoral_area_name ?? 'Ámbito no indicado'
  return <Link className="public-directory-item" href={href}><strong>{item.name}</strong><span>{item.organization_chart_name ?? 'Organigrama'} · {scope}</span><span className="public-link">Ver ficha →</span></Link>
}
""")

write('src/features/public/components/public-pastoral-enhancements.tsx', r"""'use client'

import { useEffect, useRef } from 'react'

type Diocese = { id: string; slug: string; name: string; entity_type_name: string | null; ecclesiastical_province_name: string | null }
type OrganizationUnit = { id: string; name: string; slug: string; ecclesiastical_entity_id: string | null; ecclesiastical_entity_name: string | null; ecclesiastical_entity_slug: string | null; organization_chart_name: string | null; organization_chart_sort_order: number | null }
type DashboardData = { dioceses: Diocese[]; organization_units: OrganizationUnit[] }

function normalize(value: string) { return value.trim().replace(/\s+/g, ' ') }
function normalizeForSearch(value: string) { return normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() }
function isSpecialJurisdiction(item: Diocese) { const label = normalizeForSearch(`${item.entity_type_name ?? ''} ${item.name}`); return label.includes('ordinariato') || label.includes('militar') || label.includes('castrense') || label.includes('personal') }
function findComboboxInput(labelText: string) { const labels = Array.from(document.querySelectorAll<HTMLLabelElement>('label')); const label = labels.find((item) => normalize(item.textContent ?? '').startsWith(labelText)); return label?.querySelector<HTMLInputElement>('input.public-combobox-input') ?? null }
function selectedComboboxValue(labelText: string) { return normalize(findComboboxInput(labelText)?.value ?? '') }
function chooseComboboxOption(labelText: string, optionText: string) { const input = findComboboxInput(labelText); if (!input) return; input.focus(); input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'ArrowDown' })); window.setTimeout(() => { const option = Array.from(document.querySelectorAll<HTMLButtonElement>('.public-combobox-option')).find((item) => normalize(item.textContent ?? '') === optionText); option?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })) }, 70) }
function clickMetricByLabel(labelText: string) { const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button.public-metric-card')); buttons.find((button) => normalize(button.textContent ?? '').includes(labelText))?.click() }
function buildCard(icon: string, title: string, subtitle: string, actionLabel: string, onClick: () => void) { const card = document.createElement('article'); card.className = 'public-province-card'; const marker = document.createElement('span'); marker.className = 'public-node-icon'; marker.setAttribute('aria-hidden', 'true'); marker.textContent = icon; const button = document.createElement('button'); button.type = 'button'; button.addEventListener('click', onClick); const strong = document.createElement('strong'); strong.textContent = title; const span = document.createElement('span'); span.textContent = subtitle; const action = document.createElement('span'); action.className = 'public-link'; action.textContent = actionLabel; button.append(strong, span); card.append(marker, button, action); return card }
function groupCount<T>(items: T[], keyFn: (item: T) => string) { const map = new Map<string, number>(); for (const item of items) { const key = keyFn(item); if (!key) continue; map.set(key, (map.get(key) ?? 0) + 1) } return map }

function renderPastoralPanel(data: DashboardData) {
  const pastoralPanel = document.querySelector<HTMLElement>('#panel-pastoral')
  if (!pastoralPanel) return
  const country = selectedComboboxValue('País') || 'República Dominicana'
  const province = selectedComboboxValue('Provincia eclesiástica')
  const jurisdiction = selectedComboboxValue('Jurisdicción')
  const hasProvince = province && province !== 'Todas las provincias'
  const hasJurisdiction = jurisdiction && jurisdiction !== 'Todas las jurisdicciones'
  const mode = hasJurisdiction ? 'jurisdiction' : hasProvince ? 'province' : 'country'
  const signature = `${mode}|${country}|${province}|${jurisdiction}|${data.dioceses.length}|${data.organization_units.length}`
  let container = pastoralPanel.querySelector<HTMLElement>('#public-pastoral-scope-panel')
  if (!container) { container = document.createElement('section'); container.id = 'public-pastoral-scope-panel'; container.className = 'public-content-grid public-province-content-grid'; pastoralPanel.querySelector('.public-metrics-grid')?.insertAdjacentElement('afterend', container) }
  if (container.dataset.signature === signature) return
  container.dataset.signature = signature

  const territorialDioceses = data.dioceses.filter((item) => !isSpecialJurisdiction(item))
  const selectedJurisdiction = data.dioceses.find((item) => item.name === jurisdiction)
  const selectedJurisdictionSlugs = selectedJurisdiction ? new Set([selectedJurisdiction.slug]) : new Set<string>()
  const selectedProvinceDioceses = hasProvince ? territorialDioceses.filter((item) => item.ecclesiastical_province_name === province) : []
  const provinceNames = Array.from(groupCount(territorialDioceses, (item) => item.ecclesiastical_province_name ?? '').entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'))
  const scopeUnits = selectedJurisdiction
    ? data.organization_units.filter((item) => Boolean(item.ecclesiastical_entity_slug && selectedJurisdictionSlugs.has(item.ecclesiastical_entity_slug)))
    : hasProvince
      ? data.organization_units.filter((item) => selectedProvinceDioceses.some((diocese) => diocese.slug === item.ecclesiastical_entity_slug))
      : data.organization_units
  const chartCounts = Array.from(groupCount(scopeUnits, (item) => item.organization_chart_name ?? 'Sin organigrama').entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'))

  const filterArticle = document.createElement('article'); filterArticle.className = 'public-panel public-section-card'; filterArticle.innerHTML = `<div class="public-section-title"><p class="eyebrow">Filtros pastorales</p><h2>${mode === 'country' ? 'Provincias eclesiásticas' : mode === 'province' ? 'Jurisdicciones de la provincia' : 'Organigramas configurados'}</h2><p>Usa estas tarjetas para bajar el ámbito pastoral sin depender solo de los selectores superiores.</p></div>`
  const filterList = document.createElement('div'); filterList.className = 'public-province-list'
  if (mode === 'country') for (const [name, count] of provinceNames) filterList.append(buildCard('⌂', name, `${count} jurisdicciones territoriales`, 'Filtrar →', () => chooseComboboxOption('Provincia eclesiástica', name)))
  if (mode === 'province') for (const item of selectedProvinceDioceses) filterList.append(buildCard('✝', item.name, item.entity_type_name ?? 'Jurisdicción', 'Filtrar →', () => chooseComboboxOption('Jurisdicción', item.name)))
  if (mode === 'jurisdiction') for (const [name, count] of chartCounts.slice(0, 6)) filterList.append(buildCard('▥', name, `${count} unidades publicadas`, 'Ver organigrama →', () => clickMetricByLabel(name)))
  if (filterList.children.length === 0) { const empty = document.createElement('div'); empty.className = 'public-empty'; empty.innerHTML = '<strong>Sin organización publicada</strong><br /><span>Cuando existan unidades organizativas públicas para este ámbito, aparecerán aquí.</span>'; filterList.append(empty) }
  filterArticle.append(filterList)

  const summaryArticle = document.createElement('article'); summaryArticle.className = 'public-panel public-section-card'; summaryArticle.innerHTML = `<div class="public-section-title"><p class="eyebrow">Estructura pastoral</p><h2>${scopeUnits.length} unidades publicadas</h2><p>${mode === 'country' ? country : mode === 'province' ? province : jurisdiction}</p></div>`
  const summaryGrid = document.createElement('div'); summaryGrid.className = 'public-directory-grid'
  for (const [name, count] of chartCounts.slice(0, 6)) { const item = document.createElement('button'); item.className = 'public-directory-item public-directory-button'; item.type = 'button'; item.addEventListener('click', () => clickMetricByLabel(name)); item.innerHTML = `<strong>${name}</strong><span>${count} unidades · Organigrama</span>`; summaryGrid.append(item) }
  if (summaryGrid.children.length === 0) { const empty = document.createElement('div'); empty.className = 'public-empty'; empty.innerHTML = '<strong>Vista pastoral en preparación</strong><br /><span>Falta publicar la organización para este ámbito.</span>'; summaryGrid.append(empty) }
  summaryArticle.append(summaryGrid)
  container.replaceChildren(filterArticle, summaryArticle)
}

export function PublicPastoralEnhancements() {
  const dataRef = useRef<DashboardData | null>(null)
  useEffect(() => {
    let cancelled = false
    async function load() { try { const response = await fetch('/api/dashboard/vistas'); if (!response.ok) return; const data = await response.json() as DashboardData; if (cancelled) return; dataRef.current = data; renderPastoralPanel(data) } catch (error) { console.warn('No se pudo mejorar la vista pastoral', error) } }
    load()
    const observer = new MutationObserver(() => { if (dataRef.current) renderPastoralPanel(dataRef.current) })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    const timer = window.setInterval(() => { if (dataRef.current) renderPastoralPanel(dataRef.current) }, 800)
    return () => { cancelled = true; observer.disconnect(); window.clearInterval(timer) }
  }, [])
  return null
}
""")

write('src/app/api/pastoral/route.ts', r"""import { NextRequest, NextResponse } from 'next/server'
import { fetchSupabaseJson } from '@/lib/supabase/rest'

const columns = [
  'id','name','slug','description','organization_chart_name','organization_chart_key','parent_unit_name','parent_unit_slug',
  'ecclesiastical_entity_name','ecclesiastical_entity_slug','pastoral_area_name','pastoral_area_slug','valid_from','valid_to','is_current','status','visibility',
].join(',')

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'Falta el identificador de la unidad organizativa' }, { status: 400 })
  try {
    const rows = await fetchSupabaseJson<Record<string, unknown>[]>('public_organization_units', {
      slug: `eq.${slug}`,
      status: 'eq.active',
      visibility: 'eq.public',
      select: columns,
      limit: '1',
    })
    const item = rows[0]
    if (!item) return NextResponse.json({ error: 'Unidad organizativa no encontrada' }, { status: 404 })
    return NextResponse.json({ item })
  } catch (error) {
    console.error('Unexpected organization unit API error', error)
    return NextResponse.json({ error: 'No se pudo cargar la unidad organizativa' }, { status: 500 })
  }
}
""")

write('src/app/(public)/pastoral/[slug]/page.tsx', r"""'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type OrganizationUnitDetail = {
  item: {
    name: string
    slug: string
    description: string | null
    organization_chart_name: string | null
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
        if (!response.ok) { setError(payload.error ?? 'No se pudo cargar la unidad organizativa.'); return }
        setDetail(payload as OrganizationUnitDetail)
      } finally { setLoading(false) }
    }
    loadDetail()
  }, [slug])

  if (loading) return <main className="container"><div className="empty-state">Cargando unidad organizativa...</div></main>
  if (error || !detail) return <main className="container"><div className="error-box">{error ?? 'Unidad organizativa no encontrada.'}</div></main>
  const item = detail.item
  return <main className="container dashboard-page home-dashboard"><div className="detail-backlink"><Link href="/?vista=pastoral">← Volver al explorador</Link></div><section className="home-hero-panel card"><div className="home-hero-copy"><p className="eyebrow">Unidad organizativa</p><h1>{item.name}</h1><p className="lead">{item.description ?? 'Ficha pública de la unidad organizativa seleccionada.'}</p><div className="home-hero-actions">{item.ecclesiastical_entity_slug && <Link className="button button-primary" href={`/entidades/${item.ecclesiastical_entity_slug}`}>Ver entidad vinculada</Link>}</div></div><aside className="home-context-card"><p className="eyebrow">Ubicación organizativa</p><h2>{item.organization_chart_name ?? 'Organigrama no indicado'}</h2><p className="meta">{item.ecclesiastical_entity_name ?? item.pastoral_area_name ?? 'Sin ámbito registrado'}{item.parent_unit_name ? ` · ${item.parent_unit_name}` : ''}</p></aside></section></main>
}
""")

# Assignment manager: keep one canonical organization-unit selector and payload field.
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

# Canonical field names in public/admin presentation.
for file_name in [
    'src/features/public/PublicPeoplePastoralViews.tsx',
    'src/features/personas/PersonDetailServerView.tsx',
    'src/features/personas/admin/PersonDetailPage.tsx',
]:
    path = Path(file_name)
    text = path.read_text(encoding='utf-8')
    text = text.replace('item.level_name', 'item.organization_chart_name')
    text = text.replace(' ?? position.organization_unit_name ?? position.organization_unit_name', ' ?? position.organization_unit_name')
    text = text.replace(' ?? position.organization_unit_slug ?? position.organization_unit_slug', ' ?? position.organization_unit_slug')
    text = text.replace('Tipo de sacerdote heredado', 'Tipo de sacerdote')
    path.write_text(text, encoding='utf-8')

# Remove duplicate properties introduced where both canonical and compatibility fields existed.
for file_name, markers in {
    'src/features/personas/admin/PersonAssignmentHistory.tsx': ['export type AssignmentHistoryItem = {'],
    'src/lib/public/person-detail.ts': ['export type PublicAppointment = {', 'export type PublicPosition = {', 'export type PublicMovement = {'],
    'src/lib/public/entity-detail.ts': ['export type PublicEntityPosition = {'],
}.items():
    path = Path(file_name)
    text = path.read_text(encoding='utf-8')
    for marker in markers:
        text = dedupe_type_block(text, marker)
    text = dedupe_column_arrays(text)
    text = text.replace('organization_chart_name,organization_unit_name,direct_entity_name', 'organization_chart_name,direct_entity_name')
    path.write_text(text, encoding='utf-8')

# Deduplicate all typed select arrays in API readers after canonical renaming.
for file_name in ['src/app/api/personas/route.ts', 'src/app/api/entidades/route.ts']:
    path = Path(file_name)
    path.write_text(dedupe_column_arrays(path.read_text(encoding='utf-8')), encoding='utf-8')

# Current canonical admin RPC result names.
person_list = Path('src/features/personas/admin/PersonListPage.tsx')
person_list.write_text(person_list.read_text(encoding='utf-8').replace('current_organization_unit_id', 'current_organization_unit_id').replace('current_organization_unit_name', 'current_organization_unit_name'), encoding='utf-8')

# Guard the source tree against reintroducing the removed model.
write('scripts/check-no-legacy-pastoral.mjs', r"""import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const roots = ['src', 'tests']
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs'])
const patterns = [/pastoral_entity/i, /PastoralEntity/, /pastoralEntities/, /public_pastoral_entities/i]
const findings = []

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) { await walk(absolute); continue }
    if (!extensions.has(path.extname(entry.name))) continue
    const content = await readFile(absolute, 'utf8')
    content.split(/\r?\n/).forEach((line, index) => {
      if (patterns.some((pattern) => pattern.test(line))) findings.push(`${absolute}:${index + 1}: ${line.trim()}`)
    })
  }
}

for (const root of roots) await walk(root)
if (findings.length > 0) {
  console.error('Se encontraron referencias al modelo organizativo eliminado:')
  findings.forEach((finding) => console.error(`- ${finding}`))
  process.exit(1)
}
console.log('No se encontraron referencias al modelo organizativo eliminado.')
""")

package_path = Path('package.json')
package = json.loads(package_path.read_text(encoding='utf-8'))
package['scripts']['check:legacy'] = 'node scripts/check-no-legacy-pastoral.mjs'
package['scripts']['check'] = 'pnpm check:legacy && pnpm typecheck && pnpm test && pnpm build'
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# Reassert the two security readers used by source-level contracts.
write('supabase/migrations/20260714011000_finalize_organization_unit_security_contracts.sql', r"""create or replace function app_private.current_user_can_publish_assignment_person(p_assignment_id uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'public','app_private','auth','pg_temp'
as $function$
declare
  v_assignment public.position_assignments%rowtype;
begin
  if auth.uid() is null or p_assignment_id is null then return false; end if;
  select * into v_assignment from public.position_assignments where id=p_assignment_id;
  if not found or v_assignment.person_id is null then return false; end if;
  if v_assignment.ecclesiastical_entity_id is not null then
    return app_private.current_user_can_manage_entity('people.publish',v_assignment.ecclesiastical_entity_id);
  end if;
  if v_assignment.organization_unit_id is not null then
    return public.current_user_has_permission('people.publish')
       and public.current_user_has_scope_access('organization_unit',v_assignment.organization_unit_id,null,null,v_assignment.organization_unit_id);
  end if;
  return public.current_user_is_super_or_national() and public.current_user_has_permission('people.publish');
end;
$function$;

revoke all on function app_private.current_user_can_publish_assignment_person(uuid) from public,anon,authenticated;

create or replace function app_private.admin_list_recent_audit_logs(p_limit integer default 100)
returns table(id uuid,actor_user_id uuid,actor_email text,actor_name text,action text,target_table text,target_id uuid,change_request_id uuid,created_at timestamptz)
language plpgsql
stable security definer
set search_path to 'public','app_private','auth','pg_temp'
as $function$
begin
  if auth.uid() is null or not (app_private.current_user_has_permission('audit.view') or app_private.current_user_has_permission('security.view') or app_private.current_user_is_super_or_national()) then
    raise exception 'No autorizado para ver auditoría' using errcode='42501';
  end if;
  return query
  select al.id,al.user_id,p.email::text,p.full_name::text,al.action,al.target_table,al.target_id,al.change_request_id,al.created_at
  from public.audit_logs al left join public.profiles p on p.id=al.user_id
  where app_private.current_user_is_super_or_national()
     or (al.scope_entity_id is not null and app_private.current_user_can_manage_entity('audit.view',al.scope_entity_id))
     or (al.scope_type='organization_unit' and app_private.current_user_has_scope_access('organization_unit',al.organization_unit_id,al.diocese_id,al.pastoral_area_id,al.organization_unit_id))
     or (al.scope_type='pastoral_area' and app_private.current_user_has_scope_access('pastoral_area',al.pastoral_area_id,al.diocese_id,al.pastoral_area_id,null))
  order by al.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),250));
end;
$function$;

revoke all on function app_private.admin_list_recent_audit_logs(integer) from public,anon,authenticated;
""")

# Point security contracts to the canonical final migration while retaining gateway assertions.
audit_test = Path('tests/audit-permission-scope-contract.test.mjs')
audit_text = audit_test.read_text(encoding='utf-8')
audit_anchor = "  new URL('../supabase/migrations/20260713160611_seal_review_queue_private_rpc.sql', import.meta.url),"
audit_addition = "  new URL('../supabase/migrations/20260714011000_finalize_organization_unit_security_contracts.sql', import.meta.url),"
if audit_addition not in audit_text:
    audit_text = audit_text.replace(audit_anchor, audit_anchor + '\n' + audit_addition)
audit_test.write_text(audit_text, encoding='utf-8')

review_test = Path('tests/review-security-contracts.test.mjs')
review_text = review_test.read_text(encoding='utf-8')
legacy_read = "  const sql = await readRepoFile('supabase/migrations/20260710163459_harden_review_person_publication_scope.sql')"
canonical_read = "  const sql = `${await readRepoFile('supabase/migrations/20260714011000_finalize_organization_unit_security_contracts.sql')}\\n${await readRepoFile('supabase/migrations/20260710163459_harden_review_person_publication_scope.sql')}`"
review_text = review_text.replace(legacy_read, canonical_read, 1)
review_test.write_text(review_text, encoding='utf-8')

# Final cleanup for any duplicate CSV identifiers created by compatibility removal.
for file_name in [
    'src/lib/public/person-detail.ts',
    'src/lib/public/entity-detail.ts',
    'src/app/api/personas/route.ts',
    'src/app/api/entidades/route.ts',
]:
    path = Path(file_name)
    path.write_text(dedupe_column_arrays(path.read_text(encoding='utf-8')), encoding='utf-8')
