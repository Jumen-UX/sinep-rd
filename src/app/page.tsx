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

const publicViews: Array<{ key: PublicView; title: string; eyebrow: string; description: string }> = [
  { key: 'territorial', title: 'Vista territorial', eyebrow: 'Territorio', description: 'País, provincias eclesiásticas, arquidiócesis, diócesis y jurisdicciones personales.' },
  { key: 'clero', title: 'Clero y agentes', eyebrow: 'Personas', description: 'Obispos, presbíteros, diáconos, vida consagrada y laicos con responsabilidad.' },
  { key: 'pastoral', title: 'Organización pastoral', eyebrow: 'Pastoral', description: 'Vicarías, zonas pastorales, parroquias, sectores, capillas y comunidades.' },
  { key: 'administrativa', title: 'Organización administrativa', eyebrow: 'Administración', description: 'Curia, oficinas, departamentos, servicios y dependencias internas.' },
  { key: 'colegial', title: 'Organización colegial', eyebrow: 'Colegial', description: 'Consejos, comisiones, comités, organismos colegiados y equipos transversales.' },
]

const personTypes = [
  { key: '', label: 'Todas las personas' },
  { key: 'bishop', label: 'Obispos' },
  { key: 'priest', label: 'Presbíteros' },
  { key: 'deacon', label: 'Diáconos' },
  { key: 'religious', label: 'Religiosos/as' },
  { key: 'layperson', label: 'Laicos/as' },
]

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('es-DO').format(value)
}

function normalizeText(value?: string | null) {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
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

function MetricButton({ label, value, detail, onClick, active }: { label: string; value: string | number; detail: string; onClick?: () => void; active?: boolean }) {
  const content = <><span>{label}</span><strong>{value}</strong><small>{detail}</small></>
  if (!onClick) return <div className="home-metric-card">{content}</div>
  return <button className={`home-metric-card home-filter-card ${active ? 'active' : ''}`} onClick={onClick} type="button">{content}</button>
}

function EmptyViewNote({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state public-view-empty"><strong>{title}</strong><span>{detail}</span></div>
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

  const diocesesByProvince = useMemo(() => {
    return provinceFilter ? dioceses.filter((item) => item.ecclesiastical_province_name === provinceFilter) : dioceses
  }, [dioceses, provinceFilter])

  const selectedJurisdiction = dioceses.find((item) => item.id === jurisdictionFilter) ?? null
  const scopedDioceses = jurisdictionFilter ? dioceses.filter((item) => item.id === jurisdictionFilter) : diocesesByProvince

  const filteredPeople = people.filter((item) => !personTypeFilter || item.person_type === personTypeFilter)
  const visiblePeople = filteredPeople.slice(0, 10)

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
  }

  function selectProvince(name: string) {
    setProvinceFilter(name)
    setJurisdictionFilter('')
    setActiveView('territorial')
  }

  function selectJurisdiction(id: string) {
    setJurisdictionFilter(id)
  }

  const peopleSummary = summary?.people
  const diocesesSummary = summary?.dioceses
  const reportedParishes = dioceses.reduce((sum, item) => sum + (item.parishes_count ?? 0), 0)

  return (
    <main className="container dashboard-page home-dashboard public-views-dashboard">
      <section className="home-hero-panel card">
        <div className="home-hero-copy">
          <p className="eyebrow">Consulta pública</p>
          <h1>SINEP RD</h1>
          <p className="lead">Navega la información eclesiástica por vistas: territorio, clero y agentes, organización pastoral, administración y organismos colegiales.</p>
          <div className="home-hero-actions">
            <button className="button button-primary" onClick={() => resetTerritory('territorial')} type="button">Vista territorial</button>
            <button className="button button-secondary" onClick={() => setActiveView('clero')} type="button">Clero y agentes</button>
            <button className="button button-secondary" onClick={() => setActiveView('pastoral')} type="button">Organización pastoral</button>
          </div>
        </div>
        <aside className="home-context-card" aria-label="Filtros jerárquicos">
          <p className="eyebrow">Filtro jerárquico</p>
          <h2>Del país a la ficha</h2>
          <div className="home-hierarchy-path" aria-label="Ruta de navegación">
            <span>País</span><span>Provincia eclesiástica</span><span>Jurisdicción</span><span>Vista especializada</span><span>Ficha</span>
          </div>
          <p className="meta">Al seleccionar una ficha, la vista baja de nivel y filtra lo que depende de ese ámbito.</p>
        </aside>
      </section>

      <section className="card dashboard-section public-filter-panel">
        <div className="section-heading">
          <div><p className="eyebrow">Encabezado de filtros</p><h2>Ámbito de consulta</h2></div>
          <button className="button button-secondary" onClick={() => resetTerritory()} type="button">Limpiar filtros</button>
        </div>
        <div className="public-filter-grid">
          <label>País<select value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}>{countries.map((country) => <option key={country.key} value={country.key}>{country.name}</option>)}</select></label>
          <label>Provincia eclesiástica<select value={provinceFilter} onChange={(event) => { setProvinceFilter(event.target.value); setJurisdictionFilter('') }}><option value="">Todas las provincias</option>{provinces.map((province) => <option key={province.name} value={province.name}>{province.name} · {province.count}</option>)}</select></label>
          <label>Jurisdicción<select value={jurisdictionFilter} onChange={(event) => setJurisdictionFilter(event.target.value)}><option value="">Todas las jurisdicciones</option>{diocesesByProvince.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          {activeView === 'clero' && <label>Tipo de persona<select value={personTypeFilter} onChange={(event) => setPersonTypeFilter(event.target.value)}>{personTypes.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}</select></label>}
          {activeView === 'pastoral' && <label>Nivel pastoral<select value={pastoralLevelFilter} onChange={(event) => setPastoralLevelFilter(event.target.value)}><option value="">Todos los niveles</option>{pastoralLevels.map((level) => <option key={level.name} value={level.name}>{level.name} · {level.count}</option>)}</select></label>}
          {!['clero', 'pastoral'].includes(activeView) && <label>Vista activa<select value={activeView} onChange={(event) => setActiveView(event.target.value as PublicView)}>{publicViews.map((view) => <option key={view.key} value={view.key}>{view.title}</option>)}</select></label>}
        </div>
      </section>

      <section className="public-view-tabs" aria-label="Vistas públicas">
        {publicViews.map((view) => <button className={`public-view-tab ${activeView === view.key ? 'active' : ''}`} key={view.key} onClick={() => setActiveView(view.key)} type="button"><span>{view.eyebrow}</span><strong>{view.title}</strong><small>{view.description}</small></button>)}
      </section>

      {activeView === 'territorial' && (
        <section className="public-view-stack">
          <section className="home-metric-strip" aria-label="Resumen territorial">
            <MetricButton label="País" value={countryFilter === 'DO' ? 1 : 0} detail="República Dominicana" onClick={() => resetTerritory('territorial')} />
            <MetricButton label="Provincias eclesiásticas" value={loading ? '—' : provinces.length} detail="Selecciona una para filtrar" active={!!provinceFilter} />
            <MetricButton label="Arquidiócesis" value={loading ? '—' : scopedDioceses.filter(isArchdiocese).length} detail="Sedes metropolitanas o arquidiocesanas" onClick={() => setActiveView('territorial')} />
            <MetricButton label="Diócesis" value={loading ? '—' : scopedDioceses.filter(isDiocese).length} detail="Jurisdicciones diocesanas" />
            <MetricButton label="Ordinariatos" value={loading ? '—' : scopedDioceses.filter(isMilitary).length} detail="Jurisdicciones personales o militares" />
            <MetricButton label="Parroquias reportadas" value={loading ? '—' : formatNumber(reportedParishes)} detail="Dato estadístico agregado" />
          </section>

          <section className="dashboard-grid two-panel-grid">
            <article className="card dashboard-section">
              <div className="section-heading"><div><p className="eyebrow">Provincias eclesiásticas</p><h2>Selecciona una provincia</h2></div></div>
              <div className="home-province-grid">
                {provinces.length === 0 && <EmptyViewNote title="Sin provincias" detail="Todavía no hay provincias eclesiásticas publicadas." />}
                {provinces.map((province) => <button className={`home-province-card public-card-button ${provinceFilter === province.name ? 'active' : ''}`} key={province.name} onClick={() => selectProvince(province.name)} type="button"><strong>{province.name}</strong><span>{province.count} jurisdicciones</span></button>)}
              </div>
            </article>
            <article className="card dashboard-section">
              <div className="section-heading"><div><p className="eyebrow">Jurisdicciones</p><h2>{scopedDioceses.length} resultados</h2></div></div>
              <div className="list-table compact-list-table">
                {scopedDioceses.length === 0 && <div className="home-empty-row">No hay jurisdicciones para mostrar.</div>}
                {scopedDioceses.map((item) => <button className={`list-row public-list-button ${jurisdictionFilter === item.id ? 'active' : ''}`} key={item.id} onClick={() => selectJurisdiction(item.id)} type="button"><span><strong>{item.name}</strong><small>{item.entity_type_name ?? 'Jurisdicción'}</small></span><span>{item.current_ordinary_title ?? 'Sin cargo registrado'}</span><span>{item.current_ordinary_name ?? 'Sin ordinario registrado'}</span></button>)}
              </div>
            </article>
          </section>
        </section>
      )}

      {activeView === 'clero' && (
        <section className="public-view-stack">
          <section className="home-metric-strip" aria-label="Resumen de personas">
            <MetricButton label="Obispos" value={loading ? '—' : peopleSummary?.bishops ?? people.filter((item) => item.person_type === 'bishop').length} detail="Ordinarios, auxiliares y eméritos" onClick={() => setPersonTypeFilter('bishop')} active={personTypeFilter === 'bishop'} />
            <MetricButton label="Presbíteros" value={loading ? '—' : peopleSummary?.priests ?? people.filter((item) => item.person_type === 'priest').length} detail="Clero presbiteral" onClick={() => setPersonTypeFilter('priest')} active={personTypeFilter === 'priest'} />
            <MetricButton label="Diáconos" value={loading ? '—' : peopleSummary?.deacons ?? people.filter((item) => item.person_type === 'deacon').length} detail="Ministerio diaconal" onClick={() => setPersonTypeFilter('deacon')} active={personTypeFilter === 'deacon'} />
            <MetricButton label="Vida consagrada" value={loading ? '—' : peopleSummary?.religious ?? people.filter((item) => item.person_type === 'religious').length} detail="Religiosos y religiosas" onClick={() => setPersonTypeFilter('religious')} active={personTypeFilter === 'religious'} />
            <MetricButton label="Laicos/as" value={loading ? '—' : peopleSummary?.laypeople ?? people.filter((item) => item.person_type === 'layperson').length} detail="Agentes con responsabilidad" onClick={() => setPersonTypeFilter('layperson')} active={personTypeFilter === 'layperson'} />
          </section>
          <section className="card dashboard-section">
            <div className="section-heading"><div><p className="eyebrow">Clero y agentes</p><h2>{filteredPeople.length} personas</h2><p className="meta">El filtro territorial queda preparado; la relación por jurisdicción dependerá de publicar nombramientos/servicios vigentes.</p></div><Link className="inline-link" href={`/personas${personTypeFilter ? `?tipo=${personTypeFilter}` : ''}`}>Abrir directorio</Link></div>
            <div className="list-table compact-list-table">
              {visiblePeople.length === 0 && <div className="home-empty-row">No hay personas para mostrar.</div>}
              {visiblePeople.map((item) => <Link className="list-row" href={`/personas/${item.slug}`} key={item.id}><span><strong>{item.display_name}</strong><small>{personTypeLabel(item.person_type)}</small></span><span>{statusLabel(item)}</span><span>Ver ficha →</span></Link>)}
            </div>
          </section>
        </section>
      )}

      {activeView === 'pastoral' && (
        <section className="public-view-stack">
          <section className="home-metric-strip" aria-label="Resumen pastoral">
            {pastoralLevels.length === 0 && <MetricButton label="Estructura pastoral" value={formatNumber(diocesesSummary?.loaded_parishes)} detail="Parroquias cargadas como base pública" />}
            {pastoralLevels.slice(0, 6).map((level) => <MetricButton key={level.name} label={level.name} value={level.count} detail="Nivel publicado" onClick={() => setPastoralLevelFilter(level.name)} active={pastoralLevelFilter === level.name} />)}
          </section>
          <section className="card dashboard-section">
            <div className="section-heading"><div><p className="eyebrow">Organización pastoral</p><h2>{filteredPastoral.length} registros</h2></div></div>
            {filteredPastoral.length === 0 ? <EmptyViewNote title="Vista pastoral en preparación" detail="La estructura flexible ya existe; falta publicar nodos pastorales suficientes para esta vista." /> : <div className="home-province-grid">{filteredPastoral.slice(0, 16).map((item) => <Link className="home-province-card" href={`/pastoral/${item.slug}`} key={item.id}><strong>{item.name}</strong><span>{item.level_name ?? 'Nivel pastoral'} · {item.diocese_name ?? 'Sin jurisdicción'}</span></Link>)}</div>}
          </section>
        </section>
      )}

      {activeView === 'administrativa' && (
        <section className="public-view-stack">
          <section className="home-metric-strip" aria-label="Resumen administrativo">
            <MetricButton label="Organigramas" value={organizationCharts.length} detail="Cartas organizativas públicas" />
            <MetricButton label="Unidades" value={administrativeUnits.length} detail="Curia, oficinas y departamentos" />
            <MetricButton label="Dependencias superiores" value={administrativeUnits.filter((item) => !item.parent_unit_id).length} detail="Primer nivel administrativo" />
          </section>
          <section className="card dashboard-section">
            <div className="section-heading"><div><p className="eyebrow">Organización administrativa</p><h2>Curia, oficinas y departamentos</h2></div></div>
            {administrativeUnits.length === 0 ? <EmptyViewNote title="Vista administrativa en preparación" detail="No hay unidades administrativas públicas todavía. Cuando se publiquen, responderán a los filtros del encabezado." /> : <div className="home-province-grid">{administrativeUnits.slice(0, 16).map((item) => <article className="home-province-card" key={item.id}><strong>{item.name}</strong><span>{item.description ?? 'Unidad administrativa'}</span></article>)}</div>}
          </section>
        </section>
      )}

      {activeView === 'colegial' && (
        <section className="public-view-stack">
          <section className="home-metric-strip" aria-label="Resumen colegial">
            <MetricButton label="Organismos colegiales" value={collegialUnits.length} detail="Consejos, comisiones y comités" />
            <MetricButton label="Órganos superiores" value={collegialUnits.filter((item) => !item.parent_unit_id).length} detail="Primer nivel colegial" />
          </section>
          <section className="card dashboard-section">
            <div className="section-heading"><div><p className="eyebrow">Organización colegial</p><h2>Consejos, comisiones y organismos</h2></div></div>
            {collegialUnits.length === 0 ? <EmptyViewNote title="Vista colegial en preparación" detail="No hay organismos colegiales públicos todavía. Esta vista queda separada para consejos, comisiones, comités y equipos transversales." /> : <div className="home-province-grid">{collegialUnits.slice(0, 16).map((item) => <article className="home-province-card" key={item.id}><strong>{item.name}</strong><span>{item.description ?? 'Organismo colegial'}</span></article>)}</div>}
          </section>
        </section>
      )}
    </main>
  )
}
