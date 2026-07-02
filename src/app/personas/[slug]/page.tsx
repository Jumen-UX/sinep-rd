'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type Person = {
  id: string
  display_name: string
  slug: string
  person_type: string | null
  photo_url: string | null
  biography_public: string | null
  status: string | null
  death_date: string | null
  created_at: string
  updated_at: string
}

type Clergy = {
  person_id: string
  diaconal_ordination_date: string | null
  priestly_ordination_date: string | null
  episcopal_ordination_date: string | null
  canonical_status: string | null
  incardination_entity_name: string | null
  incardination_entity_slug: string | null
  current_service_entity_name: string | null
  current_service_entity_slug: string | null
}

type Appointment = {
  id: string
  office_name: string | null
  entity_name: string | null
  entity_slug: string | null
  pastoral_entity_name: string | null
  pastoral_entity_slug: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  appointment_type: string | null
  notes_public: string | null
}

type Movement = {
  id: string
  entity_name: string | null
  entity_slug: string | null
  pastoral_entity_name: string | null
  pastoral_entity_slug: string | null
  movement_type: string | null
  title: string | null
  description: string | null
  effective_date: string | null
  end_date: string | null
}

type EpiscopalOrdination = {
  id: string
  ordination_date: string | null
  ordination_place: string | null
  principal_consecrator_person_name: string | null
  principal_consecrator_person_slug: string | null
  principal_consecrator_name: string | null
  co_consecrator_1_person_name: string | null
  co_consecrator_1_person_slug: string | null
  co_consecrator_1_name: string | null
  co_consecrator_2_person_name: string | null
  co_consecrator_2_person_slug: string | null
  co_consecrator_2_name: string | null
  source_name: string | null
  source_url: string | null
  source_checked_at: string | null
  verification_status: string | null
  notes_public: string | null
}

type PersonResponse = {
  person: Person
  clergy: Clergy | null
  appointments: Appointment[]
  movements: Movement[]
  episcopal_ordination: EpiscopalOrdination | null
}

function personTypeLabel(value: string | null) {
  const labels: Record<string, string> = {
    bishop: 'Obispo',
    priest: 'Sacerdote',
    deacon: 'Diácono',
    religious: 'Religioso/a',
    lay: 'Laico/a',
  }

  if (!value) return 'Persona'
  return labels[value] ?? value
}

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

function ConsecratorLink({ name, slug }: { name: string | null; slug: string | null }) {
  if (!name) return <span>No indicado</span>
  if (!slug) return <span>{name}</span>
  return <Link href={`/personas/${slug}`}>{name}</Link>
}

export default function PersonDetailPage() {
  const params = useParams<{ slug: string }>()
  const slug = useMemo(() => params.slug, [params.slug])
  const [data, setData] = useState<PersonResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadPerson() {
      try {
        const response = await fetch(`/api/personas?slug=${encodeURIComponent(slug)}`)
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error ?? 'No se pudo cargar la ficha')
        }

        setData(result as PersonResponse)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }

    loadPerson()
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

  const { person, clergy, appointments, movements, episcopal_ordination: episcopalOrdination } = data

  const principalConsecratorName = episcopalOrdination?.principal_consecrator_person_name ?? episcopalOrdination?.principal_consecrator_name ?? null
  const coConsecrator1Name = episcopalOrdination?.co_consecrator_1_person_name ?? episcopalOrdination?.co_consecrator_1_name ?? null
  const coConsecrator2Name = episcopalOrdination?.co_consecrator_2_person_name ?? episcopalOrdination?.co_consecrator_2_name ?? null

  return (
    <main className="container detail-page">
      <div className="detail-backlink">
        <Link href="/personas">← Volver al dashboard de personas</Link>
      </div>

      <section className="detail-hero card person-hero">
        {person.photo_url && <img className="person-photo" src={person.photo_url} alt={person.display_name} />}
        <div>
          <p className="eyebrow">{personTypeLabel(person.person_type)}</p>
          <h1>{person.display_name}</h1>
          {person.biography_public && <p className="lead">{person.biography_public}</p>}
        </div>
      </section>

      <section className="detail-grid">
        <article className="card detail-section">
          <h2>Información general</h2>
          <dl className="detail-list">
            <div><dt>Tipo</dt><dd>{personTypeLabel(person.person_type)}</dd></div>
            <div><dt>Estado</dt><dd>{person.status ?? 'No indicado'}</dd></div>
            <div><dt>Fallecimiento</dt><dd>{person.death_date ? formatDate(person.death_date) : 'No registrado'}</dd></div>
          </dl>
        </article>

        <article className="card detail-section">
          <h2>Perfil clerical</h2>
          {!clergy ? (
            <p className="meta">No hay perfil clerical registrado para esta persona.</p>
          ) : (
            <dl className="detail-list">
              <div><dt>Estado canónico</dt><dd>{clergy.canonical_status ?? 'No indicado'}</dd></div>
              <div><dt>Ordenación diaconal</dt><dd>{formatDate(clergy.diaconal_ordination_date)}</dd></div>
              <div><dt>Ordenación sacerdotal</dt><dd>{formatDate(clergy.priestly_ordination_date)}</dd></div>
              <div><dt>Ordenación episcopal</dt><dd>{formatDate(clergy.episcopal_ordination_date)}</dd></div>
              <div>
                <dt>Incardinación</dt>
                <dd>
                  {clergy.incardination_entity_slug ? (
                    <Link href={`/entidades/${clergy.incardination_entity_slug}`}>{clergy.incardination_entity_name}</Link>
                  ) : (
                    clergy.incardination_entity_name ?? 'No indicada'
                  )}
                </dd>
              </div>
              <div>
                <dt>Servicio actual</dt>
                <dd>
                  {clergy.current_service_entity_slug ? (
                    <Link href={`/entidades/${clergy.current_service_entity_slug}`}>{clergy.current_service_entity_name}</Link>
                  ) : (
                    clergy.current_service_entity_name ?? 'No indicado'
                  )}
                </dd>
              </div>
            </dl>
          )}
        </article>
      </section>

      <section className="card detail-section">
        <h2>Sucesión apostólica</h2>
        {!episcopalOrdination ? (
          <p className="meta">Todavía no hay datos públicos de ordenación episcopal para esta persona.</p>
        ) : (
          <dl className="detail-list">
            <div><dt>Fecha de ordenación episcopal</dt><dd>{formatDate(episcopalOrdination.ordination_date)}</dd></div>
            <div><dt>Lugar</dt><dd>{episcopalOrdination.ordination_place ?? 'No indicado'}</dd></div>
            <div>
              <dt>Consagrante principal</dt>
              <dd>
                <ConsecratorLink name={principalConsecratorName} slug={episcopalOrdination.principal_consecrator_person_slug} />
              </dd>
            </div>
            <div>
              <dt>Co-consagrante 1</dt>
              <dd>
                <ConsecratorLink name={coConsecrator1Name} slug={episcopalOrdination.co_consecrator_1_person_slug} />
              </dd>
            </div>
            <div>
              <dt>Co-consagrante 2</dt>
              <dd>
                <ConsecratorLink name={coConsecrator2Name} slug={episcopalOrdination.co_consecrator_2_person_slug} />
              </dd>
            </div>
            <div><dt>Verificación</dt><dd>{episcopalOrdination.verification_status ?? 'No indicada'}</dd></div>
            <div><dt>Fuente</dt><dd>{episcopalOrdination.source_name ?? 'No indicada'}</dd></div>
          </dl>
        )}
      </section>

      <section className="detail-grid">
        <article className="card detail-section">
          <h2>Nombramientos actuales</h2>
          {appointments.length === 0 ? (
            <p className="meta">No hay nombramientos públicos activos.</p>
          ) : (
            <div className="timeline-list">
              {appointments.map((appointment) => (
                <div className="timeline-item" key={appointment.id}>
                  <strong>{appointment.office_name ?? 'Cargo'}</strong>
                  {appointment.entity_slug ? (
                    <Link href={`/entidades/${appointment.entity_slug}`}>{appointment.entity_name}</Link>
                  ) : (
                    <span>{appointment.entity_name ?? appointment.pastoral_entity_name ?? 'Entidad no indicada'}</span>
                  )}
                  <small>Desde {formatDate(appointment.start_date)}</small>
                  {appointment.notes_public && <span className="meta">{appointment.notes_public}</span>}
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="card detail-section">
          <h2>Historial y movimientos</h2>
          {movements.length === 0 ? (
            <p className="meta">Todavía no hay movimientos históricos públicos.</p>
          ) : (
            <div className="timeline-list">
              {movements.map((movement) => (
                <div className="timeline-item" key={movement.id}>
                  <strong>{movement.title ?? movement.movement_type ?? 'Movimiento'}</strong>
                  {movement.entity_slug ? (
                    <Link href={`/entidades/${movement.entity_slug}`}>{movement.entity_name}</Link>
                  ) : (
                    <span>{movement.entity_name ?? movement.pastoral_entity_name ?? 'Entidad no indicada'}</span>
                  )}
                  <small>{formatDate(movement.effective_date)} — {movement.end_date ? formatDate(movement.end_date) : 'actual'}</small>
                  {movement.description && <span className="meta">{movement.description}</span>}
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  )
}
