import Link from 'next/link'
import type {
  PublicClericalHistory,
  PublicPersonDetail,
} from '@/lib/public/person-detail'

function personTypeLabel(value: string | null) {
  const labels: Record<string, string> = {
    bishop: 'Obispo',
    priest: 'Sacerdote',
    deacon: 'Diácono',
    religious: 'Religioso/a',
    layperson: 'Laico/a',
  }
  return value ? labels[value] ?? value : 'Persona'
}

function ordinationDegreeLabel(value: string | null) {
  const labels: Record<string, string> = {
    diaconate: 'Diaconado',
    presbyterate: 'Presbiterado',
    episcopate: 'Episcopado',
  }
  return value ? labels[value] ?? value : 'Sin ordenación registrada'
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
  return value ? labels[value] ?? value : 'No publicado'
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
  return value ? labels[value] ?? value : 'No indicada'
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
  return value ? labels[value] ?? value : 'No indicado'
}

function historyTitle(item: PublicClericalHistory) {
  if (item.dimension_type === 'canonical_status') return canonicalStatusLabel(item.dimension_key)
  if (item.dimension_type === 'episcopal_role') return episcopalRoleLabel(item.dimension_key)
  if (item.dimension_type === 'dignity') return dignityLabel(item.dimension_key)
  return `Incardinación: ${incardinationKindLabel(item.dimension_key)}`
}

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(date)
}

function yearsSince(value: string | null, endValue?: string | null) {
  if (!value) return null
  const start = new Date(`${value}T00:00:00`)
  const end = endValue ? new Date(`${endValue}T00:00:00`) : new Date()
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  let years = end.getFullYear() - start.getFullYear()
  const beforeAnniversary = end.getMonth() < start.getMonth()
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
  return years === null ? ageText ?? '—' : `${years}`
}

function PersonLink({ name, slug }: { name: string | null; slug: string | null }) {
  if (!name) return <span>—</span>
  return slug ? <Link href={`/personas/${slug}`}>{name}</Link> : <span>{name}</span>
}

function EntityLink({ name, slug }: { name: string | null; slug: string | null }) {
  if (!name) return <span>Entidad no indicada</span>
  return slug ? <Link href={`/entidades/${slug}`}>{name}</Link> : <span>{name}</span>
}

function ScopeLink({
  entityName,
  entitySlug,
  unitName,
  unitSlug,
}: {
  entityName: string | null
  entitySlug: string | null
  unitName: string | null
  unitSlug: string | null
}) {
  if (entityName) return <EntityLink name={entityName} slug={entitySlug} />
  if (!unitName) return <span>Ámbito no indicado</span>
  return unitSlug ? <Link href={`/pastoral/${unitSlug}`}>{unitName}</Link> : <span>{unitName}</span>
}

export default function PersonDetailServerView({ data }: { data: PublicPersonDetail }) {
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
      <div className="detail-backlink"><Link href="/personas">← Volver al directorio de personas</Link></div>

      <section className="detail-hero card person-hero">
        {person.photo_url && <img className="person-photo" src={person.photo_url} alt={person.display_name} />}
        <div>
          <p className="eyebrow">{personTypeLabel(effectivePersonType)}</p>
          <h1>{person.display_name}</h1>
          {person.biography_public && <p className="lead">{person.biography_public}</p>}
        </div>
      </section>

      <section className="dashboard-grid dashboard-summary person-metrics">
        <div className="metric-card"><strong>{metricAge(person.birth_date, person.age_text, person.death_date)}</strong><span>{person.death_date ? 'Edad al fallecer' : 'Edad actual'}</span></div>
        <div className="metric-card"><strong>{metricYears(presbyterate?.ordination_date ?? null, person.death_date)}</strong><span>Años desde el presbiterado</span></div>
        <div className="metric-card"><strong>{metricYears(episcopate?.ordination_date ?? null, person.death_date)}</strong><span>Años desde el episcopado</span></div>
        <div className="metric-card"><strong>{metricYears(primaryAppointment?.start_date ?? null, primaryAppointment?.end_date ?? person.death_date)}</strong><span>En cargo principal</span></div>
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
            <p className="meta">No tiene una ordenación activa registrada. Su condición laical se deriva de esa ausencia.</p>
          ) : (
            <dl className="detail-list">
              <div><dt>Estado canónico</dt><dd>{canonicalStatusLabel(ecclesialState.canonical_status)}</dd></div>
              <div><dt>Tipo de incardinación</dt><dd>{incardinationKindLabel(ecclesialState.incardination_kind)}</dd></div>
              <div><dt>Incardinación o pertenencia</dt><dd><EntityLink name={currentIncardination?.related_entity_name ?? ecclesialState.incardination_entity_name ?? ecclesialState.incardination_institute_name} slug={currentIncardination?.related_entity_slug ?? null} /></dd></div>
            </dl>
          )}
        </article>
      </section>

      <section className="card detail-section">
        <div className="section-heading"><div><p className="eyebrow">Historia sacramental</p><h2>Grados del Orden</h2></div><span className="meta">Identidad única a través de todo el proceso sacramental.</span></div>
        {ordinations.length === 0 ? <p className="meta">No hay ordenaciones públicas registradas.</p> : (
          <div className="table-wrap"><table className="data-table dashboard-list-table"><thead><tr><th>Grado</th><th>Fecha y lugar</th><th>Ordenante principal</th><th>Verificación</th><th>Fuente</th></tr></thead><tbody>
            {ordinations.map((ordination) => <tr key={ordination.degree}>
              <td><strong>{ordinationDegreeLabel(ordination.degree)}</strong></td>
              <td>{formatDate(ordination.ordination_date)}<small>{ordination.ordination_place ?? 'Lugar no indicado'}</small></td>
              <td><PersonLink name={ordination.principal_ordainer_name} slug={ordination.principal_ordainer_slug} /></td>
              <td>{ordination.verification_status ?? 'No indicada'}</td>
              <td>{ordination.source_url ? <a href={ordination.source_url} target="_blank" rel="noreferrer">{ordination.source_name ?? 'Abrir fuente'}</a> : ordination.source_name ?? 'No indicada'}</td>
            </tr>)}
          </tbody></table></div>
        )}
      </section>

      {(episcopalRoles.length > 0 || dignities.length > 0) && <section className="detail-grid">
        <article className="card detail-section"><h2>Función episcopal actual</h2>{episcopalRoles.length === 0 ? <p className="meta">No hay una función episcopal pública vigente.</p> : <div className="timeline-list">{episcopalRoles.map((role) => <div className="timeline-item" key={`${role.role_type}-${role.jurisdiction_entity_id ?? role.title_see_name ?? 'sin-sede'}`}><strong>{episcopalRoleLabel(role.role_type)}</strong><span>{role.title_see_name ?? role.jurisdiction_name ?? 'Jurisdicción no indicada'}</span><small>Desde {formatDate(role.start_date)}{role.has_right_of_succession ? ' · Con derecho de sucesión' : ''}</small></div>)}</div>}</article>
        <article className="card detail-section"><h2>Títulos y dignidades</h2>{dignities.length === 0 ? <p className="meta">No hay dignidades públicas vigentes.</p> : <div className="timeline-list">{dignities.map((dignity) => <div className="timeline-item" key={dignity.dignity_type}><strong>{dignityLabel(dignity.dignity_type)}</strong>{dignity.title_text && <span>{dignity.title_text}</span>}<small>Desde {formatDate(dignity.start_date)}</small></div>)}</div>}</article>
      </section>}

      {episcopate && <section className="card detail-section"><h2>Sucesión apostólica</h2><dl className="detail-list">
        <div><dt>Fecha de ordenación episcopal</dt><dd>{formatDate(episcopate.ordination_date)}</dd></div>
        <div><dt>Lugar</dt><dd>{episcopate.ordination_place ?? episcopalOrdination?.ordination_place ?? 'No indicado'}</dd></div>
        <div><dt>Consagrante principal</dt><dd><PersonLink name={principalConsecratorName} slug={principalConsecratorSlug} /></dd></div>
        <div><dt>Co-consagrante 1</dt><dd><PersonLink name={coConsecrator1Name} slug={coConsecrator1Slug} /></dd></div>
        <div><dt>Co-consagrante 2</dt><dd><PersonLink name={coConsecrator2Name} slug={coConsecrator2Slug} /></dd></div>
        <div><dt>Verificación</dt><dd>{episcopate.verification_status ?? episcopalOrdination?.verification_status ?? 'No indicada'}</dd></div>
      </dl></section>}

      <section className="card detail-section"><h2>Cargos configurados</h2>{positions.length === 0 ? <p className="meta">Todavía no hay cargos configurados para esta persona.</p> : <div className="table-wrap"><table className="data-table dashboard-list-table"><thead><tr><th>Cargo</th><th>Organigrama</th><th>Entidad / unidad</th><th>Período</th><th>Estado</th><th>Predecesor</th><th>Sucesor</th></tr></thead><tbody>
        {positions.map((position) => <tr key={position.id}>
          <td><strong>{position.position_title ?? 'Cargo'}</strong><small>{position.selection_method ?? 'nombramiento'}</small></td>
          <td>{position.organization_chart_name ?? 'No indicado'}</td>
          <td><ScopeLink entityName={position.ecclesiastical_entity_name} entitySlug={position.ecclesiastical_entity_slug} unitName={position.organization_unit_name} unitSlug={position.organization_unit_slug} /></td>
          <td>{formatDate(position.term_start_date ?? position.start_date)} – {position.actual_end_date ? formatDate(position.actual_end_date) : position.term_end_date ? formatDate(position.term_end_date) : 'actual'}</td>
          <td>{assignmentStatusLabel(position.assignment_status)}</td>
          <td><PersonLink name={position.predecessor_person_name} slug={position.predecessor_person_slug} /></td>
          <td><PersonLink name={position.successor_person_name} slug={position.successor_person_slug} /></td>
        </tr>)}
      </tbody></table></div>}</section>

      <section className="detail-grid">
        <article className="card detail-section"><h2>Nombramientos actuales</h2>{appointments.length === 0 ? <p className="meta">No hay nombramientos públicos activos.</p> : <div className="timeline-list">{appointments.map((appointment) => <div className="timeline-item" key={appointment.id}><strong>{appointment.office_name ?? 'Cargo'}</strong><ScopeLink entityName={appointment.entity_name} entitySlug={appointment.entity_slug} unitName={appointment.organization_unit_name} unitSlug={appointment.organization_unit_slug} /><small>Desde {formatDate(appointment.start_date)} · {metricYears(appointment.start_date, person.death_date)} años en el cargo</small>{appointment.notes_public && <span className="meta">{appointment.notes_public}</span>}</div>)}</div>}</article>
        <article className="card detail-section"><h2>Historia canónica</h2>{clericalHistory.length === 0 ? <p className="meta">No hay cambios canónicos públicos registrados.</p> : <div className="timeline-list">{clericalHistory.map((item, index) => <div className="timeline-item" key={`${item.dimension_type}-${item.dimension_key}-${item.start_date ?? index}`}><strong>{historyTitle(item)}</strong>{item.related_entity_name && <EntityLink name={item.related_entity_name} slug={item.related_entity_slug} />}{item.detail_text && item.detail_text !== item.display_title && <span>{item.detail_text}</span>}<small>{formatDate(item.start_date)} — {item.end_date ? formatDate(item.end_date) : item.is_current ? 'vigente' : 'sin fecha final'}{item.has_right_of_succession ? ' · Con derecho de sucesión' : ''}</small></div>)}</div>}</article>
      </section>

      <section className="card detail-section"><h2>Movimientos pastorales e institucionales</h2>{movements.length === 0 ? <p className="meta">Todavía no hay movimientos históricos públicos.</p> : <div className="timeline-list">{movements.map((movement) => <div className="timeline-item" key={movement.id}><strong>{movement.title ?? movement.movement_type ?? 'Movimiento'}</strong><ScopeLink entityName={movement.entity_name} entitySlug={movement.entity_slug} unitName={movement.organization_unit_name} unitSlug={movement.organization_unit_slug} /><small>{formatDate(movement.effective_date)} — {movement.end_date ? formatDate(movement.end_date) : 'actual'}</small>{movement.description && <span className="meta">{movement.description}</span>}</div>)}</div>}</section>
    </main>
  )
}
