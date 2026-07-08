'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type PublicView = 'territorial' | 'clero' | 'pastoral' | 'administrativa' | 'colegial'

type Diocese = {
  id: string
  slug: string
  name: string
  entity_type_name: string | null
  ecclesiastical_province_name: string | null
  current_ordinary_name: string | null
  current_ordinary_title: string | null
  population_total: number | null
  catholics_total: number | null
  parishes_count: number | null
}

type Person = {
  id: string
  display_name: string
  slug: string
  person_type: string | null
  status: string | null
  death_date: string | null
}

type PastoralEntity = {
  id: string
  name: string
  slug: string
  diocese_id: string | null
  diocese_name: string | null
  diocese_slug: string | null
  level_name: string | null
  level_key: string | null
  level_order: number | null
  linked_entity_name?: string | null
  linked_entity_slug?: string | null
  parent_pastoral_entity_id: string | null
  parent_pastoral_entity_name: string | null
}

type OrganizationChart = { id: string; key: string; name: string; description: string | null }
type OrganizationUnit = { id: string; organization_chart_id: string | null; parent_unit_id: string | null; name: string; description: string | null }

type PublicDashboardData = {
  countries: { key: string; name: string }[]
  dioceses: Diocese[]
  people: Person[]
  pastoral_entities: PastoralEntity[]
  organization_charts: OrganizationChart[]
  organization_units: OrganizationUnit[]
}

type DashboardSummary = {
  dioceses: {
    total: number
    archdioceses: number
    dioceses: number
    military: number
    provinces: { name: string; count: number }[]
    total_catholics: number
    total_population: number
    total_parishes?: number
    loaded_parishes: number
    reported_parishes: number
  }
  people: {
    total: number
    bishops: number
    priests: number
    deacons: number
    religious: number
    laypeople: number
    active: number
  }
}

type ViewMeta = {
  key: PublicView
  title: string
  shortTitle: string
  eyebrow: string
  icon: string
  description: string
}

const publicViews: ViewMeta[] = [
  { key: 'territorial', title: 'Vista territorial', shortTitle: 'Territorial', eyebrow: 'Territorio', icon: '▱', description: 'País, provincias eclesiásticas, arquidiócesis, diócesis y jurisdicciones personales.' },
  { key: 'clero', title: 'Clero y agentes', shortTitle: 'Clero y agentes', eyebrow: 'Personas', icon: '♙', description: 'Obispos, presbíteros, diáconos, vida consagrada y laicos con responsabilidad.' },
  { key: 'pastoral', title: 'Organización pastoral', shortTitle: 'Pastoral', eyebrow: 'Pastoral', icon: '✝', description: 'Vicarías, zonas pastorales, parroquias, sectores, capillas y comunidades.' },
  { key: 'administrativa', title: 'Organización administrativa', shortTitle: 'Administración', eyebrow: 'Administración', icon: '▣', description: 'Curia, oficinas, departamentos, servicios y dependencias internas.' },
  { key: 'colegial', title: 'Organización colegial', shortTitle: 'Colegial', eyebrow: 'Colegial', icon: '♧', description: 'Consejos, comisiones, comités, organismos colegiados y equipos transversales.' },
]

const sideNav = [
  { label: 'Inicio', icon: '⌂', href: '/', active: true },
  { label: 'Territorio', icon: '◇', href: '/?vista=territorial' },
  { label: 'Personas', icon: '♙', href: '/?vista=clero' },
  { label: 'Pastoral', icon: '✝', href: '/?vista=pastoral' },
  { label: 'Administración', icon: '▣', href: '/?vista=administrativa' },
  { label: 'Colegial', icon: '♧', href: '/?vista=colegial' },
  { label: 'Reportes', icon: '▤', href: '#' },
  { label: 'Estadísticas', icon: '▥', href: '#' },
  { label: 'Mapa eclesial', icon: '⌖', href: '#' },
  { label: 'Configuración', icon: '⚙', href: '/admin' },
  { label: 'Ayuda', icon: '?', href: '#' },
]

const bottomNav = [
  { label: 'Inicio', icon: '⌂', href: '/', active: true },
  { label: 'Territorio', icon: '▱', href: '/?vista=territorial' },
  { label: 'Personas', icon: '♙', href: '/?vista=clero' },
  { label: 'Más', icon: '•••', href: '#' },
]

const publicViewKeys = new Set<PublicView>(publicViews.map((view) => view.key))

const personTypes = [
  { key: '', label: 'Todas las personas' },
  { key: 'bishop', label: 'Obispos' },
  { key: 'priest', label: 'Presbíteros' },
  { key: 'deacon', label: 'Diáconos' },
  { key: 'religious', label: 'Religiosos/as' },
  { key: 'layperson', label: 'Laicos/as' },
]

function isPublicView(value: string | null): value is PublicView {
  return !!value && publicViewKeys.has(value as PublicView)
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('es-DO').format(value)
}

function normalizeText(value?: string | null) {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function slugify(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function personTypeLabel(value: string | null) {
  const labels: Record<string, string> = {
    bishop: 'Obispo',
    priest: 'Presbítero',
    deacon: 'Diácono',
    religious: 'Religioso/a',
    layperson: 'Laico/a',
  }
  return value ? labels[value] ?? value : 'Persona'
}

function statusLabel(item: Person) {
  return item.status === 'active' && !item.death_date ? 'Activo' : 'Histórico'
}

function isArchdiocese(item: Diocese) {
  return normalizeText(item.entity_type_name).includes('arquidiocesis')
}

function isDiocese(item: Diocese) {
  const type = normalizeText(item.entity_type_name)
  return type.includes('diocesis') && !type.includes('arquidiocesis')
}

function isMilitary(item: Diocese) {
  const label = normalizeText(`${item.entity_type_name ?? ''} ${item.name}`)
  return label.includes('militar') || label.includes('castrense')
}

function groupBy<T>(items: T[], keyFn: (item: T) => string) {
  return items.reduce((map, item) => {
    const key = keyFn(item)
    map.set(key, (map.get(key) ?? 0) + 1)
    return map
  }, new Map<string, number>())
}

function MetricCard({ icon, label, value, detail, onClick, active }: { icon: string; label: string; value: string | number; detail: string; onClick?: () => void; active?: boolean }) {
  const content = (
    <>
      <span className="public-metric-icon">{icon}</span>
      <strong>{label}</strong>
      <b>{value}</b>
      <small>{detail}</small>
    </>
  )

  if (!onClick) return <article className="public-metric-card">{content}</article>

  return <button className={`public-metric-card ${active ? 'active' : ''}`} onClick={onClick} type="button">{content}</button>
}

function EmptyViewNote({ title, detail }: { title: string; detail: string }) {
  return <div className="public-empty"><strong>{title}</strong><br /><span>{detail}</span></div>
}

export default function HomePage() {
  const [activeView, setActiveView] = useState<PublicView>('territorial')
  const [data, setData] = useState<PublicDashboardData | null>(null)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [countryFilter, setCountryFilter] = useState('DO')
  const [provinceFilter, setProvinceFilter] = useState('')
  const [jurisdictionFilter, setJurisdictionFilter] = useState('')
  const [personTypeFilter, setPersonTypeFilter] = useState('')
  const [pastoralLevelFilter, setPastoralLevelFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const view = params.get('vista')
    if (isPublicView(view)) setActiveView(view)
  }, [])

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [summaryResponse, viewsResponse] = await Promise.all([
          fetch('/api/dashboard/resumen'),
          fetch('/api/dashboard/vistas'),
        ])
        if (summaryResponse.ok) setSummary((await summaryResponse.json()) as DashboardSummary)
        if (viewsResponse.ok) setData((await viewsResponse.json()) as PublicDashboardData)
      } finally {
        setLoading(false)
      }
    }
    loadDashboard()
  }, [])

  const countries = data?.countries ?? [{ key: 'DO', name: 'República Dominicana' }]
  const dioceses = data?.dioceses ?? []
  const people = data?.people ?? []
  const pastoralEntities = data?.pastoral_entities ?? []
  const organizationCharts = data?.organization_charts ?? []
  const organizationUnits = data?.organization_units ?? []

  const provinces = useMemo(() => {
    const grouped = groupBy(dioceses.filter((item) => item.ecclesiastical_province_name), (item) => item.ecclesiastical_province_name ?? '')
    return Array.from(grouped, ([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [dioceses])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const province = params.get('provincia')
    if (!province || provinces.length === 0) return
    const match = provinces.find((item) => item.name === province || slugify(item.name) === province)
    if (match) setProvinceFilter(match.name)
  }, [provinces])

  const diocesesByProvince = useMemo(() => {
    return provinceFilter ? dioceses.filter((item) => item.ecclesiastical_province_name === provinceFilter) : dioceses
  }, [dioceses, provinceFilter])

  const selectedJurisdiction = dioceses.find((item) => item.id === jurisdictionFilter) ?? null
  const scopedDioceses = jurisdictionFilter ? dioceses.filter((item) => item.id === jurisdictionFilter) : diocesesByProvince
  const visibleJurisdictions = scopedDioceses.slice(0, 5)

  const filteredPeople = people.filter((item) => !personTypeFilter || item.person_type === personTypeFilter)
  const visiblePeople = filteredPeople.slice(0, 12)

  const pastoralLevels = useMemo(() => {
    const scoped = jurisdictionFilter ? pastoralEntities.filter((item) => item.diocese_id === jurisdictionFilter || item.diocese_slug === selectedJurisdiction?.slug) : pastoralEntities
    const grouped = groupBy(scoped, (item) => item.level_name ?? 'Sin nivel')
    return Array.from(grouped, ([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [jurisdictionFilter, pastoralEntities, selectedJurisdiction?.slug])

  const filteredPastoral = pastoralEntities.filter((item) => {
    if (jurisdictionFilter && item.diocese_id !== jurisdictionFilter && item.diocese_slug !== selectedJurisdiction?.slug) return false
    if (pastoralLevelFilter && item.level_name !== pastoralLevelFilter) return false
    return true
  })

  const administrativeUnits = organizationUnits.filter((item) => !/(consejo|comision|comisión|comite|comité|colegio|equipo)/i.test(item.name))
  const collegialUnits = organizationUnits.filter((item) => /(consejo|comision|comisión|comite|comité|colegio|equipo)/i.test(item.name))

  function resetTerritory(nextView?: PublicView) {
    if (nextView) setActiveView(nextView)
    setProvinceFilter('')
    setJurisdictionFilter('')
    setPastoralLevelFilter('')
    setPersonTypeFilter('')
  }

  function selectProvince(name: string) {
    setProvinceFilter(name)
    setJurisdictionFilter('')
    setActiveView('territorial')
  }

  const peopleSummary = summary?.people
  const diocesesSummary = summary?.dioceses
  const registeredParishes = diocesesSummary?.loaded_parishes ?? diocesesSummary?.reported_parishes ?? 0
  const activeViewMeta = publicViews.find((view) => view.key === activeView) ?? publicViews[0]

  return (
    <main className="public-dashboard-layout">
      <header className="public-mobile-header">
        <Link className="public-mobile-brand" href="/">
          <span className="public-brand-mark">✛</span>
          <span>
            <span className="public-brand-title">SINEP RD</span>
            <span className="public-brand-subtitle">Sistema de Información<br />Eclesial Pastoral</span>
          </span>
        </Link>
        <Link className="public-mobile-icon-button" href="/admin/login" aria-label="Iniciar sesión">◎</Link>
        <button className="public-mobile-menu-button" type="button" aria-label="Abrir menú">☰</button>
      </header>

      <aside className="public-sidebar" aria-label="Menú principal">
        <Link className="public-sidebar-brand" href="/">
          <span className="public-brand-mark">✛</span>
          <span>
            <span className="public-brand-title">SINEP RD</span>
            <span className="public-brand-subtitle">Sistema de Información<br />Eclesial Pastoral</span>
          </span>
        </Link>

        <nav className="public-sidebar-nav">
          {sideNav.map((item) => (
            <Link className={`public-sidebar-link ${item.active ? 'active' : ''}`} href={item.href} key={item.label}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="public-sidebar-footer">
          <strong>Sistema oficial</strong>
          <span>Conferencia del Episcopado Dominicano</span>
          <span>Versión 1.0.0</span>
        </div>
      </aside>

      <div className="public-main">
        <div className="public-topbar">
          <Link className="public-user-button" href="/admin/login" aria-label="Iniciar sesión">◎</Link>
        </div>

        <section className="public-panel public-filter-panel">
          <div className="public-panel-title">
            <div className="public-heading-accent"><h1>Ámbito de consulta</h1></div>
            <button className="public-clear-button" onClick={() => resetTerritory()} type="button">↻ Limpiar filtros</button>
          </div>

          <div className="public-filter-grid">
            <label>País<select value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}>{countries.map((country) => <option key={country.key} value={country.key}>{country.name}</option>)}</select></label>
            <label>Provincia eclesiástica<select value={provinceFilter} onChange={(event) => { setProvinceFilter(event.target.value); setJurisdictionFilter('') }}><option value="">Todas las provincias</option>{provinces.map((province) => <option key={province.name} value={province.name}>{province.name}</option>)}</select></label>
            <label>Jurisdicción<select value={jurisdictionFilter} onChange={(event) => setJurisdictionFilter(event.target.value)}><option value="">Todas las jurisdicciones</option>{diocesesByProvince.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>Vista activa<select value={activeView} onChange={(event) => setActiveView(event.target.value as PublicView)}>{publicViews.map((view) => <option key={view.key} value={view.key}>{view.title}</option>)}</select></label>
          </div>
        </section>

        <section className="public-tabs" aria-label="Vistas públicas">
          {publicViews.map((view) => (
            <button className={`public-tab ${activeView === view.key ? 'active' : ''}`} key={view.key} onClick={() => setActiveView(view.key)} type="button">
              <span>{view.icon}</span>
              <span>{view.shortTitle}</span>
            </button>
          ))}
        </section>

        {activeView === 'territorial' && (
          <>
            <section className="public-panel public-scope-card">
              <span className="public-country-mark">▰</span>
              <div>
                <h2>República Dominicana</h2>
                <div className="public-scope-summary">
                  <span>{loading ? '—' : provinces.length} provincias eclesiásticas</span>
                  <span>{loading ? '—' : scopedDioceses.filter(isArchdiocese).length} arquidiócesis</span>
                  <span>{loading ? '—' : scopedDioceses.filter(isDiocese).length} diócesis</span>
                  <span>{loading ? '—' : scopedDioceses.filter(isMilitary).length} ordinariato</span>
                  <span>{loading ? '—' : formatNumber(registeredParishes)} parroquias</span>
                </div>
              </div>
            </section>

            <section className="public-metrics-grid" aria-label="Resumen territorial">
              <MetricCard icon="◎" label="País" value={countryFilter === 'DO' ? 1 : 0} detail="República Dominicana" onClick={() => resetTerritory('territorial')} />
              <MetricCard icon="▥" label="Provincias eclesiásticas" value={loading ? '—' : provinces.length} detail="Selecciona una para filtrar" onClick={() => resetTerritory('territorial')} active={!!provinceFilter} />
              <MetricCard icon="⌂" label="Arquidiócesis" value={loading ? '—' : scopedDioceses.filter(isArchdiocese).length} detail="Sedes metropolitanas o arquidiocesanas" />
              <MetricCard icon="✛" label="Diócesis" value={loading ? '—' : scopedDioceses.filter(isDiocese).length} detail="Jurisdicciones diocesanas" />
              <MetricCard icon="盾" label="Ordinariatos" value={loading ? '—' : scopedDioceses.filter(isMilitary).length} detail="Jurisdicciones personales o militares" />
              <MetricCard icon="⌂" label="Parroquias reportadas" value={loading ? '—' : formatNumber(registeredParishes)} detail="Solo parroquias registradas en BD" />
            </section>

            <section className="public-content-grid">
              <article className="public-panel public-section-card">
                <div className="public-section-title">
                  <p className="eyebrow">Provincias eclesiásticas</p>
                  <h2>Selecciona una provincia</h2>
                </div>

                <div className="public-province-list">
                  {provinces.length === 0 && <EmptyViewNote title="Sin provincias" detail="Todavía no hay provincias eclesiásticas publicadas." />}
                  {provinces.map((province) => (
                    <article className={`public-province-card ${provinceFilter === province.name ? 'active' : ''}`} key={province.name}>
                      <span className="public-node-icon">⌂</span>
                      <button onClick={() => selectProvince(province.name)} type="button">
                        <strong>{province.name}</strong>
                        <span>{province.count} jurisdicciones</span>
                      </button>
                      <Link className="public-link" href={`/provincias-eclesiasticas/${slugify(province.name)}`}>Ver ficha →</Link>
                    </article>
                  ))}
                </div>
              </article>

              <article className="public-panel public-section-card">
                <div className="public-section-title">
                  <p className="eyebrow">Jurisdicciones</p>
                  <h2>{scopedDioceses.length} resultados</h2>
                </div>

                <div className="public-table">
                  <div className="public-table-head"><span>Jurisdicción</span><span>Tipo</span><span>Acción</span></div>
                  {visibleJurisdictions.length === 0 && <div className="public-empty">No hay jurisdicciones para mostrar.</div>}
                  {visibleJurisdictions.map((item) => (
                    <Link className={`public-row ${jurisdictionFilter === item.id ? 'active' : ''}`} href={`/entidades/${item.slug}`} key={item.id}>
                      <span className="public-row-main"><span className="public-row-icon">⌂</span><span><strong>{item.name}</strong><small>{item.current_ordinary_name ?? 'Sin ordinario registrado'}</small></span></span>
                      <span className="public-type">{item.entity_type_name ?? 'Jurisdicción'}</span>
                      <span className="public-link">Ver ficha →</span>
                    </Link>
                  ))}
                  <div className="public-list-footer"><Link className="public-link" href="/diocesis">Ver todas las jurisdicciones →</Link></div>
                </div>
              </article>
            </section>
          </>
        )}

        {activeView === 'clero' && (
          <section className="public-directory-card public-panel">
            <div className="public-section-title">
              <p className="eyebrow">{activeViewMeta.eyebrow}</p>
              <h2>{activeViewMeta.title}</h2>
              <p>{activeViewMeta.description}</p>
            </div>
            <section className="public-metrics-grid" aria-label="Resumen de personas">
              <MetricCard icon="♙" label="Obispos" value={loading ? '—' : peopleSummary?.bishops ?? people.filter((item) => item.person_type === 'bishop').length} detail="Ordinarios, auxiliares y eméritos" onClick={() => setPersonTypeFilter('bishop')} active={personTypeFilter === 'bishop'} />
              <MetricCard icon="✛" label="Presbíteros" value={loading ? '—' : peopleSummary?.priests ?? people.filter((item) => item.person_type === 'priest').length} detail="Clero presbiteral" onClick={() => setPersonTypeFilter('priest')} active={personTypeFilter === 'priest'} />
              <MetricCard icon="◇" label="Diáconos" value={loading ? '—' : peopleSummary?.deacons ?? people.filter((item) => item.person_type === 'deacon').length} detail="Ministerio diaconal" onClick={() => setPersonTypeFilter('deacon')} active={personTypeFilter === 'deacon'} />
              <MetricCard icon="☧" label="Vida consagrada" value={loading ? '—' : peopleSummary?.religious ?? people.filter((item) => item.person_type === 'religious').length} detail="Religiosos y religiosas" onClick={() => setPersonTypeFilter('religious')} active={personTypeFilter === 'religious'} />
              <MetricCard icon="♧" label="Laicos/as" value={loading ? '—' : peopleSummary?.laypeople ?? people.filter((item) => item.person_type === 'layperson').length} detail="Agentes con responsabilidad" onClick={() => setPersonTypeFilter('layperson')} active={personTypeFilter === 'layperson'} />
              <MetricCard icon="◎" label="Activos" value={loading ? '—' : peopleSummary?.active ?? people.filter((item) => item.status === 'active' && !item.death_date).length} detail="Registros públicos vigentes" />
            </section>
            <div className="public-directory-grid">
              {visiblePeople.length === 0 && <EmptyViewNote title="Sin personas" detail="No hay personas públicas para mostrar con el filtro actual." />}
              {visiblePeople.map((item) => <Link className="public-directory-item" href={`/personas/${item.slug}`} key={item.id}><strong>{item.display_name}</strong><span>{personTypeLabel(item.person_type)} · {statusLabel(item)}</span><span className="public-link">Ver ficha →</span></Link>)}
            </div>
          </section>
        )}

        {activeView === 'pastoral' && (
          <section className="public-directory-card public-panel">
            <div className="public-section-title"><p className="eyebrow">{activeViewMeta.eyebrow}</p><h2>{activeViewMeta.title}</h2><p>{activeViewMeta.description}</p></div>
            <section className="public-metrics-grid" aria-label="Resumen pastoral">
              {pastoralLevels.length === 0 && <MetricCard icon="⌂" label="Estructura pastoral" value={formatNumber(registeredParishes)} detail="Parroquias registradas en BD" />}
              {pastoralLevels.slice(0, 6).map((level) => <MetricCard key={level.name} icon="✝" label={level.name} value={level.count} detail="Nivel publicado" onClick={() => setPastoralLevelFilter(level.name)} active={pastoralLevelFilter === level.name} />)}
            </section>
            {filteredPastoral.length === 0 ? <EmptyViewNote title="Vista pastoral en preparación" detail="La estructura flexible ya existe; falta publicar nodos pastorales suficientes para esta vista." /> : <div className="public-directory-grid">{filteredPastoral.slice(0, 16).map((item) => <Link className="public-directory-item" href={item.linked_entity_slug ? `/entidades/${item.linked_entity_slug}` : `/pastoral/${item.slug}`} key={item.id}><strong>{item.name}</strong><span>{item.level_name ?? 'Nivel pastoral'} · {item.diocese_name ?? 'Sin jurisdicción'}</span></Link>)}</div>}
          </section>
        )}

        {activeView === 'administrativa' && (
          <section className="public-directory-card public-panel">
            <div className="public-section-title"><p className="eyebrow">{activeViewMeta.eyebrow}</p><h2>{activeViewMeta.title}</h2><p>{activeViewMeta.description}</p></div>
            <section className="public-metrics-grid" aria-label="Resumen administrativo">
              <MetricCard icon="▣" label="Organigramas" value={organizationCharts.length} detail="Cartas organizativas públicas" />
              <MetricCard icon="▤" label="Unidades" value={administrativeUnits.length} detail="Curia, oficinas y departamentos" />
              <MetricCard icon="⌂" label="Dependencias superiores" value={administrativeUnits.filter((item) => !item.parent_unit_id).length} detail="Primer nivel administrativo" />
            </section>
            {administrativeUnits.length === 0 ? <EmptyViewNote title="Vista administrativa en preparación" detail="No hay unidades administrativas públicas todavía. Cuando se publiquen, responderán a los filtros del encabezado." /> : <div className="public-directory-grid">{administrativeUnits.slice(0, 16).map((item) => <Link className="public-directory-item" href={`/oficinas/${item.id}`} key={item.id}><strong>{item.name}</strong><span>{item.description ?? 'Unidad administrativa'}</span></Link>)}</div>}
          </section>
        )}

        {activeView === 'colegial' && (
          <section className="public-directory-card public-panel">
            <div className="public-section-title"><p className="eyebrow">{activeViewMeta.eyebrow}</p><h2>{activeViewMeta.title}</h2><p>{activeViewMeta.description}</p></div>
            <section className="public-metrics-grid" aria-label="Resumen colegial">
              <MetricCard icon="♧" label="Organismos colegiales" value={collegialUnits.length} detail="Consejos, comisiones y comités" />
              <MetricCard icon="▣" label="Órganos superiores" value={collegialUnits.filter((item) => !item.parent_unit_id).length} detail="Primer nivel colegial" />
            </section>
            {collegialUnits.length === 0 ? <EmptyViewNote title="Vista colegial en preparación" detail="No hay organismos colegiales públicos todavía. Esta vista queda separada para consejos, comisiones, comités y equipos transversales." /> : <div className="public-directory-grid">{collegialUnits.slice(0, 16).map((item) => <Link className="public-directory-item" href={`/organismos/${item.id}`} key={item.id}><strong>{item.name}</strong><span>{item.description ?? 'Organismo colegial'}</span></Link>)}</div>}
          </section>
        )}
      </div>

      <nav className="public-bottom-nav" aria-label="Navegación móvil">
        {bottomNav.map((item) => <Link className={item.active ? 'active' : ''} href={item.href} key={item.label}><span>{item.icon}</span><span>{item.label}</span></Link>)}
      </nav>
    </main>
  )
}
