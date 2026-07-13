import Link from 'next/link'
import EntityDynamicOrganizationChart from './EntityDynamicOrganizationChart'
import EntityInstitutionalTimeline from './EntityInstitutionalTimeline'
import EntityRelationshipMap from './EntityRelationshipMap'
import type { PublicEntityDetail } from '@/lib/public/entity-detail'

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
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(date)
}

function formatRange(start: string | null, end: string | null) {
  return `${formatDate(start)} – ${end ? formatDate(end) : 'actual'}`
}

export default function EntityDetailServerView({ data }: { data: PublicEntityDetail }) {
  const { entity, appointment_history: appointmentHistory, statistics_snapshots: statisticsSnapshots, positions } = data
  const ordinaryAppointments = appointmentHistory
    .filter((item) => item.office_key && ordinaryOfficeKeys.has(item.office_key))
    .sort((left, right) => (hierarchyRank[left.office_key ?? ''] ?? 99) - (hierarchyRank[right.office_key ?? ''] ?? 99))
  const currentOrdinary = ordinaryAppointments.find((item) => item.is_current) ?? ordinaryAppointments[0] ?? null

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
            <span>{entity.country ?? 'República Dominicana'}</span>
            <span>{entity.province ?? '—'}</span>
            <span>{entity.municipality ?? '—'}</span>
          </div>
          <Link className="inline-link" href="/diocesis">Volver al directorio</Link>
        </aside>
      </div>

      <section className="dashboard-grid dashboard-summary">
        <div className="metric-card"><strong>{entity.entity_type_name ?? 'Entidad'}</strong><span>Tipo</span></div>
        <div className="metric-card"><strong>{formatNumber(entity.population_total)}</strong><span>Población reportada</span></div>
        <div className="metric-card"><strong>{formatNumber(entity.catholics_total)}</strong><span>Católicos reportados</span></div>
        <div className="metric-card"><strong>{formatArea(entity.area_km2)}</strong><span>Área</span></div>
      </section>

      <section className="card dashboard-section">
        <div className="section-heading"><div><p className="eyebrow">Datos básicos</p><h2>Información de la entidad</h2></div></div>
        <div className="public-directory-list">
          <div className="public-directory-item"><div><strong>Nombre oficial</strong><span>{entity.official_name ?? '—'}</span></div><small>{entity.latin_name ?? '—'}</small></div>
          <div className="public-directory-item"><div><strong>Sede o catedral</strong><span>{entity.cathedral_name ?? '—'}</span></div><small>{entity.territory_summary ?? 'Territorio no descrito'}</small></div>
          <div className="public-directory-item"><div><strong>Ubicación</strong><span>{entity.municipality ?? '—'}</span></div><small>{entity.address ?? '—'}</small></div>
          <div className="public-directory-item"><div><strong>Contacto</strong><span>{entity.phone ?? '—'}</span></div><small>{entity.website ?? '—'}</small></div>
          <div className="public-directory-item"><div><strong>Fecha de erección</strong><span>{formatDate(entity.erected_at)}</span></div><small>{entity.source_name ?? '—'}</small></div>
          <div className="public-directory-item"><div><strong>Estadísticas</strong><span>{entity.statistics_year ?? '—'}</span></div><small>{entity.parishes_count ?? '—'} parroquias reportadas</small></div>
        </div>
      </section>

      {currentOrdinary && (
        <section className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Autoridad actual</p><h2>Ordinario o responsable</h2></div></div>
          <div className="public-directory-list">
            <div className="public-directory-item">
              <div>
                <strong>{currentOrdinary.person_slug ? <Link href={`/personas/${currentOrdinary.person_slug}`}>{currentOrdinary.person_name ?? '—'}</Link> : currentOrdinary.person_name ?? '—'}</strong>
                <span>{currentOrdinary.office_name ?? '—'}</span>
              </div>
              <small>{formatRange(currentOrdinary.start_date, currentOrdinary.end_date)}</small>
            </div>
          </div>
        </section>
      )}

      <EntityRelationshipMap
        entity={entity}
        relatedEntities={data.related_entities}
        relationships={data.relationships}
      />

      <EntityInstitutionalTimeline
        payload={{
          entity: { name: entity.name, erected_at: entity.erected_at },
          evolution_events: data.evolution_events,
          appointment_history: data.appointment_history,
        }}
      />

      {statisticsSnapshots.length > 0 && (
        <section className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Estadísticas</p><h2>Snapshots históricos</h2></div></div>
          <div className="public-directory-list">
            {statisticsSnapshots.map((item) => (
              <div className="public-directory-item" key={item.id}>
                <div><strong>Año {item.statistics_year}</strong><span>{formatNumber(item.population_total)} habitantes</span></div>
                <small>{formatNumber(item.catholics_total)} católicos · {formatNumber(item.total_priests_count)} sacerdotes · {formatNumber(item.parishes_count)} parroquias</small>
              </div>
            ))}
          </div>
        </section>
      )}

      <EntityDynamicOrganizationChart positions={positions} />
    </main>
  )
}
