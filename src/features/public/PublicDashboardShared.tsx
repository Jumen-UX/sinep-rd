'use client'

import Link from 'next/link'
import type {
  Assignment,
  DashboardSummary,
  Diocese,
  OrganizationUnit,
  PublicDashboardData,
  PublicView,
} from '@/lib/public/dashboard'

export type Props = {
  initialData: PublicDashboardData
  initialSummary: DashboardSummary
  initialView: PublicView
  initialProvince: string
}

export type PersonCard = {
  id: string
  name: string
  slug: string | null
  href?: string
  personType: string | null
  role: string
  scope: string
}

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

export function normalize(value?: string | null) {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function slugify(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('es-DO').format(value ?? 0)
}

export function isSpecial(item: Diocese) {
  const value = normalize(`${item.entity_type_name ?? ''} ${item.name}`)
  return ['militar', 'castrense', 'ordinariato', 'personal'].some((term) => value.includes(term))
}

export function isArchdiocese(item: Diocese) {
  return normalize(item.entity_type_name).includes('arquidiocesis')
}

export function isDiocese(item: Diocese) {
  const value = normalize(item.entity_type_name)
  return value.includes('diocesis') && !value.includes('arquidiocesis')
}

export function splitValues(value?: string | null) {
  return (value ?? '').split(';').map((item) => item.trim()).filter(Boolean)
}

export function assignmentMatches(assignment: Assignment, slugs: Set<string>) {
  return [
    assignment.direct_entity_slug,
    assignment.parish_slug,
    assignment.zone_slug,
    assignment.vicariate_slug,
    assignment.diocese_slug,
    assignment.organization_unit_slug,
  ].some((slug) => Boolean(slug && slugs.has(slug)))
}

export function personTypeLabel(value: string | null) {
  const labels: Record<string, string> = {
    bishop: 'Obispo',
    priest: 'Sacerdote',
    deacon: 'Diácono',
    religious: 'Religioso/a',
    layperson: 'Laico/a',
  }
  return value ? labels[value] ?? value : 'Persona'
}

export function Metric({ label, value, detail, onClick, active = false }: { label: string; value: string | number; detail: string; onClick?: () => void; active?: boolean }) {
  const content = <><strong>{label}</strong><b>{value}</b><small>{detail}</small></>
  return onClick
    ? <button className={`public-metric-card ${active ? 'active' : ''}`} onClick={onClick} type="button">{content}</button>
    : <article className="public-metric-card">{content}</article>
}

export function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="public-empty"><strong>{title}</strong><br /><span>{detail}</span></div>
}

export function JurisdictionRow({ item }: { item: Diocese }) {
  const ordinary = splitValues(item.current_ordinary_name).find((name) => !normalize(name).includes('vacante'))
  return (
    <Link className="public-row" href={`/entidades/${item.slug}`}>
      <span className="public-row-main"><span className="public-row-icon" aria-hidden="true">{isSpecial(item) ? '盾' : '⌂'}</span><span><strong>{item.name}</strong><small>{ordinary ?? 'Ordinario no publicado'}</small></span></span>
      <span className="public-type">{item.entity_type_name ?? 'Jurisdicción'}</span>
      <span className="public-link">Ver ficha →</span>
    </Link>
  )
}

export function PersonItem({ item }: { item: PersonCard }) {
  const content = <><strong>{item.name}</strong><span>{item.role} · {item.scope}</span><span>{personTypeLabel(item.personType)}</span></>
  const href = item.href ?? (item.slug ? `/personas/${item.slug}` : null)
  return href
    ? <Link className="public-directory-item" href={href}>{content}</Link>
    : <article className="public-directory-item">{content}</article>
}

export function PastoralItem({ item }: { item: OrganizationUnit }) {
  const href = item.ecclesiastical_entity_slug ? `/entidades/${item.ecclesiastical_entity_slug}` : `/pastoral/${item.slug}`
  const scope = item.ecclesiastical_entity_name ?? item.pastoral_area_name ?? 'Ámbito no indicado'
  return <Link className="public-directory-item" href={href}><strong>{item.name}</strong><span>{item.organization_chart_name ?? 'Organigrama'} · {scope}</span><span className="public-link">Ver ficha →</span></Link>
}
