'use client'

import { EntityDetailPageView } from '../../../features/entidades/EntityDetailPage'

export default function EntityDetailPage() {
  return <EntityDetailPageView />
}

function getEntityCopy(entity: Entity) {
  const kind = getEntityKind(entity)
  const copies = {
    diocesan: ['Obispo(s)', 'No hay obispos o responsables actuales registrados.', 'Ordinarios del pasado y del presente', 'Tipo de jurisdicción', 'Catedral / sede', 'Erección', 'Territorio', 'Estadística histórica', true],
    parish: ['Responsables parroquiales', 'No hay párroco, vicario o responsables actuales registrados.', 'Responsables parroquiales del pasado y del presente', 'Tipo de entidad', 'Templo / sede', 'Erección / creación', 'Jurisdicción / territorio', 'Datos pastorales históricos', false],
    chapel: ['Responsables de la capilla', 'No hay responsables actuales registrados.', 'Responsables del pasado y del presente', 'Tipo de entidad', 'Templo / sede', 'Creación', 'Sector / comunidad', 'Datos pastorales históricos', false],
    vicariate: ['Responsables vicariales', 'No hay responsables vicariales actuales registrados.', 'Responsables vicariales del pasado y del presente', 'Tipo de estructura', 'Sede', 'Creación', 'Territorio / zona de servicio', 'Datos pastorales históricos', false],
    zone: ['Responsables zonales', 'No hay responsables zonales actuales registrados.', 'Responsables zonales del pasado y del presente', 'Tipo de estructura', 'Sede', 'Creación', 'Territorio / parroquias vinculadas', 'Datos pastorales históricos', false],
    administrative: ['Responsables administrativos', 'No hay responsables administrativos actuales registrados.', 'Responsables administrativos del pasado y del presente', 'Tipo de oficina', 'Sede', 'Creación', 'Ámbito de servicio', 'Datos históricos', false],
    generic: ['Responsables actuales', 'No hay responsables actuales registrados.', 'Responsables del pasado y del presente', 'Tipo de entidad', 'Sede', 'Creación', 'Ámbito / territorio', 'Datos históricos', false],
  }[kind]

  return {
    responsibleTitle: copies[0] as string,
    emptyResponsible: copies[1] as string,
    historyTitle: copies[2] as string,
    typeLabel: copies[3] as string,
    seatLabel: copies[4] as string,
    createdLabel: copies[5] as string,
    territoryLabel: copies[6] as string,
    statsTitle: copies[7] as string,
    showStatistics: copies[8] as boolean,
  }
}

function sortCurrentAppointments(a: AppointmentHistory, b: AppointmentHistory) {
  const rankA = hierarchyRank[a.office_key ?? ''] ?? 99
  const rankB = hierarchyRank[b.office_key ?? ''] ?? 99
  if (rankA !== rankB) return rankA - rankB
  return (a.start_date ?? '').localeCompare(b.start_date ?? '')
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

function PositionTable({ positions, showRoute }: { positions: Position[]; showRoute: boolean }) {
  if (positions.length === 0) return <p className="meta">No hay cargos configurados registrados.</p>

  return (
    <div className="table-wrap">
      <table className="data-table ordinary-table">
        <thead>
          <tr>
            <th>Cargo</th>
            <th>Persona</th>
            <th>Organigrama</th>
            {showRoute && <th>Entidad / ruta</th>}
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
              {showRoute && <td>{entityLink(position.direct_entity_name, position.direct_entity_slug)}<br /><span className="meta">{position.hierarchy_path ?? 'Sin ruta'}</span></td>}
              <td>{formatDate(position.term_start_date ?? position.start_date)} – {position.actual_end_date ? formatDate(position.actual_end_date) : position.term_end_date ? formatDate(position.term_end_date) : 'actual'}</td>
              <td>{assignmentStatusLabel(position.assignment_status)}</td>
              <td>{personLink(position.predecessor_person_name, position.predecessor_person_slug)}</td>
              <td>{personLink(position.successor_person_name, position.successor_person_slug)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
        if (!response.ok) throw new Error(result.error ?? 'No se pudo cargar la ficha')
        setData(result as EntityResponse)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }
    loadEntity()
  }, [slug])

  if (loading) return <main className="container"><div className="empty-state">Cargando ficha...</div></main>
  if (error || !data) return <main className="container"><div className="error-box">{error ?? 'Ficha no encontrada'}</div></main>

  const { entity, relationships, related_entities: relatedEntities, appointments, appointment_history: appointmentHistory, evolution_events: evolutionEvents, statistics_snapshots: statisticsSnapshots, positions } = data
  const copy = getEntityCopy(entity)
  const isDiocesan = getEntityKind(entity) === 'diocesan'
  const currentResponsibles = appointmentHistory.filter((appointment) => appointment.is_current && (!isDiocesan || ordinaryOfficeKeys.has(appointment.office_key ?? ''))).sort(sortCurrentAppointments)
  const historicalResponsibles = appointmentHistory.filter((appointment) => !isDiocesan || ordinaryOfficeKeys.has(appointment.office_key ?? '')).sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))
  const fallbackCurrent = currentResponsibles.length > 0 ? [] : appointments
  const currentRelationships = relationships.filter((item) => item.is_current)
  const directPositions = positions.filter((position) => position.direct_entity_slug === entity.slug)
  const dependentPositions = positions.filter((position) => position.direct_entity_slug && position.direct_entity_slug !== entity.slug)
  const showStatistics = copy.showStatistics || statisticsSnapshots.length > 0
  const snapshotRows = statisticsSnapshots.length > 0 ? statisticsSnapshots : [{ id: 'current', statistics_year: entity.statistics_year ?? 0, catholics_total: entity.catholics_total, population_total: entity.population_total, catholics_percent: entity.catholics_percent, total_priests_count: null, permanent_deacons_count: null, male_religious_count: null, female_religious_count: null, parishes_count: entity.parishes_count, source_code: null }]

  function getRelatedName(id: string) {
    return relatedEntities.find((item) => item.id === id)?.name ?? 'Entidad relacionada'
  }

  function getRelatedSlug(id: string) {
    return relatedEntities.find((item) => item.id === id)?.slug
  }

  return (
    <main className="container detail-page hierarchy-page">
      <div className="detail-backlink"><Link href={isDiocesan ? '/diocesis' : '/'}>← Volver al dashboard</Link></div>

      <section className="hierarchy-title card">
        <p className="eyebrow">{entity.entity_type_name ?? 'Entidad eclesiástica'}</p>
        <h1>{entity.official_name ?? entity.name}</h1>
        {entity.latin_name && <p className="latin-title">{entity.latin_name}</p>}
        {entity.description && <p className="meta hierarchy-description">{entity.description}</p>}
      </section>

      <section className="hierarchy-grid">
        <article className="card compact-section">
          <h2>{copy.responsibleTitle}</h2>
          {currentResponsibles.length === 0 && fallbackCurrent.length === 0 ? <p className="meta">{copy.emptyResponsible}</p> : (
            <ul className="simple-list bishop-list">
              {currentResponsibles.map((appointment) => (
                <li key={appointment.id}>
                  <div className="bishop-line"><span>{appointment.office_name ?? 'Cargo'}</span>{appointment.person_slug ? <Link href={`/personas/${appointment.person_slug}`}>{appointment.person_name}</Link> : <strong>{appointment.person_name ?? 'No indicado'}</strong>}</div>
                  {appointmentMetrics(appointment, isDiocesan)}
                </li>
              ))}
              {fallbackCurrent.map((appointment) => (
                <li key={`${appointment.person_name}-${appointment.office_name}`}><div className="bishop-line"><span>{appointment.office_name ?? 'Cargo'}</span>{appointment.person_slug ? <Link href={`/personas/${appointment.person_slug}`}>{appointment.person_name}</Link> : <strong>{appointment.person_name ?? 'No indicado'}</strong>}</div></li>
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
        {historicalResponsibles.length === 0 ? <p className="meta">No hay historial registrado.</p> : (
          <div className="table-wrap"><table className="data-table ordinary-table"><thead><tr><th>Nombre</th><th>Cargo</th><th>Periodo</th><th>Tiempo</th></tr></thead><tbody>{historicalResponsibles.map((appointment) => <tr key={appointment.id}><td>{personLink(appointment.person_name, appointment.person_slug)}</td><td>{appointment.office_name ?? 'No indicado'}</td><td>{formatRange(appointment.start_date, appointment.end_date)}</td><td>{formatYears(appointment.start_date, 'En cargo', appointment.end_date).replace('En cargo: ', '')}</td></tr>)}</tbody></table></div>
        )}
      </section>

      <section className="card compact-section">
        <h2>Cargos directos de esta entidad</h2>
        <PositionTable positions={directPositions} showRoute={false} />
      </section>

      {dependentPositions.length > 0 && (
        <section className="card compact-section">
          <h2>Cargos de entidades dependientes</h2>
          <p className="meta">Asignaciones realizadas directamente a parroquias, zonas, vicarías u otras entidades que dependen de esta ficha.</p>
          <PositionTable positions={dependentPositions} showRoute />
        </section>
      )}

      <section className="card compact-section">
        <h2>Evolución histórica</h2>
        {evolutionEvents.length === 0 ? <p className="meta">Todavía no hay eventos de evolución histórica registrados.</p> : (
          <div className="table-wrap"><table className="data-table evolution-table"><thead><tr><th>Fecha</th><th>Evento</th><th>De</th><th>A / Relación</th><th>Territorio</th></tr></thead><tbody>{evolutionEvents.map((event) => { const fromName = event.from_entity_display_name ?? event.from_entity_name; const toName = event.to_entity_display_name ?? event.to_entity_name; const relatedName = event.related_entity_display_name ?? event.related_entity_name; return <tr key={event.id}><td>{formatDate(event.event_date)}</td><td><strong>{eventTypeLabel(event.event_type)}</strong><br /><span className="meta">{event.title}</span></td><td>{entityLink(fromName, event.from_entity_slug)}</td><td>{entityLink(toName ?? relatedName, event.to_entity_slug ?? event.related_entity_slug)}</td><td>{event.territory_summary ?? '—'}</td></tr> })}</tbody></table></div>
        )}
      </section>

      {showStatistics && (
        <section className="card compact-section"><h2>{copy.statsTitle}</h2><div className="table-wrap"><table className="data-table stats-table-wide"><thead><tr><th>Año</th><th>Católicos</th><th>Población</th><th>%</th><th>Sacerdotes</th><th>Diáconos</th><th>Religiosos/as</th><th>Parroquias</th><th>Fuente</th></tr></thead><tbody>{snapshotRows.map((snapshot) => <tr key={snapshot.id}><td>{snapshot.statistics_year || '—'}</td><td>{formatNumber(snapshot.catholics_total)}</td><td>{formatNumber(snapshot.population_total)}</td><td>{snapshot.catholics_percent ?? '—'}%</td><td>{formatNumber(snapshot.total_priests_count)}</td><td>{formatNumber(snapshot.permanent_deacons_count)}</td><td>{formatNumber((snapshot.male_religious_count ?? 0) + (snapshot.female_religious_count ?? 0))}</td><td>{formatNumber(snapshot.parishes_count)}</td><td>{snapshot.source_code ?? '—'}</td></tr>)}</tbody></table></div></section>
      )}

      {evolutionEvents.length === 0 && currentRelationships.length > 0 && (
        <section className="card compact-section"><h2>Relaciones actuales</h2><div className="table-wrap"><table className="data-table"><thead><tr><th>Fecha</th><th>Relación</th><th>Entidad relacionada</th></tr></thead><tbody>{currentRelationships.map((relationship) => { const otherId = relationship.parent_entity_id === entity.id ? relationship.child_entity_id : relationship.parent_entity_id; const relatedSlug = getRelatedSlug(otherId); const relatedName = getRelatedName(otherId); return <tr key={relationship.id}><td>{formatDate(relationship.start_date)}</td><td>{relationship.relationship_type ?? 'Relación'}</td><td>{relatedSlug ? <Link href={`/entidades/${relatedSlug}`}>{relatedName}</Link> : relatedName}</td></tr> })}</tbody></table></div></section>
      )}
    </main>
  )
}
