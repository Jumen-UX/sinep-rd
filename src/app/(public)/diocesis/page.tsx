import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicBreadcrumbs } from '@/components/public/PublicBreadcrumbs'
import { loadDashboardSummary } from '@/lib/public/dashboard'
import { loadDioceseDirectory, normalizeDioceseFilter, type DioceseDirectoryItem, type DioceseFilter } from '@/lib/public/directories'
import { buildPublicMetadata } from '@/lib/public/metadata'

export const metadata: Metadata = buildPublicMetadata({
  title: 'Diócesis y jurisdicciones',
  description: 'Directorio público de arquidiócesis, diócesis y jurisdicciones eclesiásticas registradas en distintos países.',
  path: '/diocesis',
})

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const builtinFilters = new Set(['all', 'archdiocese', 'diocese', 'military'])
const firstValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value
const formatNumber = (value: number | null | undefined) => new Intl.NumberFormat('es-DO').format(value ?? 0)
const normalize = (value?: string | null) => (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const isArchdiocese = (item: DioceseDirectoryItem) => normalize(item.entity_type_name).includes('arquidiocesis')
const isDiocese = (item: DioceseDirectoryItem) => {
  const type = normalize(item.entity_type_name)
  return type.includes('diocesis') && !type.includes('arquidiocesis')
}
const isMilitary = (item: DioceseDirectoryItem) => /castrense|militar/.test(normalize(`${item.entity_type_name ?? ''} ${item.name}`))

function filterTitle(filter: DioceseFilter) {
  if (filter === 'all') return 'Todas las jurisdicciones'
  if (filter === 'archdiocese') return 'Arquidiócesis'
  if (filter === 'diocese') return 'Diócesis'
  if (filter === 'military') return 'Jurisdicción castrense'
  return filter
}

function filterHref(value: DioceseFilter, country: string | null) {
  if (!country && value !== 'all' && !builtinFilters.has(value)) {
    return `/diocesis?provincia=${encodeURIComponent(value)}`
  }

  const params = new URLSearchParams()
  if (country) params.set('pais', country)
  if (value !== 'all') {
    if (builtinFilters.has(value)) params.set('tipo', value)
    else params.set('provincia', value)
  }
  const search = params.toString()
  return search ? `/diocesis?${search}` : '/diocesis'
}

export default async function DiocesisPage({ searchParams }: PageProps) {
  const params = await searchParams
  const country = firstValue(params.pais)?.toUpperCase() ?? null
  const province = firstValue(params.provincia) ?? null
  const filter = province ?? normalizeDioceseFilter(firstValue(params.tipo))

  try {
    const [items, scopeItems, summary] = await Promise.all([
      loadDioceseDirectory(filter, province, undefined, country),
      loadDioceseDirectory('all', null, undefined, country),
      loadDashboardSummary(),
    ])
    const dashboard = summary.dioceses
    const countryName = country
      ? scopeItems.find((item) => item.country_name)?.country_name ?? country
      : 'Todos los países'
    const scopeMetrics = country
      ? {
          total: scopeItems.length,
          archdioceses: scopeItems.filter(isArchdiocese).length,
          dioceses: scopeItems.filter(isDiocese).length,
          military: scopeItems.filter(isMilitary).length,
          totalCatholics: scopeItems.reduce((sum, item) => sum + (item.catholics_total ?? 0), 0),
          totalPopulation: scopeItems.reduce((sum, item) => sum + (item.population_total ?? 0), 0),
          loadedParishes: scopeItems.reduce((sum, item) => sum + (item.parishes_count ?? 0), 0),
          reportedParishes: scopeItems.reduce((sum, item) => sum + (item.parishes_count ?? 0), 0),
        }
      : {
          total: dashboard.total,
          archdioceses: dashboard.archdioceses,
          dioceses: dashboard.dioceses,
          military: dashboard.military,
          totalCatholics: dashboard.total_catholics,
          totalPopulation: dashboard.total_population,
          loadedParishes: dashboard.loaded_parishes,
          reportedParishes: dashboard.reported_parishes,
        }
    const provinceMap = new Map<string, number>()
    if (country) {
      scopeItems.forEach((item) => {
        if (item.ecclesiastical_province_name) {
          provinceMap.set(item.ecclesiastical_province_name, (provinceMap.get(item.ecclesiastical_province_name) ?? 0) + 1)
        }
      })
    }
    const provinces = Array.from(provinceMap, ([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, 'es'))
    const shortcuts: { value: DioceseFilter; title: string; subtitle: string; count: number }[] = [
      { value: 'all', title: 'Todas', subtitle: 'Jurisdicciones registradas', count: scopeMetrics.total },
      { value: 'archdiocese', title: 'Arquidiócesis', subtitle: 'Sedes arquidiocesanas', count: scopeMetrics.archdioceses },
      { value: 'diocese', title: 'Diócesis', subtitle: 'Jurisdicciones diocesanas', count: scopeMetrics.dioceses },
      { value: 'military', title: 'Castrense', subtitle: 'Jurisdicción militar', count: scopeMetrics.military },
    ]

    return (
      <main className="container dashboard-page">
        <PublicBreadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Diócesis y jurisdicciones' }]} />
        <div className="dashboard-hero card dashboard-hero-split">
          <div><p className="eyebrow">Directorio jerárquico</p><h1>Diócesis y jurisdicciones</h1><p className="lead">Consulta renderizada desde el servidor de la organización territorial-canónica. Cada resultado abre su ficha pública y su historial institucional.</p></div>
          <aside className="dashboard-path-card" aria-label="Ruta activa"><p className="eyebrow">Ruta activa</p><div className="dashboard-path-list"><span>{countryName}</span><span>{province ?? (country ? 'Todas las provincias eclesiásticas' : 'Sin filtro de provincia')}</span><span>{filterTitle(filter)}</span></div><Link className="inline-link" href={`/?vista=territorial${country ? `&pais=${encodeURIComponent(country)}` : ''}#explorador`}>Cambiar ámbito en el explorador</Link></aside>
        </div>

        <section className="dashboard-grid dashboard-summary">
          <div className="metric-card"><strong>{scopeMetrics.total}</strong><span>Jurisdicciones</span></div>
          <div className="metric-card"><strong>{scopeMetrics.archdioceses}</strong><span>Arquidiócesis</span></div>
          <div className="metric-card"><strong>{scopeMetrics.dioceses}</strong><span>Diócesis</span></div>
          <div className="metric-card"><strong>{scopeMetrics.military}</strong><span>Castrense</span></div>
        </section>
        <section className="dashboard-grid dashboard-summary">
          <div className="metric-card"><strong>{formatNumber(scopeMetrics.totalCatholics)}</strong><span>Fieles católicos reportados</span></div>
          <div className="metric-card"><strong>{formatNumber(scopeMetrics.totalPopulation)}</strong><span>Población total reportada</span></div>
          <div className="metric-card"><strong>{formatNumber(scopeMetrics.loadedParishes)}</strong><span>Parroquias cargadas</span></div>
          <div className="metric-card"><strong>{formatNumber(scopeMetrics.reportedParishes)}</strong><span>Parroquias reportadas</span></div>
        </section>

        <section className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Filtros</p><h2>Selecciona el contexto</h2></div><span className="meta">Filtro activo: {filterTitle(filter)}</span></div>
          <div className="quick-link-grid">{shortcuts.map((shortcut) => <Link className={`quick-link-card filter-card ${filter === shortcut.value ? 'active-filter' : ''}`} href={filterHref(shortcut.value, country)} key={shortcut.value}><strong>{shortcut.title}</strong><span>{shortcut.count} {shortcut.subtitle.toLowerCase()}</span></Link>)}</div>
          {country ? (
            <div className="filter-chip-list">{provinces.map((item) => <Link className={`filter-chip ${province === item.name ? 'active-filter' : ''}`} href={filterHref(item.name, country)} key={item.name}><strong>{item.name}</strong><span>{item.count} jurisdicciones</span></Link>)}</div>
          ) : <div className="empty-state">Selecciona un país en el explorador para consultar sus provincias eclesiásticas sin mezclar territorios homónimos.</div>}
        </section>

        <section className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Directorio</p><h2>{filterTitle(filter)}</h2></div><span className="meta">{items.length} resultados</span></div>
          {items.length === 0 ? <div className="empty-state">No hay jurisdicciones para mostrar en este filtro.</div> : <div className="public-directory-list">{items.map((item) => <Link className="public-directory-item" href={`/entidades/${item.slug}`} key={item.id}><div><strong>{item.name}</strong><span>{item.entity_type_name ?? 'Jurisdicción'} · {item.ecclesiastical_province_name ?? item.province ?? 'Sin provincia eclesiástica'}</span></div><small>{item.country_name ?? item.country_iso2 ?? 'País no indicado'} · {item.current_ordinary_name ?? 'Sin ordinario publicado'} · Ver ficha →</small></Link>)}</div>}
        </section>
      </main>
    )
  } catch (error) {
    console.error('Unable to render dioceses directory', error)
    return <main className="container"><div className="error-box">No se pudo cargar el directorio de diócesis.</div></main>
  }
}
