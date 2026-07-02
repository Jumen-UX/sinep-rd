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
  current_ordinary_name: string | null
  current_ordinary_title: string | null
  territory_summary: string | null
  area_km2: number | null
  statistics_year: number | null
  population_total: number | null
  catholics_total: number | null
  catholics_percent: number | null
  parishes_count: number | null
  source_name: string | null
  source_url: string | null
  source_checked_at: string | null
  country: string | null
  province: string | null
  municipality: string | null
  sector: string | null
  address: string | null
  email: string | null
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
  end_date: string | null
  is_current: boolean
  status: string | null
  notes: string | null
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
  appointment_type: string | null
  notes_public: string | null
}

type AppointmentHistory = Appointment & {
  id: string
  person_id: string
  office_id: string
  entity_id: string
  office_key: string | null
  person_type: string | null
  end_date: string | null
  is_current: boolean
}

type EntityResponse = {
  entity: Entity
  relationships: Relationship[]
  related_entities: RelatedEntity[]
  appointments: Appointment[]
  appointment_history: AppointmentHistory[]
}

const ordinaryOfficeKeys = new Set([
  'metropolitan_archbishop',
  'coadjutor_archbishop',
  'diocesan_bishop',
  'auxiliary_bishop',
  'apostolic_administrator',
  'bishop_emeritus',
])

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

export default function EntityDetailPage() {
  const params = useParams<{ slug: string }>()
  const slug = useMemo(() => params.slug, [params.slug])
  const [data, setData] = useState<EntityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadEntity() {
      try {
        const response = await fetch(`/api/entidades?slug=${encodeURIComponent(slug)}`)
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error ?? 'No se pudo cargar la ficha')
        }

        setData(result as EntityResponse)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }

    loadEntity()
  }, [slug])

  if (loading) {
    return (
      <main className="container">
        <div className="empty-state">Cargando ficha...</div>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="container">
        <div className="error-box">{error ?? 'Ficha no encontrada'}</div>
      </main>
    )
  }

  const { entity, relationships, related_entities: relatedEntities, appointments, appointment_history: appointmentHistory } = data

  function getRelatedName(id: string) {
    return relatedEntities.find((item) => item.id === id)?.name ?? 'Entidad relacionada'
  }

  function getRelatedSlug(id: string) {
    return relatedEntities.find((item) => item.id === id)?.slug
  }

  const currentBishops = appointmentHistory
    .filter((appointment) => appointment.is_current && ordinaryOfficeKeys.has(appointment.office_key ?? ''))
    .sort((a, b) => (a.office_key ?? '').localeCompare(b.office_key ?? ''))

  const pastOrdinaries = appointmentHistory
    .filter((appointment) => !appointment.is_current && ordinaryOfficeKeys.has(appointment.office_key ?? ''))
    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))

  const fallbackCurrent = currentBishops.length > 0 ? [] : appointments
  const currentRelationships = relationships.filter((item) => item.is_current)

  return (
    <main className="container detail-page hierarchy-page">
      <div className="detail-backlink">
        <Link href="/diocesis">← Volver al dashboard</Link>
      </div>

      <section className="hierarchy-title card">
        <p className="eyebrow">{entity.entity_type_name ?? 'Entidad eclesiástica'}</p>
        <h1>{entity.official_name ?? entity.name}</h1>
        {entity.latin_name && <p className="latin-title">{entity.latin_name}</p>}
        {entity.description && <p className="meta hierarchy-description">{entity.description}</p>}
      </section>

      <section className="hierarchy-grid">
        <article className="card compact-section">
          <h2>Obispo(s)</h2>
          {currentBishops.length === 0 && fallbackCurrent.length === 0 ? (
            <p className="meta">No hay obispos o responsables actuales registrados.</p>
          ) : (
            <ul className="simple-list">
              {currentBishops.map((appointment) => (
                <li key={appointment.id}>
                  <span>{appointment.office_name ?? 'Cargo'}</span>
                  {appointment.person_slug ? (
                    <Link href={`/personas/${appointment.person_slug}`}>{appointment.person_name}</Link>
                  ) : (
                    <strong>{appointment.person_name ?? 'No indicado'}</strong>
                  )}
                </li>
              ))}
              {fallbackCurrent.map((appointment) => (
                <li key={`${appointment.person_name}-${appointment.office_name}`}>
                  <span>{appointment.office_name ?? 'Cargo'}</span>
                  {appointment.person_slug ? (
                    <Link href={`/personas/${appointment.person_slug}`}>{appointment.person_name}</Link>
                  ) : (
                    <strong>{appointment.person_name ?? 'No indicado'}</strong>
                  )}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="card compact-section">
          <h2>Información general</h2>
          <dl className="info-table">
            <div><dt>Tipo de jurisdicción</dt><dd>{entity.entity_type_name ?? 'No indicado'}</dd></div>
            <div><dt>Nombre latino</dt><dd>{entity.latin_name ?? 'No indicado'}</dd></div>
            <div><dt>Catedral / sede</dt><dd>{entity.cathedral_name ?? 'No indicada'}</dd></div>
            <div><dt>Rito</dt><dd>Latino (o Romano)</dd></div>
            <div><dt>País</dt><dd>{entity.country ?? 'República Dominicana'}</dd></div>
            <div><dt>Superficie</dt><dd>{formatArea(entity.area_km2)}</dd></div>
            <div><dt>Sitio web oficial</dt><dd>{entity.website ?? 'No indicado'}</dd></div>
            <div><dt>Dirección postal</dt><dd>{entity.address ?? 'No indicada'}</dd></div>
            <div><dt>Teléfono</dt><dd>{entity.phone ?? 'No indicado'}</dd></div>
          </dl>
        </article>
      </section>

      <section className="card compact-section">
        <h2>Detalles históricos</h2>
        <dl className="info-table two-column-info">
          <div><dt>Erigido</dt><dd>{formatDate(entity.erected_at)}</dd></div>
          <div><dt>Territorio</dt><dd>{entity.territory_summary ?? 'No indicado'}</dd></div>
          <div><dt>Provincia civil</dt><dd>{entity.province ?? 'No indicada'}</dd></div>
          <div><dt>Municipio</dt><dd>{entity.municipality ?? 'No indicado'}</dd></div>
          <div><dt>Fuente</dt><dd>{entity.source_name ?? 'No indicada'}</dd></div>
          <div><dt>Revisión</dt><dd>{formatDate(entity.source_checked_at)}</dd></div>
        </dl>
      </section>

      <section className="card compact-section">
        <h2>Ordinarios del pasado y del presente</h2>
        {pastOrdinaries.length === 0 && currentBishops.length === 0 ? (
          <p className="meta">Todavía no hay ordinarios históricos registrados.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Cargo</th>
                  <th>Periodo</th>
                </tr>
              </thead>
              <tbody>
                {[...pastOrdinaries, ...currentBishops].map((appointment) => (
                  <tr key={appointment.id}>
                    <td>
                      {appointment.person_slug ? (
                        <Link href={`/personas/${appointment.person_slug}`}>{appointment.person_name}</Link>
                      ) : (
                        appointment.person_name ?? 'No indicado'
                      )}
                    </td>
                    <td>{appointment.office_name ?? 'No indicado'}</td>
                    <td>{formatRange(appointment.start_date, appointment.end_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card compact-section">
        <h2>Estadística</h2>
        <div className="table-wrap">
          <table className="data-table stats-table">
            <thead>
              <tr>
                <th>Año</th>
                <th>Católicos</th>
                <th>Población total</th>
                <th>% católicos</th>
                <th>Parroquias</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{entity.statistics_year ?? '—'}</td>
                <td>{formatNumber(entity.catholics_total)}</td>
                <td>{formatNumber(entity.population_total)}</td>
                <td>{entity.catholics_percent ?? '—'}%</td>
                <td>{formatNumber(entity.parishes_count)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="card compact-section">
        <h2>Resumen histórico y relaciones</h2>
        {currentRelationships.length === 0 ? (
          <p className="meta">Todavía no hay relaciones territoriales registradas.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Evento</th>
                  <th>Entidad relacionada</th>
                </tr>
              </thead>
              <tbody>
                {currentRelationships.map((relationship) => {
                  const otherId = relationship.parent_entity_id === entity.id ? relationship.child_entity_id : relationship.parent_entity_id
                  const relatedSlug = getRelatedSlug(otherId)
                  const relatedName = getRelatedName(otherId)
                  return (
                    <tr key={relationship.id}>
                      <td>{formatDate(relationship.start_date)}</td>
                      <td>{relationship.relationship_type ?? 'Relación'}</td>
                      <td>
                        {relatedSlug ? <Link href={`/entidades/${relatedSlug}`}>{relatedName}</Link> : relatedName}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
