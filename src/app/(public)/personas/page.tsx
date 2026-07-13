import type { Metadata } from 'next'
import Link from 'next/link'
import { loadDashboardSummary } from '@/lib/public/dashboard'
import { loadPeopleDirectory, normalizePersonFilter, type PersonFilter } from '@/lib/public/directories'

export const metadata: Metadata = {
  title: 'Personas · SINEP RD',
  description: 'Directorio público de obispos, sacerdotes, diáconos, personas consagradas y laicos registrados en SINEP RD.',
}

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const firstValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value

function personTypeLabel(value: string | null, isReligious: boolean) {
  const labels: Record<string, string> = { bishop: 'Obispo', priest: 'Sacerdote', deacon: 'Diácono', religious: 'Religioso/a', layperson: 'Laico/a' }
  const label = value ? labels[value] ?? value : 'Persona'
  return isReligious && label !== 'Religioso/a' ? `${label} · Vida consagrada` : label
}

function filterLabel(value: PersonFilter) {
  const labels: Record<PersonFilter, string> = { all: 'Todas las personas', bishop: 'Obispos', priest: 'Sacerdotes', deacon: 'Diáconos', religious: 'Vida consagrada', layperson: 'Laicos/as', active: 'Activos' }
  return labels[value]
}

const filterHref = (value: PersonFilter) => value === 'all' ? '/personas' : `/personas?tipo=${encodeURIComponent(value)}`

export default async function PersonasPage({ searchParams }: PageProps) {
  const params = await searchParams
  const filter = normalizePersonFilter(firstValue(params.tipo))

  try {
    const [items, summary] = await Promise.all([loadPeopleDirectory(filter), loadDashboardSummary()])
    const people = summary.people
    const shortcuts: { value: PersonFilter; count: number; title: string; subtitle: string }[] = [
      { value: 'all', count: people.total, title: 'Todas', subtitle: 'personas públicas' },
      { value: 'bishop', count: people.bishops, title: 'Obispos', subtitle: 'con episcopado' },
      { value: 'priest', count: people.priests, title: 'Sacerdotes', subtitle: 'con presbiterado' },
      { value: 'deacon', count: people.deacons, title: 'Diáconos', subtitle: 'con diaconado' },
      { value: 'religious', count: people.religious, title: 'Vida consagrada', subtitle: 'categoría transversal' },
      { value: 'layperson', count: people.laypeople, title: 'Laicos/as', subtitle: 'sin ordenación' },
      { value: 'active', count: people.active, title: 'Activos', subtitle: 'registros vigentes' },
    ]

    return (
      <main className="container dashboard-page">
        <div className="dashboard-hero card dashboard-hero-split">
          <div><p className="eyebrow">Directorio pastoral</p><h1>Personas</h1><p className="lead">Listado renderizado desde el servidor por grado del Orden, condición laical y vida consagrada. Cada nombre abre su ficha canónica y ministerial.</p></div>
          <aside className="dashboard-path-card"><p className="eyebrow">Vista activa</p><div className="dashboard-path-list"><span>República Dominicana</span><span>{filterLabel(filter)}</span><span>{items.length} resultados</span></div><Link className="inline-link" href="/?vista=clero">Volver al dashboard de clero</Link></aside>
        </div>

        <section className="dashboard-grid dashboard-summary"><div className="metric-card"><strong>{people.total}</strong><span>Personas públicas</span></div><div className="metric-card"><strong>{people.bishops}</strong><span>Con episcopado</span></div><div className="metric-card"><strong>{people.priests}</strong><span>Con presbiterado</span></div><div className="metric-card"><strong>{people.deacons}</strong><span>Con diaconado</span></div></section>

        <section className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Filtros</p><h2>Acceso rápido</h2></div><span className="meta">Filtro activo: {filterLabel(filter)}</span></div>
          <div className="quick-link-grid">{shortcuts.map((shortcut) => <Link className={`quick-link-card filter-card ${filter === shortcut.value ? 'active-filter' : ''}`} href={filterHref(shortcut.value)} key={shortcut.value}><strong>{shortcut.title}</strong><span>{shortcut.count} {shortcut.subtitle}</span></Link>)}</div>
          <p className="meta">Las categorías son transversales: una persona de vida consagrada también puede ser diácono, sacerdote u obispo.</p>
        </section>

        <section className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Listado</p><h2>{filterLabel(filter)}</h2></div><span className="meta">{items.length} resultados · abre una ficha para consultar su historia</span></div>
          {items.length === 0 ? <div className="empty-state">No hay registros para este filtro.</div> : <div className="table-wrap"><table className="data-table dashboard-list-table people-list-table"><thead><tr><th>Nombre</th><th>Condición</th><th>Edad ref.</th><th>Estado</th><th>Resumen</th></tr></thead><tbody>{items.map((item) => <tr className="clickable-table-row" key={item.id}><td><Link href={`/personas/${item.slug}`}><strong>{item.display_name}</strong><small>Ver ficha completa →</small></Link></td><td>{personTypeLabel(item.person_type, item.is_religious)}</td><td>{item.age_text ? `${item.age_text} años` : '—'}</td><td>{item.status === 'active' && !item.death_date ? 'Activo' : 'No activo'}</td><td>{item.biography_public ?? 'Sin resumen público'}</td></tr>)}</tbody></table></div>}
        </section>
      </main>
    )
  } catch (error) {
    console.error('Unable to render people directory', error)
    return <main className="container"><div className="error-box">No se pudo cargar el directorio de personas.</div></main>
  }
}
