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

type EcclesialState = {
  id: string
  legacy_person_type: string | null
  highest_ordination_degree: 'diaconate' | 'presbyterate' | 'episcopate' | null
  ecclesial_condition: 'lay' | 'cleric'
  is_cleric: boolean
  is_lay: boolean
  has_diaconate: boolean
  has_presbyterate: boolean
  has_episcopate: boolean
  effective_person_type: string | null
  canonical_status: string | null
  incardination_entity_id: string | null
  incardination_entity_name: string | null
  incardination_institute_name: string | null
  incardination_kind: string | null
}

type OrdinationHistory = {
  person_id: string
  degree: 'diaconate' | 'presbyterate' | 'episcopate'
  ordination_date: string | null
  ordination_place: string | null
  principal_ordainer_person_id: string | null
  principal_ordainer_name: string | null
  principal_ordainer_slug: string | null
  assistant_ordainer_1_person_id: string | null
  assistant_ordainer_1_name: string | null
  assistant_ordainer_1_slug: string | null
  assistant_ordainer_2_person_id: string | null
  assistant_ordainer_2_name: string | null
  assistant_ordainer_2_slug: string | null
  source_name: string | null
  source_url: string | null
  source_checked_at: string | null
  verification_status: string | null
  notes_public: string | null
}

type ClericalHistory = {
  person_id: string
  dimension_type: 'incardination' | 'canonical_status' | 'episcopal_role' | 'dignity'
  dimension_key: string
  display_title: string | null
  related_entity_id: string | null
  related_entity_name: string | null
  related_entity_slug: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  has_right_of_succession: boolean | null
  detail_text: string | null
}

type EpiscopalRole = {
  person_id: string
  role_type: string
  jurisdiction_entity_id: string | null
  jurisdiction_name: string | null
  title_see_name: string | null
  start_date: string | null
  has_right_of_succession: boolean
}

type EcclesiasticalDignity = {
  person_id: string
  dignity_type: string
  title_text: string | null
  start_date: string | null
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
  ecclesial_state: EcclesialState | null
  ordination_history: OrdinationHistory[]
  clerical_history: ClericalHistory[]
  episcopal_roles: EpiscopalRole[]
  ecclesiastical_dignities: EcclesiasticalDignity[]
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

function ordinationDegreeLabel(value: string | null) {
  const labels: Record<string, string> = {
    diaconate: 'Diaconado',
    presbyterate: 'Presbiterado',
    episcopate: 'Episcopado',
  }
  if (!value) return 'Sin ordenación registrada'
  return labels[value] ?? value
}

function canonicalStatusLabel(value: string | null) {
  const labels: Record<string, string> = {
    active: 'Activo',
    retired: 'Retirado',
    emeritus: 'Emérito',
    suspended: 'Suspendido',
    restricted: 'Con restricciones',
    inactive: 'Inactivo',
    deceased: 'Fallecido',
    lost_clerical_state: 'Pérdida del estado clerical',
    unknown: 'No identificado',
  }
  if (!value) return 'No publicado'
  return labels[value] ?? value
}

function episcopalRoleLabel(value: string) {
  const labels: Record<string, string> = {
    diocesan: 'Obispo diocesano',
    auxiliary: 'Obispo auxiliar',
    coadjutor: 'Obispo coadjutor',
    titular: 'Obispo titular',
    emeritus: 'Obispo emérito',
    apostolic_administrator: 'Administrador apostólico',
    apostolic_vicar: 'Vicario apostólico',
    apostolic_prefect: 'Prefecto apostólico',
    other: 'Otra función episcopal',
  }
  return labels[value] ?? value
}

function dignityLabel(value: string) {
  const labels: Record<string, string> = {
    archbishop: 'Arzobispo',
    metropolitan: 'Metropolitano',
    cardinal: 'Cardenal',
    monsignor: 'Monseñor',
    patriarch: 'Patriarca',
    major_archbishop: 'Arzobispo mayor',
    other: 'Otra dignidad',
  }
  return labels[value] ?? value
}

function incardinationKindLabel(value: string | null) {
  const labels: Record<string, string> = {
    diocesan: 'Diocesana',
    religious_institute: 'Instituto religioso',
    society_apostolic_life: 'Sociedad de vida apostólica',
    personal_prelature: 'Prelatura personal',
    military_ordinariate: 'Ordinariato militar',
    other: 'Otra pertenencia',
    unknown: 'No identificada',
  }
  if (!value) return 'No indicada'
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

function historyTitle(item: ClericalHistory) {
  if (item.dimension_type === 'canonical_status') return canonicalStatusLabel(item.dimension_key)
  if (item.dimension_type === 'episcopal_role') return episcopalRoleLabel(item.dimension_key)
  if (item.dimension_type === 'dignity') return dignityLabel(item.dimension_key)
  return `Incardinación: ${incardinationKindLabel(item.dimension_key)}`
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
    end.getMonth() < start.getMonth()
    || (end.getMonth() === start.getMonth() && end.getDate() < start.getDate())

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
    return <main className="container"><div className="empty-state">Cargando ficha...</div></main>
  }

  if (error || !data) {
    return <main className="container"><div className="error-box">{error ?? 'Ficha no encontrada'}</div></main>
  }

  const {
    person,
    ecclesial_state: ecclesialState,
    ordination_history: ordinations,
    clerical_history: clericalHistory,
    episcopal_roles: episcopalRoles,
    ecclesiastical_dignities: dignities,
    appointments,
    positions,
    movements,
    episcopal_ordination: episcopalOrdination,
  } = data

  const effectivePersonType = ecclesialState?.effective_person_type ?? person.person_type
  const diaconate = ordinations.find((item) => item.degree === 'diaconate') ?? null
  const presbyterate = ordinations.find((item) => item.degree === 'presbyterate') ?? null
  const episcopate = ordinations.find((item) => item.degree === 'episcopate') ?? null
  const currentIncardination = clericalHistory.find(
    (item) => item.dimension_type === 'incardination' && item.is_current,
  ) ?? null
  const primaryAppointment = appointments[0] ?? null
  const principalConsecratorName = episcopalOrdination?.principal_consecrator_person_name
    ?? episcopalOrdination?.principal_consecrator_name
    ?? episcopate?.principal_ordainer_name
    ?? null
  const principalConsecratorSlug = episcopalOrdination?.principal_consecrator_person_slug
    ?? episcopate?.principal_ordainer_slug
    ?? null
  const coConsecrator1Name = episcopalOrdination?.co_consecrator_1_person_name
    ?? episcopalOrdination?.co_consecrator_1_name
    ?? episcopate?.assistant_ordainer_1_name
    ?? null
  const coConsecrator1Slug = episcopalOrdination?.co_consecrator_1_person_slug
    ?? episcopate?.assistant_ordainer_1_slug
    ?? null
  const coConsecrator2Name = episcopalOrdination?.co_consecrator_2_person_name
    ?? episcopalOrdination?.co_consecrator_2_name
    ?? episcopate?.assistant_ordainer_2_name
    ?? null
  const coConsecrator2Slug = episcopalOrdination?.co_consecrator_2_person_slug
    ?? episcopate?.assistant_ordainer_2_slug
    ?? null

  return (
    <main className="container detail-page">
      <div className="detail-backlink">
        <Link href="/personas">← Volver al dashboard de personas</Link>
      </div>

      <section className="detail-hero card person-hero">
        {person.photo_url && <img className="person-photo" src={person.photo_url} alt={person.display_name} />}
        <div>
          <p className="eyebrow">{personTypeLabel(effectivePersonType)}</p>
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
          <strong>{metricYears(presbyterate?.ordination_date ?? null, person.death_date)}</strong>
          <span>Años desde el presbiterado</span>
        </div>
        <div className="metric-card">
          <strong>{metricYears(episcopate?.ordination_date ?? null, person.death_date)}</strong>
          <span>Años desde el episcopado</span>
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
            <div><dt>Condición eclesial</dt><dd>{ecclesialState?.is_cleric ? 'Clérigo' : 'Laico/a'}</dd></div>
            <div><dt>Grado actual del Orden</dt><dd>{ordinationDegreeLabel(ecclesialState?.highest_ordination_degree ?? null)}</dd></div>
            <div><dt>Fecha de nacimiento</dt><dd>{formatDate(person.birth_date)}</dd></div>
            <div><dt>Lugar de nacimiento</dt><dd>{person.birth_place ?? 'No indicado'}</dd></div>
            <div><dt>Fallecimiento</dt><dd>{person.death_date ? formatDate(person.death_date) : 'No registrado'}</dd></div>
          </dl>
        </article>

        <article className="card detail-section">
          <h2>Situación canónica actual</h2>
          {!ecclesialState?.is_cleric ? (
            <p className="meta">No tiene una ordenación activa registrada. Su condición laical se deriva de esa ausencia y no de un tipo de persona independiente.</p>
          ) : (
            <dl className="detail-list">
              <div><dt>Estado canónico</dt><dd>{canonicalStatusLabel(ecclesialState.canonical_status)}</dd></div>
              <div><dt>Tipo de incardinación</dt><dd>{incardinationKindLabel(ecclesialState.incardination_kind)}</dd></div>
              <div>
                <dt>Incardinación o pertenencia</dt>
                <dd>
                  <EntityLink
                    name={currentIncardination?.related_entity_name
                      ?? ecclesialState.incardination_entity_name
                      ?? ecclesialState.incardination_institute_name}
                    slug={currentIncardination?.related_entity_slug ?? null}
                  />
                </dd>
              </div>
            </dl>
          )}
        </article>
      </section>

      <section className="card detail-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Historia sacramental</p>
            <h2>Grados del Orden</h2>
          </div>
          <span className="meta">La persona conserva una única identidad durante todo el proceso.</span>
        </div>
        {ordinations.length === 0 ? (
          <p className="meta">No hay ordenaciones públicas registradas.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table dashboard-list-table">
              <thead>
                <tr>
                  <th>Grado</th>
                  <th>Fecha y lugar</th>
                  <th>Ordenante principal</th>
                  <th>Verificación</th>
                  <th>Fuente</th>
                </tr>
              </thead>
              <tbody>
                {ordinations.map((ordination) => (
                  <tr key={ordination.degree}>
                    <td><strong>{ordinationDegreeLabel(ordination.degree)}</strong></td>
                    <td>{formatDate(ordination.ordination_date)}<small>{ordination.ordination_place ?? 'Lugar no indicado'}</small></td>
                    <td><PersonLink name={ordination.principal_ordainer_name} slug={ordination.principal_ordainer_slug} /></td>
                    <td>{ordination.verification_status ?? 'No indicada'}</td>
                    <td>
                      {ordination.source_url ? (
                        <a href={ordination.source_url} target="_blank" rel="noreferrer">{ordination.source_name ?? 'Abrir fuente'}</a>
                      ) : (
                        ordination.source_name ?? 'No indicada'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(episcopalRoles.length > 0 || dignities.length > 0) && (
        <section className="detail-grid">
          <article className="card detail-section">
            <h2>Función episcopal actual</h2>
            {episcopalRoles.length === 0 ? (
              <p className="meta">No hay una función episcopal pública vigente.</p>
            ) : (
              <div className="timeline-list">
                {episcopalRoles.map((role) => (
                  <div className="timeline-item" key={`${role.role_type}-${role.jurisdiction_entity_id ?? role.title_see_name ?? 'sin-sede'}`}>
                    <strong>{episcopalRoleLabel(role.role_type)}</strong>
                    <span>{role.title_see_name ?? role.jurisdiction_name ?? 'Jurisdicción no indicada'}</span>
                    <small>
                      Desde {formatDate(role.start_date)}
                      {role.has_right_of_succession ? ' · Con derecho de sucesión' : ''}
                    </small>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="card detail-section">
            <h2>Títulos y dignidades</h2>
            {dignities.length === 0 ? (
              <p className="meta">No hay dignidades públicas vigentes.</p>
            ) : (
              <div className="timeline-list">
                {dignities.map((dignity) => (
                  <div className="timeline-item" key={dignity.dignity_type}>
                    <strong>{dignityLabel(dignity.dignity_type)}</strong>
                    {dignity.title_text && <span>{dignity.title_text}</span>}
                    <small>Desde {formatDate(dignity.start_date)}</small>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      )}

      {episcopate && (
        <section className="card detail-section">
          <h2>Sucesión apostólica</h2>
          <dl className="detail-list">
            <div><dt>Fecha de ordenación episcopal</dt><dd>{formatDate(episcopate.ordination_date)}</dd></div>
            <div><dt>Lugar</dt><dd>{episcopate.ordination_place ?? episcopalOrdination?.ordination_place ?? 'No indicado'}</dd></div>
            <div><dt>Consagrante principal</dt><dd><PersonLink name={principalConsecratorName} slug={principalConsecratorSlug} /></dd></div>
            <div><dt>Co-consagrante 1</dt><dd><PersonLink name={coConsecrator1Name} slug={coConsecrator1Slug} /></dd></div>
            <div><dt>Co-consagrante 2</dt><dd><PersonLink name={coConsecrator2Name} slug={coConsecrator2Slug} /></dd></div>
            <div><dt>Verificación</dt><dd>{episcopate.verification_status ?? episcopalOrdination?.verification_status ?? 'No indicada'}</dd></div>
          </dl>
        </section>
      )}

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
          <h2>Historia canónica</h2>
          {clericalHistory.length === 0 ? (
            <p className="meta">No hay cambios canónicos públicos registrados.</p>
          ) : (
            <div className="timeline-list">
              {clericalHistory.map((item, index) => (
                <div className="timeline-item" key={`${item.dimension_type}-${item.dimension_key}-${item.start_date ?? index}`}>
                  <strong>{historyTitle(item)}</strong>
                  {item.related_entity_name && <EntityLink name={item.related_entity_name} slug={item.related_entity_slug} />}
                  {item.detail_text && item.detail_text !== item.display_title && <span>{item.detail_text}</span>}
                  <small>
                    {formatDate(item.start_date)} — {item.end_date ? formatDate(item.end_date) : item.is_current ? 'vigente' : 'sin fecha final'}
                    {item.has_right_of_succession ? ' · Con derecho de sucesión' : ''}
                  </small>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="card detail-section">
        <h2>Movimientos pastorales e institucionales</h2>
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
      </section>
    </main>
  )
}
