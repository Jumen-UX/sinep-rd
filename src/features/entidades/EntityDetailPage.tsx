'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import EntityDynamicOrganizationChart, {
  type EntityOrganizationPosition,
} from './EntityDynamicOrganizationChart'
import EntityInstitutionalTimeline, {
  type EntityAuthorityAppointment,
  type EntityEvolutionEvent,
} from './EntityInstitutionalTimeline'
import EntityProfileNavigation from './EntityProfileNavigation'
import EntityRelationshipMap, {
  type EntityRelationship,
  type EntityRelationshipNode,
} from './EntityRelationshipMap'

type Entity = EntityRelationshipNode & {
  official_name: string | null
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

type Appointment = {
  person_name: string | null
  person_slug: string | null
  office_name: string | null
  start_date: string | null
  notes_public: string | null
}

type AppointmentHistory = Appointment & EntityAuthorityAppointment & {
  person_type: string | null
  birth_date: string | null
  age_text: string | null
  death_date: string | null
  priestly_ordination_date: string | null
  episcopal_ordination_date: string | null
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

type Position = EntityOrganizationPosition & {
  parish_name: string | null
  parish_slug: string | null
  zone_name: string | null
  zone_slug: string | null
  vicariate_name: string | null
  vicariate_slug: string | null
  diocese_name: string | null
  diocese_slug: string | null
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
}

type EntityResponse = {
  entity: Entity
  relationships: EntityRelationship[]
  related_entities: EntityRelationshipNode[]
  appointments: Appointment[]
  appointment_history: AppointmentHistory[]
  evolution_events: EntityEvolutionEvent[]
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

    void loadData()
  }, [slug])

  const entity = data?.entity
  const appointmentHistory = data?.appointment_history ?? []
  const statisticsSnapshots = data?.statistics_snapshots ?? []
  const positions = data?.positions ?? []

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

  if (error || !entity || !data) {
    return <main className="container dashboard-page"><div className="error-box">{error ?? 'No se encontró la entidad'}</div></main>
  }

  const activeRelationshipCount = data.relationships.filter((relationship) => relationship.is_current).length
  const activePositionCount = positions.filter((position) => position.is_current).length
  const timelineCount = data.evolution_events.length + ordinaryAppointments.length + (entity.erected_at ? 1 : 0)

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

      <EntityProfileNavigation
        hasAuthority={Boolean(currentOrdinary)}
        positionCount={activePositionCount}
        relationshipCount={activeRelationshipCount}
        statisticsCount={statisticsSnapshots.length}
        timelineCount={timelineCount}
      />

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

      <section className="card dashboard-section" id="datos">
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
        <section className="card dashboard-section" id="autoridad">
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

      <div id="jerarquia">
        <EntityRelationshipMap
          entity={entity}
          relatedEntities={data.related_entities}
          relationships={data.relationships}
        />
      </div>

      <div id="historia">
        <EntityInstitutionalTimeline
          payload={{
            entity: { name: entity.name, erected_at: entity.erected_at },
            evolution_events: data.evolution_events,
            appointment_history: data.appointment_history,
          }}
        />
      </div>

      {statisticsSnapshots.length > 0 && (
        <section className="card dashboard-section" id="estadisticas">
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

      <EntityDynamicOrganizationChart positions={positions} />
    </main>
  )
}
