import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicBreadcrumbs } from '@/components/public/PublicBreadcrumbs'
import { PersonTerritorialFilters } from '@/features/public/PersonTerritorialFilters'
import { loadDashboardSummary } from '@/lib/public/dashboard'
import {
  loadPeopleDirectory,
  loadPersonTerritorialAssignments,
  normalizePersonFilter,
  type PersonFilter,
  type PersonTerritorialAssignment,
} from '@/lib/public/directories'
import { buildPublicMetadata } from '@/lib/public/metadata'
import '../../public-combobox.css'
import '../../person-territorial-filters.css'

export const metadata: Metadata = buildPublicMetadata({
  title: 'Personas',
  description: 'Directorio público internacional de obispos, sacerdotes, diáconos, personas consagradas y laicos registrados en SINEP RD.',
  path: '/personas',
})

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const firstValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function personTypeLabel(value: string | null, isReligious: boolean) {
  const labels: Record<string, string> = { bishop: 'Obispo', priest: 'Sacerdote', deacon: 'Diácono', religious: 'Religioso/a', layperson: 'Laico/a' }
  const label = value ? labels[value] ?? value : 'Persona'
  return isReligious && label !== 'Religioso/a' ? `${label} · Vida consagrada` : label
}

function filterLabel(value: PersonFilter) {
  const labels: Record<PersonFilter, string> = { all: 'Todas las personas', bishop: 'Obispos', priest: 'Sacerdotes', deacon: 'Diáconos', religious: 'Vida consagrada', layperson: 'Laicos/as', active: 'Activos' }
  return labels[value]
}

function uniqueOptions(
  assignments: PersonTerritorialAssignment[],
  value: (item: PersonTerritorialAssignment) => string | null,
  label: (item: PersonTerritorialAssignment) => string | null,
) {
  const options = new Map<string, string>()
  for (const item of assignments) {
    const optionValue = value(item)
    const optionLabel = label(item)
    if (optionValue && optionLabel) options.set(optionValue, optionLabel)
  }
  return Array.from(options, ([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

function buildFilterHref(
  value: PersonFilter,
  scope: { country: string; diocese: string; parish: string },
) {
  const params = new URLSearchParams()
  if (value !== 'all') params.set('tipo', value)
  if (scope.country) params.set('pais', scope.country)
  if (scope.diocese) params.set('diocesis', scope.diocese)
  if (scope.parish) params.set('parroquia', scope.parish)
  const query = params.toString()
  return query ? `/personas?${query}` : '/personas'
}

function assignmentDescription(item: PersonTerritorialAssignment) {
  const role = item.position_title ?? item.base_role_name ?? 'Servicio vigente'
  const scope = item.parish_name
    ?? item.direct_entity_name
    ?? item.organization_unit_name
    ?? item.diocese_name
    ?? item.country_name
    ?? 'Ámbito no indicado'
  return `${role} · ${scope}`
}

export default async function PersonasPage({ searchParams }: PageProps) {
  const params = await searchParams
  const filter = normalizePersonFilter(firstValue(params.tipo))
  const requestedCountry = firstValue(params.pais)?.toUpperCase() ?? ''
  const requestedDiocese = firstValue(params.diocesis) ?? ''
  const requestedParish = firstValue(params.parroquia) ?? ''

  try {
    const [items, summary, territorialAssignments] = await Promise.all([
      loadPeopleDirectory(filter),
      loadDashboardSummary(),
      loadPersonTerritorialAssignments(),
    ])

    const countryOptions = [
      { value: '', label: 'Todos los países' },
      ...uniqueOptions(territorialAssignments, (item) => item.country_iso2, (item) => item.country_name),
    ]
    const country = /^[A-Z]{2}$/.test(requestedCountry)
      && countryOptions.some((option) => option.value === requestedCountry)
      ? requestedCountry
      : ''
    const countryAssignments = country
      ? territorialAssignments.filter((item) => item.country_iso2 === country)
      : territorialAssignments

    const dioceseOptions = [
      { value: '', label: country ? 'Todas las diócesis y jurisdicciones' : 'Selecciona primero un país' },
      ...uniqueOptions(countryAssignments, (item) => item.diocese_id, (item) => item.diocese_name),
    ]
    const diocese = country && uuidPattern.test(requestedDiocese)
      && dioceseOptions.some((option) => option.value === requestedDiocese)
      ? requestedDiocese
      : ''
    const dioceseAssignments = diocese
      ? countryAssignments.filter((item) => item.diocese_id === diocese)
      : countryAssignments

    const parishOptions = [
      { value: '', label: diocese ? 'Todas las parroquias' : 'Selecciona primero una diócesis' },
      ...uniqueOptions(dioceseAssignments, (item) => item.parish_id, (item) => item.parish_name),
    ]
    const parish = diocese && uuidPattern.test(requestedParish)
      && parishOptions.some((option) => option.value === requestedParish)
      ? requestedParish
      : ''

    const scopedAssignments = territorialAssignments.filter((item) => (
      (!country || item.country_iso2 === country)
      && (!diocese || item.diocese_id === diocese)
      && (!parish || item.parish_id === parish)
    ))
    const assignmentsByPerson = new Map<string, PersonTerritorialAssignment[]>()
    for (const assignment of scopedAssignments) {
      const personAssignments = assignmentsByPerson.get(assignment.person_id) ?? []
      personAssignments.push(assignment)
      assignmentsByPerson.set(assignment.person_id, personAssignments)
    }

    const territorialScopeActive = Boolean(country || diocese || parish)
    const visibleItems = territorialScopeActive
      ? items.filter((item) => assignmentsByPerson.has(item.id))
      : items
    const selectedCountryName = countryOptions.find((option) => option.value === country)?.label ?? 'Todos los países'
    const selectedDioceseName = dioceseOptions.find((option) => option.value === diocese)?.label ?? ''
    const selectedParishName = parishOptions.find((option) => option.value === parish)?.label ?? ''
    const people = summary.people
    const metricItems = territorialScopeActive ? visibleItems : items
    const metricCount = (type: string) => metricItems.filter((item) => item.person_type === type).length
    const shortcuts: { value: PersonFilter; count: number; title: string; subtitle: string }[] = [
      { value: 'all', count: people.total, title: 'Todas', subtitle: 'personas públicas' },
      { value: 'bishop', count: people.bishops, title: 'Obispos', subtitle: 'con episcopado' },
      { value: 'priest', count: people.priests, title: 'Sacerdotes', subtitle: 'con presbiterado' },
      { value: 'deacon', count: people.deacons, title: 'Diáconos', subtitle: 'con diaconado' },
      { value: 'religious', count: people.religious, title: 'Vida consagrada', subtitle: 'categoría transversal' },
      { value: 'layperson', count: people.laypeople, title: 'Laicos/as', subtitle: 'sin ordenación' },
      { value: 'active', count: people.active, title: 'Activos', subtitle: 'registros vigentes' },
    ]
    const currentScope = { country, diocese, parish }

    return (
      <main className="container dashboard-page">
        <PublicBreadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Personas' }]} />
        <div className="dashboard-hero card dashboard-hero-split">
          <div>
            <p className="eyebrow">Directorio pastoral</p>
            <h1>Personas</h1>
            <p className="lead">Consulta personas por su servicio pastoral vigente: país, diócesis o jurisdicción y parroquia. El país indica dónde sirven, no su nacionalidad.</p>
          </div>
          <aside className="dashboard-path-card" aria-label="Vista activa">
            <p className="eyebrow">Ámbito seleccionado</p>
            <div className="dashboard-path-list">
              <span>{selectedCountryName}</span>
              {selectedDioceseName ? <span>{selectedDioceseName}</span> : null}
              {selectedParishName ? <span>{selectedParishName}</span> : null}
              <span>{filterLabel(filter)} · {visibleItems.length} resultados</span>
            </div>
            <Link className="inline-link" href="/?vista=clero">Volver al explorador de personas</Link>
          </aside>
        </div>

        <section className="dashboard-grid dashboard-summary">
          <div className="metric-card"><strong>{metricItems.length}</strong><span>{territorialScopeActive ? 'Personas en el ámbito' : 'Personas públicas'}</span></div>
          <div className="metric-card"><strong>{territorialScopeActive ? metricCount('bishop') : people.bishops}</strong><span>Con episcopado</span></div>
          <div className="metric-card"><strong>{territorialScopeActive ? metricCount('priest') : people.priests}</strong><span>Con presbiterado</span></div>
          <div className="metric-card"><strong>{territorialScopeActive ? metricCount('deacon') : people.deacons}</strong><span>Con diaconado</span></div>
        </section>

        <section className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Ámbito pastoral</p><h2>Filtrar por territorio de servicio</h2></div><Link className="inline-link" href="/personas">Limpiar todos los filtros</Link></div>
          <p className="meta">Elige primero el país, después la diócesis y finalmente la parroquia. Puedes escribir dentro de cada campo para encontrar una opción rápidamente.</p>
          <PersonTerritorialFilters
            countryOptions={countryOptions}
            dioceseOptions={dioceseOptions}
            parishOptions={parishOptions}
            selectedCountry={country}
            selectedDiocese={diocese}
            selectedParish={parish}
          />
        </section>

        <section className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Condición eclesial</p><h2>Acceso rápido</h2></div><span className="meta">Filtro activo: {filterLabel(filter)}</span></div>
          <div className="quick-link-grid">{shortcuts.map((shortcut) => <Link className={`quick-link-card filter-card ${filter === shortcut.value ? 'active-filter' : ''}`} href={buildFilterHref(shortcut.value, currentScope)} key={shortcut.value}><strong>{shortcut.title}</strong><span>{shortcut.count} {shortcut.subtitle}</span></Link>)}</div>
          <p className="meta">Las categorías pueden coincidir: una persona de vida consagrada también puede ser diácono, sacerdote u obispo.</p>
        </section>

        <section className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Listado</p><h2>{filterLabel(filter)}</h2></div><span className="meta">{visibleItems.length} resultados · abre una ficha para consultar su historia</span></div>
          {visibleItems.length === 0 ? <div className="empty-state">No hay personas públicas con asignaciones vigentes para este ámbito y categoría.</div> : <div className="table-wrap"><table className="data-table dashboard-list-table people-list-table"><thead><tr><th>Nombre</th><th>Condición</th><th>Edad ref.</th><th>Estado</th><th>{territorialScopeActive ? 'Servicio pastoral vigente' : 'Resumen'}</th></tr></thead><tbody>{visibleItems.map((item) => {
            const personAssignments = assignmentsByPerson.get(item.id) ?? []
            return <tr className="clickable-table-row" key={item.id}><td><Link href={`/personas/${item.slug}`}><strong>{item.display_name}</strong><small>Ver ficha completa →</small></Link></td><td>{personTypeLabel(item.person_type, item.is_religious)}</td><td>{item.age_text ? `${item.age_text} años` : '—'}</td><td>{item.status === 'active' && !item.death_date ? 'Activo' : 'No activo'}</td><td>{territorialScopeActive
              ? <div className="person-service-list">{personAssignments.slice(0, 3).map((assignment) => <span key={assignment.assignment_id}>{assignmentDescription(assignment)}</span>)}{personAssignments.length > 3 ? <small>+ {personAssignments.length - 3} servicios adicionales</small> : null}</div>
              : item.biography_public ?? 'Sin resumen público'}</td></tr>
          })}</tbody></table></div>}
        </section>
      </main>
    )
  } catch (error) {
    console.error('Unable to render people directory', error)
    return <main className="container"><div className="error-box">No se pudo cargar el directorio de personas.</div></main>
  }
}
