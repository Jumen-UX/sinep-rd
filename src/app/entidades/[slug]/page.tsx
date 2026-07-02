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
  facebook_url: string | null
  instagram_url: string | null
  youtube_url: string | null
  erected_at: string | null
  created_at: string
  updated_at: string
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
  created_at: string
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

type EntityResponse = {
  entity: Entity
  relationships: Relationship[]
  related_entities: RelatedEntity[]
  appointments: Appointment[]
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
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
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

  const { entity, relationships, related_entities: relatedEntities, appointments } = data

  function getRelatedName(id: string) {
    return relatedEntities.find((item) => item.id === id)?.name ?? 'Entidad relacionada'
  }

  function getRelatedSlug(id: string) {
    return relatedEntities.find((item) => item.id === id)?.slug
  }

  return (
    <main className="container detail-page">
      <div className="detail-backlink">
        <Link href="/diocesis">← Volver al dashboard</Link>
      </div>

      <section className="detail-hero card">
        <p className="eyebrow">{entity.entity_type_name ?? 'Entidad eclesiástica'}</p>
        <h1>{entity.name}</h1>
        {entity.latin_name && <p className="lead italic-meta">{entity.latin_name}</p>}
        {entity.description && <p className="lead">{entity.description}</p>}
      </section>

      <section className="detail-grid">
        <article className="card detail-section">
          <h2>Información general</h2>
          <dl className="detail-list">
            <div><dt>Nombre oficial</dt><dd>{entity.official_name ?? entity.name}</dd></div>
            <div><dt>Tipo</dt><dd>{entity.entity_type_name ?? 'No indicado'}</dd></div>
            <div><dt>Catedral / sede</dt><dd>{entity.cathedral_name ?? 'No indicada'}</dd></div>
            <div><dt>Ordinario actual</dt><dd>{entity.current_ordinary_name ?? 'No indicado'}</dd></div>
            <div><dt>Título</dt><dd>{entity.current_ordinary_title ?? 'No indicado'}</dd></div>
            <div><dt>Fecha de erección</dt><dd>{formatDate(entity.erected_at)}</dd></div>
          </dl>
        </article>

        <article className="card detail-section">
          <h2>Territorio y contacto</h2>
          <dl className="detail-list">
            <div><dt>Territorio</dt><dd>{entity.territory_summary ?? 'No indicado'}</dd></div>
            <div><dt>Provincia civil</dt><dd>{entity.province ?? 'No indicada'}</dd></div>
            <div><dt>Municipio</dt><dd>{entity.municipality ?? 'No indicado'}</dd></div>
            <div><dt>Sector</dt><dd>{entity.sector ?? 'No indicado'}</dd></div>
            <div><dt>Dirección</dt><dd>{entity.address ?? 'No indicada'}</dd></div>
            <div><dt>Teléfono</dt><dd>{entity.phone ?? 'No indicado'}</dd></div>
            <div><dt>Email</dt><dd>{entity.email ?? 'No indicado'}</dd></div>
            <div><dt>Web</dt><dd>{entity.website ?? 'No indicada'}</dd></div>
          </dl>
        </article>
      </section>

      <section className="card detail-section">
        <h2>Estadísticas pastorales</h2>
        <div className="diocese-stats detail-stats">
          <div><strong>{formatArea(entity.area_km2)}</strong><span>Superficie</span></div>
          <div><strong>{formatNumber(entity.population_total)}</strong><span>Población total</span></div>
          <div><strong>{formatNumber(entity.catholics_total)}</strong><span>Fieles católicos</span></div>
          <div><strong>{entity.catholics_percent ?? '—'}%</strong><span>% católicos</span></div>
          <div><strong>{formatNumber(entity.parishes_count)}</strong><span>Parroquias</span></div>
          <div><strong>{entity.statistics_year ?? '—'}</strong><span>Año estadístico</span></div>
        </div>
      </section>

      <section className="detail-grid">
        <article className="card detail-section">
          <h2>Responsables actuales</h2>
          {appointments.length === 0 ? (
            <p className="meta">Todavía no hay nombramientos públicos registrados.</p>
          ) : (
            <div className="timeline-list">
              {appointments.map((appointment) => (
                <div className="timeline-item" key={`${appointment.person_name}-${appointment.office_name}-${appointment.start_date}`}>
                  <strong>{appointment.office_name ?? 'Cargo'}</strong>
                  {appointment.person_slug ? (
                    <Link href={`/personas/${appointment.person_slug}`}>{appointment.person_name ?? 'Persona no indicada'}</Link>
                  ) : (
                    <span>{appointment.person_name ?? 'Persona no indicada'}</span>
                  )}
                  <small>Desde {formatDate(appointment.start_date)}</small>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="card detail-section">
          <h2>Historial de relaciones</h2>
          {relationships.length === 0 ? (
            <p className="meta">Todavía no hay historial territorial registrado.</p>
          ) : (
            <div className="timeline-list">
              {relationships.map((relationship) => {
                const otherId = relationship.parent_entity_id === entity.id ? relationship.child_entity_id : relationship.parent_entity_id
                const relatedSlug = getRelatedSlug(otherId)
                const relatedName = getRelatedName(otherId)
                return (
                  <div className="timeline-item" key={relationship.id}>
                    <strong>{relationship.relationship_type ?? 'Relación'}</strong>
                    {relatedSlug ? (
                      <Link href={`/entidades/${relatedSlug}`}>{relatedName}</Link>
                    ) : (
                      <span>{relatedName}</span>
                    )}
                    <small>
                      {formatDate(relationship.start_date)} — {relationship.end_date ? formatDate(relationship.end_date) : 'actual'}
                    </small>
                  </div>
                )
              })}
            </div>
          )}
        </article>
      </section>

      <section className="card detail-section">
        <h2>Fuente y revisión</h2>
        <p className="meta">
          {entity.source_name ?? 'Fuente no indicada'}
          {entity.source_checked_at ? ` · Revisado: ${formatDate(entity.source_checked_at)}` : ''}
        </p>
        {entity.source_url && (
          <a className="button button-secondary" href={entity.source_url} target="_blank" rel="noreferrer">
            Ver fuente
          </a>
        )}
      </section>
    </main>
  )
}
