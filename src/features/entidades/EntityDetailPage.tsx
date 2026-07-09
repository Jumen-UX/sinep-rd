'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type Entity = {
  id: string
  name: string
  official_name: string | null
  slug: string
  description: string | null
  entity_type_key: string | null
  entity_type_name: string | null
  latin_name: string | null
  cathedral_name: string | null
  territory_summary: string | null
  area_km2: number | null
  statistics_year: number | null
  population_total: number | null
  catholics_total: number | null
  catholics_percent: number | null
  parishes_count: number | null
  source_name: string | null
  source_checked_at: string | null
  country: string | null
  province: string | null
  municipality: string | null
  address: string | null
  phone: string | null
  website: string | null
  erected_at: string | null
}

type Relationship = {
  id: string
  parent_entity_id: string
  child_entity_id: string
  relationship_type: string | null
  start_date: string | null
  is_current: boolean
}

type RelatedEntity = {
  id: string
  name: string
  slug: string
}

type Appointment = {
  person_name: string | null
  person_slug: string | null
  office_name: string | null
  start_date: string | null
  notes_public: string | null
}

type AppointmentHistory = Appointment & {
  id: string
  office_key: string | null
  person_type: string | null
  birth_date: string | null
  age_text: string | null
  death_date: string | null
  priestly_ordination_date: string | null
  episcopal_ordination_date: string | null
  end_date: string | null
  is_current: boolean
}

type EvolutionEvent = {
  id: string
  event_type: string | null
  event_date: string | null
  title: string | null
  from_entity_display_name: string | null
  from_entity_slug: string | null
  from_entity_name: string | null
  to_entity_display_name: string | null
  to_entity_slug: string | null
  to_entity_name: string | null
  related_entity_display_name: string | null
  related_entity_slug: string | null
  related_entity_name: string | null
  territory_summary: string | null
}

type StatisticsSnapshot = {
  id: string
  statistics_year: number
  catholics_total: number | null
  population_total: number | null
  catholics_percent: number | null
  total_priests_count: number | null
  permanent_deacons_count: number | null
  male_religious_count: number | null
  female_religious_count: number | null
  parishes_count: number | null
  source_code: string | null
}

type Position = {
  id: string
  person_name: string | null
  person_slug: string | null
  position_title: string | null
  organization_chart_name: string | null
  organization_chart_key: string | null
  organization_unit_name: string | null
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
  hierarchy_path: string | null
  pastoral_entity_name: string | null
  pastoral_entity_slug: string | null
  predecessor_person_name: string | null
  predecessor_person_slug: string | null
  successor_person_name: string | null
  successor_person_slug: string | null
  start_date: string | null
  term_start_date: string | null
  term_end_date: string | null
  actual_end_date: string | null
  is_current: boolean
  assignment_status: string | null
}

type EntityResponse = {
  entity: Entity
  relationships: Relationship[]
  related_entities: RelatedEntity[]
  appointments: Appointment[]
  appointment_history: AppointmentHistory[]
  evolution_events: EvolutionEvent[]
  statistics_snapshots: StatisticsSnapshot[]
  positions: Position[]
}

const ordinaryOfficeKeys = new Set([
  'metropolitan_archbishop',
  'coadjutor_archbishop',
  'coadjutor_bishop',
  'diocesan_bishop',
  'auxiliary_bishop',
  'apostolic_administrator',
  'bishop_emeritus',
])

const hierarchyRank: Record<string, number> = {
  metropolitan_archbishop: 1,
  diocesan_bishop: 2,
  coadjutor_archbishop: 3,
  coadjutor_bishop: 3,
  apostolic_administrator: 4,
  auxiliary_bishop: 5,
  bishop_emeritus: 6,
}

function formatNumber(value: number | null) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('es-DO').format(value)
}

function formatArea(value: number | null) {
  if (value === null || value === undefined) return '—'
  return `${new Intl.NumberFormat('es-DO', { maximumFractionDigits: 2 }).format(value)} km²`
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

function formatRange(start: string | null, end: string | null) {
  return `${formatDate(start)} – ${end ? formatDate(end) : 'actual'}`
}

function yearsSince(value: string | null, endValue?: string | null) {
  if (!value) return null
  const start = new Date(`${value}T00:00:00`)
  const end = endValue ? new Date(`${endValue}T00:00:00`) : new Date()
  let years = end.getFullYear() - start.getFullYear()
  const beforeAnniversary = end.getMonth() < start.getMonth() || (end.getMonth() === start.getMonth() && end.getDate() < start.getDate())
  if (beforeAnniversary) years -= 1
  return years >= 0 ? years : null
}

function formatYears(value: string | null, label: string, endValue?: string | null) {
  const years = yearsSince(value, endValue)
  return years === null ? `${label}: —` : `${label}: ${years} años`
}

function formatCurrentAge(birthDate: string | null, ageText: string | null, deathDate?: string | null) {
  const years = yearsSince(birthDate, deathDate)
  if (years !== null) return `Edad actual: ${years} años`
  if (ageText) return `Edad actual: ${ageText} años`
  return 'Edad actual: —'
}

function eventTypeLabel(value: string | null) {
  const labels: Record<string, string> = {
    erection: 'Erección',
    elevation: 'Elevación',
    dismemberment: 'Desmembramiento',
    erection_by_dismemberment: 'Erección por desmembramiento',
    territory_loss: 'Pérdida territorial',
    territory_gain: 'Recepción territorial',
    territorial_reorganization: 'Reorganización territorial',
    name_change: 'Cambio de nombre',
    province_change: 'Cambio de provincia',
  }
  if (!value) return 'Evento'
  return labels[value] ?? value
}

function assignmentStatusLabel(value: string | null) {
  const labels: Record<string, string> = {
    active: 'Activo',
    term_expired_still_serving: 'Período vencido, continúa en funciones',
    renewed: 'Renovado',
    replaced: 'Sustituido',
    vacant: 'Vacante',
    suspended: 'Suspendido',
    ended: 'Finalizado',
  }
  if (!value) return 'No indicado'
  return labels[value] ?? value
}

function entityLink(name: string | null, slug: string | null) {
  if (!name) return '—'
  if (!slug) return name
  return <Link href={`/entidades/${slug}`}>{name}</Link>
}

function personLink(name: string | null, slug: string | null) {
  if (!name) return '—'
  if (!slug) return name
  return <Link href={`/personas/${slug}`}>{name}</Link>
}

function getEntityKind(entity: Entity) {
  const key = entity.entity_type_key ?? ''
  const name = (entity.entity_type_name ?? entity.name ?? '').toLowerCase()
  if (['archdiocese', 'diocese', 'military_ordinariate'].includes(key)) return 'diocesan'
  if (['parish', 'quasi_parish'].includes(key) || name.includes('parroquia')) return 'parish'
  if (['chapel', 'sanctuary'].includes(key) || name.includes('capilla') || name.includes('santuario')) return 'chapel'
  if (key === 'vicariate' || name.includes('vicar')) return 'vicariate'
  if (['pastoral_zone', 'deanery', 'pastoral_region'].includes(key) || name.includes('zona') || name.includes('decan')) return 'zone'
  if (key === 'curia_office') return 'administrative'
  return 'generic'
}

export function EntityDetailPageView() {
  const params = useParams<{ slug: string }>()
  const slug = params?.slug
  const [data, setData] = useState<EntityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      if (!slug) return
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/entidades/${slug}`)
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload.error ?? 'No se pudo cargar la entidad')
        }
        const payload = await response.json()
        setData(payload as EntityResponse)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [slug])

  const entity = data?.entity
  const appointments = data?.appointments ?? []
  const appointmentHistory = data?.appointment_history ?? []
  const relatedEntities = data?.related_entities ?? []
  const evolutionEvents = data?.evolution_events ?? []
  const statisticsSnapshots = data?.statistics_snapshots ?? []
  const positions = data?.positions ?? []
  const entityKind = entity ? getEntityKind(entity) : 'generic'

  const ordinaryAppointments = useMemo(() => {
    if (!appointmentHistory.length) return []
    return appointmentHistory
      .filter((item) => item.office_key && ordinaryOfficeKeys.has(item.office_key))
      .sort((left, right) => (hierarchyRank[left.office_key ?? ''] ?? 99) - (hierarchyRank[right.office_key ?? ''] ?? 99))
  }, [appointmentHistory])

  const currentOrdinary = ordinaryAppointments.find((item) => item.is_current) ?? ordinaryAppointments[0] ?? null

  if (loading) {
    return <main className="container dashboard-page"><div className="empty-state">Cargando entidad...</div></main>
  }

  if (error || !entity) {
    return <main className="container dashboard-page"><div className="error-box">{error ?? 'No se encontró la entidad'}</div></main>
  }

  return (
    <main className="container dashboard-page">
      <div className="dashboard-hero card dashboard-hero-split">
        <div>
          <p className="eyebrow">Ficha institucional</p>
          <h1>{entity.name}</h1>
          <p className="lead">{entity.description ?? 'Información institucional y trayectoria histórica'}</p>
        </div>
        <aside className="dashboard-path-card" aria-label="Ruta de la entidad">
          <p className="eyebrow">Ruta</p>
          <div className="dashboard-path-list">
            <span>República Dominicana</span>
            <span>{entity.country ?? '—'}</span>
            <span>{entity.province ?? '—'}</span>
          </div>
          <Link className="inline-link" href="/diocesis">Volver al directorio</Link>
        </aside>
      </div>

      <section className="dashboard-grid dashboard-summary">
        <div className="metric-card">
          <strong>{entity.entity_type_name ?? 'Entidad'}</strong>
          <span>Tipo</span>
        </div>
        <div className="metric-card">
          <strong>{formatNumber(entity.population_total)}</strong>
          <span>Población reportada</span>
        </div>
        <div className="metric-card">
          <strong>{formatNumber(entity.catholics_total)}</strong>
          <span>Católicos reportados</span>
        </div>
        <div className="metric-card">
          <strong>{formatArea(entity.area_km2)}</strong>
          <span>Área</span>
        </div>
      </section>

      <section className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Datos básicos</p>
            <h2>Información de la entidad</h2>
          </div>
        </div>
        <div className="public-directory-list">
          <div className="public-directory-item">
            <div><strong>Nombre oficial</strong><span>{entity.official_name ?? '—'}</span></div>
            <small>{entity.latin_name ?? '—'}</small>
          </div>
          <div className="public-directory-item">
            <div><strong>Ubicación</strong><span>{entity.municipality ?? '—'}</span></div>
            <small>{entity.address ?? '—'}</small>
          </div>
          <div className="public-directory-item">
            <div><strong>Contacto</strong><span>{entity.phone ?? '—'}</span></div>
            <small>{entity.website ?? '—'}</small>
          </div>
          <div className="public-directory-item">
            <div><strong>Fecha de erección</strong><span>{formatDate(entity.erected_at)}</span></div>
            <small>{entity.source_name ?? '—'}</small>
          </div>
        </div>
      </section>

      {currentOrdinary && (
        <section className="card dashboard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Autoridad actual</p>
              <h2>Ordinario o responsable</h2>
            </div>
          </div>
          <div className="public-directory-list">
            <div className="public-directory-item">
              <div><strong>{currentOrdinary.person_name ?? '—'}</strong><span>{currentOrdinary.office_name ?? '—'}</span></div>
              <small>{formatRange(currentOrdinary.start_date, currentOrdinary.end_date)}</small>
            </div>
          </div>
        </section>
      )}

      {relatedEntities.length > 0 && (
        <section className="card dashboard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Vinculación</p>
              <h2>Entidades relacionadas</h2>
            </div>
          </div>
          <div className="public-directory-list">
            {relatedEntities.map((item) => (
              <div className="public-directory-item" key={item.slug}>
                <div><strong>{item.name}</strong><span>{entityKind}</span></div>
                <small><Link href={`/entidades/${item.slug}`}>Ver ficha</Link></small>
              </div>
            ))}
          </div>
        </section>
      )}

      {evolutionEvents.length > 0 && (
        <section className="card dashboard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Historia</p>
              <h2>Eventos de evolución</h2>
            </div>
          </div>
          <div className="public-directory-list">
            {evolutionEvents.map((item) => (
              <div className="public-directory-item" key={item.id}>
                <div><strong>{item.title ?? eventTypeLabel(item.event_type)}</strong><span>{formatDate(item.event_date)}</span></div>
                <small>{item.territory_summary ?? '—'}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {statisticsSnapshots.length > 0 && (
        <section className="card dashboard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Estadísticas</p>
              <h2>Snapshots históricos</h2>
            </div>
          </div>
          <div className="public-directory-list">
            {statisticsSnapshots.map((item) => (
              <div className="public-directory-item" key={item.id}>
                <div><strong>Año {item.statistics_year}</strong><span>{formatNumber(item.population_total)}</span></div>
                <small>{formatNumber(item.catholics_total)} católicos</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {positions.length > 0 && (
        <section className="card dashboard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Organigrama</p>
              <h2>Posiciones y ocupantes</h2>
            </div>
          </div>
          <div className="public-directory-list">
            {positions.map((item) => (
              <div className="public-directory-item" key={item.id}>
                <div><strong>{item.position_title ?? 'Posición'}</strong><span>{item.organization_unit_name ?? '—'}</span></div>
                <small>{item.person_name ?? 'Vacante'}</small>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
