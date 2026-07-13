import type { Metadata } from 'next'
import Link from 'next/link'
import { loadDashboardSummary } from '@/lib/public/dashboard'
import { loadDioceseDirectory, normalizeDioceseFilter, type DioceseFilter } from '@/lib/public/directories'

export const metadata: Metadata = {
  title: 'Diócesis y jurisdicciones · SINEP RD',
  description: 'Directorio público de arquidiócesis, diócesis y jurisdicciones eclesiásticas registradas en SINEP RD.',
}

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const builtinFilters = new Set(['all', 'archdiocese', 'diocese', 'military'])
const firstValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value
const formatNumber = (value: number | null | undefined) => new Intl.NumberFormat('es-DO').format(value ?? 0)

function filterTitle(filter: DioceseFilter) {
  if (filter === 'all') return 'Todas las jurisdicciones'
  if (filter === 'archdiocese') return 'Arquidiócesis'
  if (filter === 'diocese') return 'Diócesis'
  if (filter === 'military') return 'Jurisdicción castrense'
  return filter
}

function filterHref(value: DioceseFilter) {
  if (value === 'all') return '/diocesis'
  if (builtinFilters.has(value)) return `/diocesis?tipo=${encodeURIComponent(value)}`
  return `/diocesis?provincia=${encodeURIComponent(value)}`
}

export default async function DiocesisPage({ searchParams }: PageProps) {
  const params = await searchParams
  const province = firstValue(params.provincia) ?? null
  const filter = province ?? normalizeDioceseFilter(firstValue(params.tipo))

  try {
    const [items, summary] = await Promise.all([loadDioceseDirectory(filter, province), loadDashboardSummary()])
    const dashboard = summary.dioceses
    const shortcuts: { value: DioceseFilter; title: string; subtitle: string; count: number }[] = [
      { value: 'all', title: 'Todas', subtitle: 'Jurisdicciones registradas', count: dashboard.total },
      { value: 'archdiocese', title: 'Arquidiócesis', subtitle: 'Sedes arquidiocesanas', count: dashboard.archdioceses },
      { value: 'diocese', title: 'Diócesis', subtitle: 'Jurisdicciones diocesanas', count: dashboard.dioceses },
      { value: 'military', title: 'Castrense', subtitle: 'Jurisdicción militar', count: dashboard.military },
    ]

    return (
      <main className="container dashboard-page">
        <div className="dashboard-hero card dashboard-hero-split">
          <div><p className="eyebrow">Directorio jerárquico</p><h1>Diócesis y jurisdicciones</h1><p className="lead">Consulta renderizada desde el servidor de la organización territorial-canónica. Cada resultado abre su ficha pública y su historial institucional.</p></div>
          <aside className="dashboard-path-card" aria-label="Ruta activa"><p className="eyebrow">Ruta activa</p><div className="dashboard-path-list"><span>República Dominicana</span><span>{province ?? 'Todas las provincias eclesiásticas'}</span><span>{filterTitle(filter)}</span></div><Link className="inline-link" href="/?vista=territorial">Volver al dashboard territorial</Link></aside>
        </div>

        <section className="dashboard-grid dashboard-summary">
          <div className="metric-card"><strong>{dashboard.total}</strong><span>Jurisdicciones</span></div>
          <div className="metric-card"><strong>{dashboard.archdioceses}</strong><span>Arquidiócesis</span></div>
          <div className="metric-card"><strong>{dashboard.dioceses}</strong><span>Diócesis</span></div>
          <div className="metric-card"><strong>{dashboard.military}</strong><span>Castrense</span></div>
        </section>
        <section className="dashboard-grid dashboard-summary">
          <div className="metric-card"><strong>{formatNumber(dashboard.total_catholics)}</strong><span>Fieles católicos reportados</span></div>
          <div className="metric-card"><strong>{formatNumber(dashboard.total_population)}</strong><span>Población total reportada</span></div>
          <div className="metric-card"><strong>{formatNumber(dashboard.loaded_parishes)}</strong><span>Parroquias cargadas</span></div>
          <div className="metric-card"><strong>{formatNumber(dashboard.reported_parishes)}</strong><span>Parroquias reportadas</span></div>
        </section>

        <section className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Filtros</p><h2>Selecciona el contexto</h2></div><span className="meta">Filtro activo: {filterTitle(filter)}</span></div>
          <div className="quick-link-grid">{shortcuts.map((shortcut) => <Link className={`quick-link-card filter-card ${filter === shortcut.value ? 'active-filter' : ''}`} href={filterHref(shortcut.value)} key={shortcut.value}><strong>{shortcut.title}</strong><span>{shortcut.count} {shortcut.subtitle.toLowerCase()}</span></Link>)}</div>
          <div className="filter-chip-list">{dashboard.provinces.map((item) => <Link className={`filter-chip ${province === item.name ? 'active-filter' : ''}`} href={filterHref(item.name)} key={item.name}><strong>{item.name}</strong><span>{item.count} jurisdicciones</span></Link>)}</div>
        </section>

        <section className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Directorio</p><h2>{filterTitle(filter)}</h2></div><span className="meta">{items.length} resultados</span></div>
          {items.length === 0 ? <div className="empty-state">No hay jurisdicciones para mostrar en este filtro.</div> : <div className="public-directory-list">{items.map((item) => <Link className="public-directory-item" href={`/entidades/${item.slug}`} key={item.id}><div><strong>{item.name}</strong><span>{item.entity_type_name ?? 'Jurisdicción'} · {item.ecclesiastical_province_name ?? item.province ?? 'República Dominicana'}</span></div><small>{item.current_ordinary_name ?? 'Sin ordinario publicado'} · Ver ficha →</small></Link>)}</div>}
        </section>
      </main>
    )
  } catch (error) {
    console.error('Unable to render dioceses directory', error)
    return <main className="container"><div className="error-box">No se pudo cargar el directorio de diócesis.</div></main>
  }
}
