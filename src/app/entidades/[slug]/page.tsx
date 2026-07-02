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
  birth_date: string | null
  age_text: string | null
  death_date: string | null
  diaconal_ordination_date: string | null
  priestly_ordination_date: string | null
  episcopal_ordination_date: string | null
  canonical_status: string | null
  end_date: string | null
  is_current: boolean
}

type EvolutionEvent = {
  id: string
  event_type: string | null
  event_date: string | null
  title: string | null
  description: string | null
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
  canonical_effect: string | null
  source_name: string | null
  verification_status: string | null
}

type StatisticsSnapshot = {
  id: string
  statistics_year: number
  catholics_total: number | null
  population_total: number | null
  catholics_percent: number | null
  diocesan_priests_count: number | null
  religious_priests_count: number | null
  total_priests_count: number | null
  catholics_per_priest: number | null
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
  const beforeAnniversary =
    end.getMonth() < start.getMonth() ||
    (end.getMonth() === start.getMonth() && end.getDate() < start.getDate())

  if (beforeAnniversary) years -= 1
  return years >= 0 ? years : null
}

function formatYears(value: string | null, label: string, endValue?: string | null) {
  const years = yearsSince(value, endValue)
  if (years === null) return `${label}: —`
  return `${label}: ${years} años`
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

function sortCurrentAppointments(a: AppointmentHistory, b: AppointmentHistory) {
  const rankA = hierarchyRank[a.office_key ?? ''] ?? 99
  const rankB = hierarchyRank[b.office_key ?? ''] ?? 99
  if (rankA !== rankB) return rankA - rankB
  return (a.start_date ?? '').localeCompare(b.start_date ?? '')
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
  if (['parish', 'quasi_parish'].includes(key)) return 'parish'
  if (['chapel', 'sanctuary'].includes(key)) return 'chapel'
  if (key === 'vicariate') return 'vicariate'
  if (['pastoral_zone', 'deanery', 'pastoral_region'].includes(key)) return 'zone'
  if (key === 'curia_office') return 'administrative'
  if (name.includes('parroquia')) return 'parish'
  if (name.includes('capilla') || name.includes('santuario')) return 'chapel'
  if (name.includes('vicar')) return 'vicariate'
  if (name.includes('zona') || name.includes('decan')) return 'zone'

  return 'generic'
}

function getEntityCopy(entity: Entity) {
  const kind = getEntityKind(entity)

  const copies = {
    diocesan: {
      responsibleTitle: 'Obispo(s)',
      emptyResponsible: 'No hay obispos o responsables actuales registrados.',
      historyTitle: 'Ordinarios del pasado y del presente',
      emptyHistory: 'Todavía no hay ordinarios históricos registrados.',
      typeLabel: 'Tipo de jurisdicción',
      seatLabel: 'Catedral / sede',
      createdLabel: 'Erección',
      territoryLabel: 'Territorio',
      statsTitle: 'Estadística histórica',
      showStatistics: true,
    },
    parish: {
      responsibleTitle: 'Responsables parroquiales',
      emptyResponsible: 'No hay párroco, vicario o responsables actuales registrados.',
      historyTitle: 'Responsables parroquiales del pasado y del presente',
      emptyHistory: 'Todavía no hay historial parroquial registrado.',
      typeLabel: 'Tipo de entidad',
      seatLabel: 'Templo / sede',
      createdLabel: 'Erección / creación',
      territoryLabel: 'Jurisdicción / territorio',
      statsTitle: 'Datos pastorales históricos',
      showStatistics: false,
    },
    chapel: {
      responsibleTitle: 'Responsables de la capilla',
      emptyResponsible: 'No hay responsables actuales registrados.',
      historyTitle: 'Responsables del pasado y del presente',
      emptyHistory: 'Todavía no hay historial registrado.',
      typeLabel: 'Tipo de entidad',
      seatLabel: 'Templo / sede',
      createdLabel: 'Creación',
      territoryLabel: 'Sector / comunidad',
      statsTitle: 'Datos pastorales históricos',
      showStatistics: false,
    },
    vicariate: {
      responsibleTitle: 'Responsables vicariales',
      emptyResponsible: 'No hay responsables vicariales actuales registrados.',
      historyTitle: 'Responsables vicariales del pasado y del presente',
      emptyHistory: 'Todavía no hay historial vicarial registrado.',
      typeLabel: 'Tipo de estructura',
      seatLabel: 'Sede',
      createdLabel: 'Creación',
      territoryLabel: 'Territorio / zona de servicio',
      statsTitle: 'Datos pastorales históricos',
      showStatistics: false,
    },
    zone: {
      responsibleTitle: 'Responsables zonales',
      emptyResponsible: 'No hay responsables zonales actuales registrados.',
      historyTitle: 'Responsables zonales del pasado y del presente',
      emptyHistory: 'Todavía no hay historial zonal registrado.',
      typeLabel: 'Tipo de estructura',
      seatLabel: 'Sede',
      createdLabel: 'Creación',
      territoryLabel: 'Territorio / parroquias vinculadas',
      statsTitle: 'Datos pastorales históricos',
      showStatistics: false,
    },
    administrative: {
      responsibleTitle: 'Responsables administrativos',
      emptyResponsible: 'No hay responsables administrativos actuales registrados.',
      historyTitle: 'Responsables administrativos del pasado y del presente',
      emptyHistory: 'Todavía no hay historial administrativo registrado.',
      typeLabel: 'Tipo de oficina',
      seatLabel: 'Sede',
      createdLabel: 'Creación',
      territoryLabel: 'Ámbito de servicio',
      statsTitle: 'Datos históricos',
      showStatistics: false,
    },
    generic: {
      responsibleTitle: 'Responsables actuales',
      emptyResponsible: 'No hay responsables actuales registrados.',
      historyTitle: 'Responsables del pasado y del presente',
      emptyHistory: 'Todavía no hay historial registrado.',
      typeLabel: 'Tipo de entidad',
      seatLabel: 'Sede',
      createdLabel: 'Creación',
      territoryLabel: 'Ámbito / territorio',
      statsTitle: 'Datos históricos',
      showStatistics: false,
    },
  }

  return copies[kind]
}

function appointmentMetrics(appointment: AppointmentHistory, isDiocesan: boolean) {
  return (
    <div className="tenure-grid">
      <span>{formatCurrentAge(appointment.birth_date, appointment.age_text, appointment.death_date)}</span>
      <span>{formatYears(appointment.priestly_ordination_date, 'Como sacerdote')}</span>
      {isDiocesan && <span>{formatYears(appointment.episcopal_ordination_date, 'Como obispo')}</span>}
      <span>{formatYears(appointment.start_date, 'En este cargo')}</span>
    </div>
  )
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

  const {
    entity,
    relationships,
    related_entities: relatedEntities,
    appointments,
    appointment_history: appointmentHistory,
    evolution_events: evolutionEvents,
    statistics_snapshots: statisticsSnapshots,
    positions,
  } = data

  function getRelatedName(id: string) {
    return relatedEntities.find((item) => item.id === id)?.name ?? 'Entidad relacionada'
  }

  function getRelatedSlug(id: string) {
    return relatedEntities.find((item) => item.id === id)?.slug
  }

  const copy = getEntityCopy(entity)
  const isDiocesan = getEntityKind(entity) === 'diocesan'

  const currentResponsibles = appointmentHistory
    .filter((appointment) => appointment.is_current && (!isDiocesan || ordinaryOfficeKeys.has(appointment.office_key ?? '')))
    .sort(sortCurrentAppointments)

  const historicalResponsibles = appointmentHistory
    .filter((appointment) => !isDiocesan || ordinaryOfficeKeys.has(appointment.office_key ?? ''))
    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))

  const fallbackCurrent = currentResponsibles.length > 0 ? [] : appointments
  const currentRelationships = relationships.filter((item) => item.is_current)
  const showStatistics = copy.showStatistics || statisticsSnapshots.length > 0
  const snapshotRows = statisticsSnapshots.length > 0 ? statisticsSnapshots : [{
    id: 'current',
    statistics_year: entity.statistics_year ?? 0,
    catholics_total: entity.catholics_total,
    population_total: entity.population_total,
    catholics_percent: entity.catholics_percent,
    diocesan_priests_count: null,
    religious_priests_count: null,
    total_priests_count: null,
    catholics_per_priest: null,
    permanent_deacons_count: null,
    male_religious_count: null,
    female_religious_count: null,
    parishes_count: entity.parishes_count,
    source_code: null,
  }]

  return (
    <main className="container detail-page hierarchy-page">
      <div className="detail-backlink">
        <Link href={isDiocesan ? '/diocesis' : '/'}>← Volver al dashboard</Link>
      </div>

      <section className="hierarchy-title card">
        <p className="eyebrow">{entity.entity_type_name ?? 'Entidad eclesiástica'}</p>
        <h1>{entity.official_name ?? entity.name}</h1>
        {entity.latin_name && <p className="latin-title">{entity.latin_name}</p>}
        {entity.description && <p className="meta hierarchy-description">{entity.description}</p>}
      </section>

      <section className="hierarchy-grid">
        <article className="card compact-section">
          <h2>{copy.responsibleTitle}</h2>
          {currentResponsibles.length === 0 && fallbackCurrent.length === 0 ? (
            <p className="meta">{copy.emptyResponsible}</p>
          ) : (
            <ul className="simple-list bishop-list">
              {currentResponsibles.map((appointment) => (
                <li key={appointment.id}>
                  <div className="bishop-line">
                    <span>{appointment.office_name ?? 'Cargo'}</span>
                    {appointment.person_slug ? (
                      <Link href={`/personas/${appointment.person_slug}`}>{appointment.person_name}</Link>
                    ) : (
                      <strong>{appointment.person_name ?? 'No indicado'}</strong>
                    )}
                  </div>
                  {appointmentMetrics(appointment, isDiocesan)}
                </li>
              ))}
              {fallbackCurrent.map((appointment) => (
                <li key={`${appointment.person_name}-${appointment.office_name}`}>
                  <div className="bishop-line">
                    <span>{appointment.office_name ?? 'Cargo'}</span>
                    {appointment.person_slug ? (
                      <Link href={`/personas/${appointment.person_slug}`}>{appointment.person_name}</Link>
                    ) : (
                      <strong>{appointment.person_name ?? 'No indicado'}</strong>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="card compact-section">
          <h2>Información general</h2>
          <dl className="info-table">
            <div><dt>{copy.typeLabel}</dt><dd>{entity.entity_type_name ?? 'No indicado'}</dd></div>
            <div><dt>Nombre latino</dt><dd>{entity.latin_name ?? 'No indicado'}</dd></div>
            <div><dt>{copy.seatLabel}</dt><dd>{entity.cathedral_name ?? 'No indicada'}</dd></div>
            {isDiocesan && <div><dt>Rito</dt><dd>Latino (o Romano)</dd></div>}
            <div><dt>País</dt><dd>{entity.country ?? 'República Dominicana'}</dd></div>
            {isDiocesan && <div><dt>Superficie</dt><dd>{formatArea(entity.area_km2)}</dd></div>}
            <div><dt>Sitio web oficial</dt><dd>{entity.website ?? 'No indicado'}</dd></div>
            <div><dt>Dirección</dt><dd>{entity.address ?? 'No indicada'}</dd></div>
            <div><dt>Teléfono</dt><dd>{entity.phone ?? 'No indicado'}</dd></div>
          </dl>
        </article>
      </section>

      <section className="card compact-section">
        <h2>Detalles históricos</h2>
        <dl className="info-table two-column-info">
          <div><dt>{copy.createdLabel}</dt><dd>{formatDate(entity.erected_at)}</dd></div>
          <div><dt>{copy.territoryLabel}</dt><dd>{entity.territory_summary ?? 'No indicado'}</dd></div>
          <div><dt>Provincia civil</dt><dd>{entity.province ?? 'No indicada'}</dd></div>
          <div><dt>Municipio</dt><dd>{entity.municipality ?? 'No indicado'}</dd></div>
          <div><dt>Fuente</dt><dd>{entity.source_name ?? 'No indicada'}</dd></div>
          <div><dt>Revisión</dt><dd>{formatDate(entity.source_checked_at)}</dd></div>
        </dl>
      </section>

      <section className="card compact-section">
        <h2>{copy.historyTitle}</h2>
        {historicalResponsibles.length === 0 ? (
          <p className="meta">{copy.emptyHistory}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table ordinary-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Cargo</th>
                  <th>Periodo</th>
                  <th>Tiempo</th>
                </tr>
              </thead>
              <tbody>
                {historicalResponsibles.map((appointment) => (
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
                    <td>{formatYears(appointment.start_date, 'En cargo', appointment.end_date).replace('En cargo: ', '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {positions.length > 0 && (
        <section className="card compact-section">
          <h2>Organigrama y cargos</h2>
          <div className="table-wrap">
            <table className="data-table ordinary-table">
              <thead>
                <tr>
                  <th>Cargo</th>
                  <th>Persona</th>
                  <th>Organigrama</th>
                  <th>Período</th>
                  <th>Estado</th>
                  <th>Predecesor</th>
                  <th>Sucesor</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => (
                  <tr key={position.id}>
                    <td><strong>{position.position_title ?? 'Cargo'}</strong></td>
                    <td>{personLink(position.person_name, position.person_slug)}</td>
                    <td>{position.organization_chart_name ?? 'No indicado'}</td>
                    <td>{formatDate(position.term_start_date ?? position.start_date)} – {position.actual_end_date ? formatDate(position.actual_end_date) : position.term_end_date ? formatDate(position.term_end_date) : 'actual'}</td>
                    <td>{assignmentStatusLabel(position.assignment_status)}</td>
                    <td>{personLink(position.predecessor_person_name, position.predecessor_person_slug)}</td>
                    <td>{personLink(position.successor_person_name, position.successor_person_slug)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card compact-section">
        <h2>Evolución histórica</h2>
        {evolutionEvents.length === 0 ? (
          <p className="meta">Todavía no hay eventos de evolución histórica registrados.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table evolution-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Evento</th>
                  <th>De</th>
                  <th>A / Relación</th>
                  <th>Territorio</th>
                </tr>
              </thead>
              <tbody>
                {evolutionEvents.map((event) => {
                  const fromName = event.from_entity_display_name ?? event.from_entity_name
                  const toName = event.to_entity_display_name ?? event.to_entity_name
                  const relatedName = event.related_entity_display_name ?? event.related_entity_name
                  return (
                    <tr key={event.id}>
                      <td>{formatDate(event.event_date)}</td>
                      <td><strong>{eventTypeLabel(event.event_type)}</strong><br /><span className="meta">{event.title}</span></td>
                      <td>{entityLink(fromName, event.from_entity_slug)}</td>
                      <td>{entityLink(toName ?? relatedName, event.to_entity_slug ?? event.related_entity_slug)}</td>
                      <td>{event.territory_summary ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showStatistics && (
        <section className="card compact-section">
          <h2>{copy.statsTitle}</h2>
          <div className="table-wrap">
            <table className="data-table stats-table-wide">
              <thead>
                <tr>
                  <th>Año</th>
                  <th>Católicos</th>
                  <th>Población</th>
                  <th>%</th>
                  <th>Sacerdotes</th>
                  <th>Diáconos</th>
                  <th>Religiosos/as</th>
                  <th>Parroquias</th>
                  <th>Fuente</th>
                </tr>
              </thead>
              <tbody>
                {snapshotRows.map((snapshot) => (
                  <tr key={snapshot.id}>
                    <td>{snapshot.statistics_year || '—'}</td>
                    <td>{formatNumber(snapshot.catholics_total)}</td>
                    <td>{formatNumber(snapshot.population_total)}</td>
                    <td>{snapshot.catholics_percent ?? '—'}%</td>
                    <td>{formatNumber(snapshot.total_priests_count)}</td>
                    <td>{formatNumber(snapshot.permanent_deacons_count)}</td>
                    <td>{formatNumber((snapshot.male_religious_count ?? 0) + (snapshot.female_religious_count ?? 0))}</td>
                    <td>{formatNumber(snapshot.parishes_count)}</td>
                    <td>{snapshot.source_code ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {evolutionEvents.length === 0 && currentRelationships.length > 0 && (
        <section className="card compact-section">
          <h2>Relaciones actuales</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Relación</th>
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
                      <td>{relatedSlug ? <Link href={`/entidades/${relatedSlug}`}>{relatedName}</Link> : relatedName}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  )
}
