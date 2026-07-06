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
  birth_date: string | null
  age_text: string | null
  birth_place: string | null
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

type Position = {
  id: string
  position_title: string | null
  organization_chart_name: string | null
  organization_chart_key: string | null
  organization_unit_name: string | null
  ecclesiastical_entity_name: string | null
  ecclesiastical_entity_slug: string | null
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
  selection_method: string | null
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
  positions: Position[]
  movements: Movement[]
  episcopal_ordination: EpiscopalOrdination | null
}

function personTypeLabel(value: string | null) {
  const labels: Record<string, string> = {
    bishop: 'Obispo',
    priest: 'Sacerdote',
    deacon: 'Diácono',
    religious: 'Religioso/a',
    layperson: 'Laico/a',
  }

  if (!value) return 'Persona'
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

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

function yearsSince(value: string | null, endValue?: string | null) {
  if (!value) return null

  const start = new Date(`${value}T00:00:00`)
  const end = endValue ? new Date(`${endValue}T00:00:00`) : new Date()
  let years = end.getFullYear() - start.getFullYear()
  const beforeAnniversary =
    end.getMonth() < start.getMonth() ||
    (end.getMonth() === start.getMonth() && end.getDate() < start.getDate())

  if (beforeAnniversary) years -= 1
  return years >= 0 ? years : null
}

function metricYears(value: string | null, endValue?: string | null) {
  const years = yearsSince(value, endValue)
  return years === null ? '—' : `${years}`
}

function metricAge(birthDate: string | null, ageText: string | null, deathDate?: string | null) {
  const years = yearsSince(birthDate, deathDate)
  if (years !== null) return `${years}`
  return ageText ?? '—'
}

function ConsecratorLink({ name, slug }: { name: string | null; slug: string | null }) {
  if (!name) return <span>No indicado</span>
  if (!slug) return <span>{name}</span>
  return <Link href={`/personas/${slug}`}>{name}</Link>
}

function PersonLink({ name, slug }: { name: string | null; slug: string | null }) {
  if (!name) return <span>—</span>
  if (!slug) return <span>{name}</span>
  return <Link href={`/personas/${slug}`}>{name}</Link>
}

function EntityLink({ name, slug }: { name: string | null; slug: string | null }) {
  if (!name) return <span>Entidad no indicada</span>
  if (!slug) return <span>{name}</span>
  return <Link href={`/entidades/${slug}`}>{name}</Link>
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

  const { person, clergy, appointments, positions, movements, episcopal_ordination: episcopalOrdination } = data

  const principalConsecratorName = episcopalOrdination?.principal_consecrator_person_name ?? episcopalOrdination?.principal_consecrator_name ?? null
  const coConsecrator1Name = episcopalOrdination?.co_consecrator_1_person_name ?? episcopalOrdination?.co_consecrator_1_name ?? null
  const coConsecrator2Name = episcopalOrdination?.co_consecrator_2_person_name ?? episcopalOrdination?.co_consecrator_2_name ?? null
  const primaryAppointment = appointments[0] ?? null

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

      <section className="dashboard-grid dashboard-summary person-metrics">
        <div className="metric-card">
          <strong>{metricAge(person.birth_date, person.age_text, person.death_date)}</strong>
          <span>{person.death_date ? 'Edad al fallecer' : 'Edad actual'}</span>
        </div>
        <div className="metric-card">
          <strong>{metricYears(clergy?.priestly_ordination_date ?? null, person.death_date)}</strong>
          <span>Años como sacerdote</span>
        </div>
        <div className="metric-card">
          <strong>{metricYears(clergy?.episcopal_ordination_date ?? episcopalOrdination?.ordination_date ?? null, person.death_date)}</strong>
          <span>Años como obispo</span>
        </div>
        <div className="metric-card">
          <strong>{metricYears(primaryAppointment?.start_date ?? null, primaryAppointment?.end_date ?? person.death_date)}</strong>
          <span>En cargo principal</span>
        </div>
      </section>

      <section className="detail-grid">
        <article className="card detail-section">
          <h2>Información general</h2>
          <dl className="detail-list">
            <div><dt>Tipo</dt><dd>{personTypeLabel(person.person_type)}</dd></div>
            <div><dt>Fecha de nacimiento</dt><dd>{formatDate(person.birth_date)}</dd></div>
            <div><dt>Lugar de nacimiento</dt><dd>{person.birth_place ?? 'No indicado'}</dd></div>
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
            <div><dt>Consagrante principal</dt><dd><ConsecratorLink name={principalConsecratorName} slug={episcopalOrdination.principal_consecrator_person_slug} /></dd></div>
            <div><dt>Co-consagrante 1</dt><dd><ConsecratorLink name={coConsecrator1Name} slug={episcopalOrdination.co_consecrator_1_person_slug} /></dd></div>
            <div><dt>Co-consagrante 2</dt><dd><ConsecratorLink name={coConsecrator2Name} slug={episcopalOrdination.co_consecrator_2_person_slug} /></dd></div>
            <div><dt>Verificación</dt><dd>{episcopalOrdination.verification_status ?? 'No indicada'}</dd></div>
            <div><dt>Fuente</dt><dd>{episcopalOrdination.source_name ?? 'No indicada'}</dd></div>
          </dl>
        )}
      </section>

      <section className="card detail-section">
        <h2>Cargos configurados</h2>
        {positions.length === 0 ? (
          <p className="meta">Todavía no hay cargos configurados para esta persona.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table dashboard-list-table">
              <thead>
                <tr>
                  <th>Cargo</th>
                  <th>Organigrama</th>
                  <th>Entidad / unidad</th>
                  <th>Período</th>
                  <th>Estado</th>
                  <th>Predecesor</th>
                  <th>Sucesor</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => (
                  <tr key={position.id}>
                    <td><strong>{position.position_title ?? 'Cargo'}</strong><small>{position.selection_method ?? 'nombramiento'}</small></td>
                    <td>{position.organization_chart_name ?? 'No indicado'}</td>
                    <td>
                      <EntityLink
                        name={position.ecclesiastical_entity_name ?? position.pastoral_entity_name ?? position.organization_unit_name}
                        slug={position.ecclesiastical_entity_slug ?? position.pastoral_entity_slug}
                      />
                    </td>
                    <td>{formatDate(position.term_start_date ?? position.start_date)} – {position.actual_end_date ? formatDate(position.actual_end_date) : position.term_end_date ? formatDate(position.term_end_date) : 'actual'}</td>
                    <td>{assignmentStatusLabel(position.assignment_status)}</td>
                    <td><PersonLink name={position.predecessor_person_name} slug={position.predecessor_person_slug} /></td>
                    <td><PersonLink name={position.successor_person_name} slug={position.successor_person_slug} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                  <small>Desde {formatDate(appointment.start_date)} · {metricYears(appointment.start_date, person.death_date)} años en el cargo</small>
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
