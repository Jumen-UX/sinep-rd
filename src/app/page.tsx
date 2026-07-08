'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import Link from 'next/link'

type PublicView = 'territorial' | 'clero' | 'pastoral' | 'administrativa' | 'colegial'
type TerritoryMode = 'country' | 'province' | 'jurisdiction' | 'special'

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

type Parish = { id: string; diocese_id: string | null; diocese_name: string | null; diocese_slug: string | null }
type Person = { id: string; display_name: string; slug: string; person_type: string | null; status: string | null; death_date: string | null }

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
  parishes: Parish[]
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

type ViewMeta = { key: PublicView; title: string; shortTitle: string; eyebrow: string; icon: string; description: string }
type SelectOption = { value: string; label: string }
type PastoralLevelGroup = { name: string; count: number; order: number; items: PastoralEntity[] }

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

const priestRoleRows = [
  { label: 'Párrocos', value: '—' },
  { label: 'Vicarios parroquiales', value: '—' },
  { label: 'Sacerdotes adscritos', value: '—' },
  { label: 'Otros ministerios sacerdotales', value: '—' },
]

const publicViewKeys = new Set<PublicView>(publicViews.map((view) => view.key))

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
  return value ? (labels[value] ?? value) : 'Persona'
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

function isSpecialJurisdiction(item: Diocese) {
  const label = normalizeText(`${item.entity_type_name ?? ''} ${item.name}`)
  return label.includes('ordinariato') || label.includes('militar') || label.includes('castrense') || label.includes('personal')
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
      <span className="public-metric-icon" aria-hidden="true">{icon}</span>
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

function JurisdictionRow({ item, active }: { item: Diocese; active?: boolean }) {
  return (
    <Link className={`public-row ${active ? 'active' : ''}`} href={`/entidades/${item.slug}`}>
      <span className="public-row-main">
        <span className="public-row-icon" aria-hidden="true">{isSpecialJurisdiction(item) ? '盾' : '⌂'}</span>
        <span>
          <strong>{item.name}</strong>
          <small>{item.current_ordinary_name ?? 'Sin ordinario registrado'}</small>
        </span>
      </span>
      <span className="public-type">{item.entity_type_name ?? 'Jurisdicción'}</span>
      <span className="public-link">Ver ficha →</span>
    </Link>
  )
}

function OrdinaryItem({ item }: { item: Diocese }) {
  return (
    <Link className="public-directory-item" href={`/entidades/${item.slug}`}>
      <strong>{item.current_ordinary_name ?? 'Ordinario no registrado'}</strong>
      <span>{item.current_ordinary_title ?? 'Ordinario'} · {item.name}</span>
      <span className="public-link">Ver jurisdicción →</span>
    </Link>
  )
}

function SearchableSelect({ label, value, options, onChange, emptyMessage = 'Sin resultados' }: { label: string; value: string; options: SelectOption[]; onChange: (value: string) => void; emptyMessage?: string }) {
  const selectedOption = options.find((option) => option.value === value)
  const listboxId = useId()
  const [query, setQuery] = useState(selectedOption?.label ?? '')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setQuery(selectedOption?.label ?? '')
  }, [selectedOption?.label])

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeText(query.trim())
    if (!normalizedQuery) return options.slice(0, 60)
    return options.filter((option) => normalizeText(option.label).includes(normalizedQuery)).slice(0, 60)
  }, [options, query])

  function commitSelection(option: SelectOption) {
    onChange(option.value)
    setQuery(option.label)
    setOpen(false)
  }

  return (
    <label>
      {label}
      <span className="public-combobox">
        <input
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-haspopup="listbox"
          autoComplete="off"
          className="public-combobox-input"
          onBlur={() => window.setTimeout(() => { setOpen(false); setQuery(selectedOption?.label ?? '') }, 120)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true) }}
          onFocus={() => { setQuery(''); setOpen(true) }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setQuery('')
              setOpen(true)
            }
            if (event.key === 'Enter' && filteredOptions[0]) {
              event.preventDefault()
              commitSelection(filteredOptions[0])
            }
            if (event.key === 'Escape') {
              setOpen(false)
              setQuery(selectedOption?.label ?? '')
            }
          }}
          placeholder={selectedOption?.label ?? `Buscar ${label.toLowerCase()}`}
          role="combobox"
          value={query}
        />
        <button
          aria-expanded={open}
          aria-label={`Abrir opciones de ${label}`}
          className="public-combobox-toggle"
          onMouseDown={(event) => {
            event.preventDefault()
            if (!open) setQuery('')
            setOpen((current) => !current)
          }}
          type="button"
        >⌄</button>
        {open && (
          <div className="public-combobox-list" id={listboxId} role="listbox">
            {filteredOptions.length === 0 && <div className="public-combobox-empty">{emptyMessage}</div>}
            {filteredOptions.map((option) => (
              <button
                aria-selected={option.value === value}
                className={`public-combobox-option ${option.value === value ? 'active' : ''}`}
                key={`${label}-${option.value || 'all'}`}
                onMouseDown={(event) => { event.preventDefault(); commitSelection(option) }}
                role="option"
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </span>
    </label>
  )
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
  const parishes = data?.parishes ?? []
  const people = data?.people ?? []
  const pastoralEntities = data?.pastoral_entities ?? []
  const organizationCharts = data?.organization_charts ?? []
  const organizationUnits = data?.organization_units ?? []
  const countryDioceses = countryFilter === 'DO' ? dioceses : []

  const provinces = useMemo(() => {
    const source = countryFilter === 'DO' ? dioceses.filter((item) => !isSpecialJurisdiction(item)) : []
    const grouped = groupBy(source.filter((item) => item.ecclesiastical_province_name), (item) => item.ecclesiastical_province_name ?? '')
    return Array.from(grouped, ([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [countryFilter, dioceses])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const province = params.get('provincia')
    if (!province || provinces.length === 0) return
    const match = provinces.find((item) => item.name === province || slugify(item.name) === province)
    if (match) setProvinceFilter(match.name)
  }, [provinces])

  const diocesesByProvince = useMemo(() => {
    return provinceFilter ? countryDioceses.filter((item) => item.ecclesiastical_province_name === provinceFilter) : countryDioceses
  }, [countryDioceses, provinceFilter])

  const selectedJurisdiction = countryDioceses.find((item) => item.id === jurisdictionFilter) ?? null
  const selectedJurisdictionIsSpecial = selectedJurisdiction ? isSpecialJurisdiction(selectedJurisdiction) : false
  const scopedDioceses = jurisdictionFilter ? countryDioceses.filter((item) => item.id === jurisdictionFilter) : diocesesByProvince
  const scopedTerritorialJurisdictions = scopedDioceses.filter((item) => !isSpecialJurisdiction(item))
  const scopedSpecialJurisdictions = scopedDioceses.filter(isSpecialJurisdiction)
  const countryTerritorialJurisdictions = countryDioceses.filter((item) => !isSpecialJurisdiction(item))
  const countrySpecialJurisdictions = countryDioceses.filter(isSpecialJurisdiction)
  const visibleTerritorialJurisdictions = scopedTerritorialJurisdictions.slice(0, 6)
  const visibleSpecialJurisdictions = scopedSpecialJurisdictions.slice(0, 3)
  const scopedDioceseIds = new Set(scopedDioceses.map((item) => item.id))
  const scopedDioceseSlugs = new Set(scopedDioceses.map((item) => item.slug))
  const scopeIsFiltered = !!provinceFilter || !!jurisdictionFilter || countryFilter !== 'DO'
  const selectedCountryName = countries.find((country) => country.key === countryFilter)?.name
  const scopeFallbackTitle = provinceFilter || selectedCountryName || 'Ámbito seleccionado'
  const scopeTitle = selectedJurisdiction?.name ?? scopeFallbackTitle
  const territoryMode: TerritoryMode = selectedJurisdiction ? (selectedJurisdictionIsSpecial ? 'special' : 'jurisdiction') : provinceFilter ? 'province' : 'country'

  const displayedProvinces = provinces
    .filter((province) => {
      if (provinceFilter) return province.name === provinceFilter
      if (selectedJurisdiction) return !!selectedJurisdiction.ecclesiastical_province_name && province.name === selectedJurisdiction.ecclesiastical_province_name
      return true
    })
    .map((province) => ({
      name: province.name,
      count: scopeIsFiltered ? scopedTerritorialJurisdictions.filter((item) => item.ecclesiastical_province_name === province.name).length : province.count,
    }))

  const scopedParishes = parishes.filter((parish) => {
    if (countryFilter !== 'DO') return false
    if (!scopeIsFiltered) return true
    return (!!parish.diocese_id && scopedDioceseIds.has(parish.diocese_id)) || (!!parish.diocese_slug && scopedDioceseSlugs.has(parish.diocese_slug))
  })

  const filteredPeople = people.filter((item) => !personTypeFilter || item.person_type === personTypeFilter)
  const visiblePeople = filteredPeople.slice(0, 12)

  const scopedPastoralEntities = pastoralEntities.filter((item) => {
    if (countryFilter !== 'DO') return false
    if (!scopeIsFiltered) return true
    return (!!item.diocese_id && scopedDioceseIds.has(item.diocese_id)) || (!!item.diocese_slug && scopedDioceseSlugs.has(item.diocese_slug))
  })

  const pastoralLevelGroups = useMemo(() => {
    const groups = new Map<string, PastoralLevelGroup>()
    for (const item of scopedPastoralEntities) {
      const name = item.level_name ?? 'Sin nivel'
      const current = groups.get(name) ?? { name, count: 0, order: item.level_order ?? 999, items: [] }
      current.count += 1
      current.order = Math.min(current.order, item.level_order ?? 999)
      current.items.push(item)
      groups.set(name, current)
    }
    return Array.from(groups.values()).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'))
  }, [scopedPastoralEntities])

  const pastoralLevels = pastoralLevelGroups.map(({ name, count }) => ({ name, count }))
  const nextPastoralLevels = pastoralLevelGroups.slice(0, 2)
  const firstPastoralLevel = nextPastoralLevels[0]
  const secondPastoralLevel = nextPastoralLevels[1]
  const filteredPastoral = scopedPastoralEntities.filter((item) => !pastoralLevelFilter || item.level_name === pastoralLevelFilter)
  const administrativeUnits = organizationUnits.filter((item) => !/(consejo|comision|comisión|comite|comité|colegio|equipo)/i.test(item.name))
  const collegialUnits = organizationUnits.filter((item) => /(consejo|comision|comisión|comite|comité|colegio|equipo)/i.test(item.name))

  const countryOptions = countries.map((country) => ({ value: country.key, label: country.name }))
  const provinceOptions = [{ value: '', label: 'Todas las provincias' }, ...provinces.map((province) => ({ value: province.name, label: province.name }))]
  const jurisdictionOptions = [{ value: '', label: 'Todas las jurisdicciones' }, ...diocesesByProvince.map((item) => ({ value: item.id, label: item.name }))]
  const viewOptions = publicViews.map((view) => ({ value: view.key, label: view.title }))

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
  const registeredParishes = countryFilter === 'DO' ? scopedParishes.length : 0
  const archdioceseCount = scopedTerritorialJurisdictions.filter(isArchdiocese).length
  const dioceseCount = scopedTerritorialJurisdictions.filter(isDiocese).length
  const ordinaryCount = scopedTerritorialJurisdictions.filter((item) => item.current_ordinary_name).length
  const selectedOrdinaryCount = selectedJurisdiction?.current_ordinary_name ? 1 : 0
  const scopedPriestCount = selectedJurisdiction ? '—' : (peopleSummary?.priests ?? people.filter((item) => item.person_type === 'priest').length)
  const activeViewMeta = publicViews.find((view) => view.key === activeView) ?? publicViews[0]

  return (
    <div className="public-dashboard-layout">
      <a className="skip-link" href="#contenido-principal">Saltar al contenido principal</a>

      <header className="public-mobile-header">
        <Link className="public-mobile-brand" href="/" aria-label="Ir al inicio de SINEP RD">
          <span className="public-brand-mark" aria-hidden="true">✛</span>
          <span>
            <span className="public-brand-title">SINEP RD</span>
            <span className="public-brand-subtitle">Sistema de Información<br />Eclesial Pastoral</span>
          </span>
        </Link>
        <Link className="public-mobile-icon-button" href="/admin/login" aria-label="Iniciar sesión">◎</Link>
        <button className="public-mobile-menu-button" type="button" aria-controls="menu-principal" aria-expanded="false" aria-label="Abrir menú principal">☰</button>
      </header>

      <aside className="public-sidebar" aria-label="Menú principal">
        <Link className="public-sidebar-brand" href="/" aria-label="Ir al inicio de SINEP RD">
          <span className="public-brand-mark" aria-hidden="true">✛</span>
          <span>
            <span className="public-brand-title">SINEP RD</span>
            <span className="public-brand-subtitle">Sistema de Información<br />Eclesial Pastoral</span>
          </span>
        </Link>

        <nav className="public-sidebar-nav" id="menu-principal" aria-label="Navegación principal">
          {sideNav.map((item) => (
            <Link aria-current={item.active ? 'page' : undefined} className={`public-sidebar-link ${item.active ? 'active' : ''}`} href={item.href} key={item.label}>
              <span aria-hidden="true">{item.icon}</span>
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

      <main className="public-main" id="contenido-principal" tabIndex={-1}>
        <div className="public-topbar">
          <Link className="public-user-button" href="/admin/login" aria-label="Iniciar sesión">◎</Link>
        </div>

        <section className="public-panel public-filter-panel" aria-labelledby="ambito-consulta-title">
          <div className="public-panel-title">
            <div className="public-heading-accent"><h1 id="ambito-consulta-title">Ámbito de consulta</h1></div>
            <button className="public-clear-button" onClick={() => resetTerritory()} type="button">↻ Limpiar filtros</button>
          </div>

          <div className="public-filter-grid">
            <SearchableSelect label="País" value={countryFilter} options={countryOptions} onChange={(nextCountry) => { setCountryFilter(nextCountry); setProvinceFilter(''); setJurisdictionFilter('') }} />
            <SearchableSelect label="Provincia eclesiástica" value={provinceFilter} options={provinceOptions} onChange={(nextProvince) => { setProvinceFilter(nextProvince); setJurisdictionFilter('') }} />
            <SearchableSelect label="Jurisdicción" value={jurisdictionFilter} options={jurisdictionOptions} onChange={setJurisdictionFilter} />
            <SearchableSelect label="Vista activa" value={activeView} options={viewOptions} onChange={(nextView) => setActiveView(nextView as PublicView)} />
          </div>
        </section>

        <section className="public-tabs" role="tablist" aria-label="Vistas públicas">
          {publicViews.map((view) => (
            <button
              aria-controls={`panel-${view.key}`}
              aria-selected={activeView === view.key}
              className={`public-tab ${activeView === view.key ? 'active' : ''}`}
              id={`tab-${view.key}`}
              key={view.key}
              onClick={() => setActiveView(view.key)}
              role="tab"
              type="button"
            >
              <span aria-hidden="true">{view.icon}</span>
              <span>{view.shortTitle}</span>
            </button>
          ))}
        </section>

        {activeView === 'territorial' && (
          <section id="panel-territorial" role="tabpanel" aria-labelledby="tab-territorial">
            <section className="public-panel public-scope-card" aria-live="polite">
              <span className="public-country-mark" aria-hidden="true">▰</span>
              <div>
                <h2>{scopeTitle}</h2>
                <div className="public-scope-summary">
                  {territoryMode === 'country' && <span>{loading ? '—' : displayedProvinces.length} provincias eclesiásticas</span>}
                  {territoryMode === 'country' && <span>{loading ? '—' : countryTerritorialJurisdictions.length} jurisdicciones territoriales</span>}
                  {territoryMode === 'country' && <span>{loading ? '—' : countrySpecialJurisdictions.length} jurisdicción especial</span>}
                  {territoryMode === 'province' && <span>{loading ? '—' : archdioceseCount} arquidiócesis</span>}
                  {territoryMode === 'province' && <span>{loading ? '—' : dioceseCount} diócesis</span>}
                  {territoryMode === 'province' && <span>{loading ? '—' : scopedTerritorialJurisdictions.length} jurisdicciones</span>}
                  {territoryMode === 'province' && <span>{loading ? '—' : ordinaryCount} obispos / ordinarios</span>}
                  {territoryMode === 'jurisdiction' && <span>{loading ? '—' : selectedOrdinaryCount} obispo / ordinario</span>}
                  {territoryMode === 'jurisdiction' && <span>{loading ? '—' : scopedPriestCount} sacerdotes</span>}
                  {territoryMode === 'jurisdiction' && <span>{loading ? '—' : nextPastoralLevels.length} niveles territoriales</span>}
                  {territoryMode === 'special' && <span>Jurisdicción especial</span>}
                  {territoryMode === 'special' && <span>Provincia eclesiástica: No aplica</span>}
                  <span>{loading ? '—' : formatNumber(registeredParishes)} parroquias</span>
                </div>
              </div>
            </section>

            {territoryMode === 'country' && (
              <section className="public-metrics-grid" aria-label="Resumen territorial nacional">
                <MetricCard icon="◎" label="País" value={countryFilter === 'DO' ? 1 : 0} detail={selectedCountryName ?? 'Sin país'} onClick={() => resetTerritory('territorial')} />
                <MetricCard icon="▥" label="Provincias eclesiásticas" value={loading ? '—' : displayedProvinces.length} detail="Agrupaciones metropolitanas" onClick={() => resetTerritory('territorial')} active={!!provinceFilter} />
                <MetricCard icon="⌂" label="Arquidiócesis" value={loading ? '—' : countryTerritorialJurisdictions.filter(isArchdiocese).length} detail="Sedes metropolitanas" />
                <MetricCard icon="✛" label="Diócesis territoriales" value={loading ? '—' : countryTerritorialJurisdictions.filter(isDiocese).length} detail="Jurisdicciones diocesanas" />
                <MetricCard icon="盾" label="Jurisdicción especial" value={loading ? '—' : countrySpecialJurisdictions.length} detail="No adscrita a provincia" />
                <MetricCard icon="⌂" label="Parroquias reportadas" value={loading ? '—' : formatNumber(registeredParishes)} detail="Solo parroquias registradas en BD" />
              </section>
            )}

            {territoryMode === 'province' && (
              <section className="public-metrics-grid" aria-label="Resumen de provincia eclesiástica">
                <MetricCard icon="⌂" label="Arquidiócesis" value={loading ? '—' : archdioceseCount} detail="Sede metropolitana" />
                <MetricCard icon="✛" label="Diócesis" value={loading ? '—' : dioceseCount} detail="Sufragáneas" />
                <MetricCard icon="▥" label="Jurisdicciones" value={loading ? '—' : scopedTerritorialJurisdictions.length} detail="En la provincia" />
                <MetricCard icon="♙" label="Obispos / ordinarios" value={loading ? '—' : ordinaryCount} detail="Pastores registrados" />
                <MetricCard icon="⌂" label="Parroquias reportadas" value={loading ? '—' : formatNumber(registeredParishes)} detail="Solo parroquias de la provincia" />
              </section>
            )}

            {territoryMode === 'jurisdiction' && (
              <section className="public-metrics-grid" aria-label="Resumen de jurisdicción">
                <MetricCard icon="♙" label="Obispo" value={loading ? '—' : selectedOrdinaryCount} detail="Ordinario de la jurisdicción" />
                <MetricCard icon="✛" label="Sacerdotes" value={loading ? '—' : scopedPriestCount} detail="Pendiente de asignación por jurisdicción" />
                <MetricCard icon="⌂" label="Parroquias" value={loading ? '—' : formatNumber(registeredParishes)} detail="Comunidades parroquiales" />
                <MetricCard icon="▥" label="Nivel 1" value={loading ? '—' : (firstPastoralLevel?.count ?? 0)} detail={firstPastoralLevel?.name ?? 'Por configurar'} />
                <MetricCard icon="▤" label="Nivel 2" value={loading ? '—' : (secondPastoralLevel?.count ?? 0)} detail={secondPastoralLevel?.name ?? 'Por configurar'} />
              </section>
            )}

            {territoryMode === 'special' && (
              <section className="public-metrics-grid" aria-label="Resumen de jurisdicción especial">
                <MetricCard icon="盾" label="Tipo" value="1" detail={selectedJurisdiction?.entity_type_name ?? 'Jurisdicción especial'} />
                <MetricCard icon="♙" label="Ordinario" value={loading ? '—' : selectedOrdinaryCount} detail="Responsable pastoral" />
                <MetricCard icon="✛" label="Clero / capellanes" value="—" detail="Pendiente de asignación específica" />
                <MetricCard icon="⌂" label="Parroquias reportadas" value={loading ? '—' : formatNumber(registeredParishes)} detail="Si aplica al ordinariato" />
              </section>
            )}

            {territoryMode === 'country' && (
              <section className="public-content-grid public-country-content-grid">
                <article className="public-panel public-section-card">
                  <div className="public-section-title">
                    <p className="eyebrow">Provincias eclesiásticas</p>
                    <h2>Selecciona una provincia</h2>
                    <p>Agrupaciones de iglesias locales bajo una sede metropolitana.</p>
                  </div>
                  <div className="public-province-list">
                    {displayedProvinces.length === 0 && <EmptyViewNote title="Sin provincias" detail="No hay provincias eclesiásticas para el ámbito seleccionado." />}
                    {displayedProvinces.map((province) => (
                      <article className="public-province-card" key={province.name}>
                        <span className="public-node-icon" aria-hidden="true">⌂</span>
                        <button onClick={() => selectProvince(province.name)} type="button">
                          <strong>{province.name}</strong>
                          <span>{province.count} jurisdicciones territoriales</span>
                        </button>
                        <Link className="public-link" href={`/provincias-eclesiasticas/${slugify(province.name)}`}>Ver ficha →</Link>
                      </article>
                    ))}
                  </div>
                </article>

                <article className="public-panel public-section-card">
                  <div className="public-section-title">
                    <p className="eyebrow">Jurisdicciones territoriales</p>
                    <h2>{countryTerritorialJurisdictions.length} resultados</h2>
                    <p>Arquidiócesis y diócesis integradas en provincias eclesiásticas.</p>
                  </div>
                  <div className="public-table">
                    <div className="public-table-head"><span>Jurisdicción</span><span>Tipo</span><span>Acción</span></div>
                    {countryTerritorialJurisdictions.slice(0, 5).map((item) => <JurisdictionRow item={item} key={item.id} />)}
                    <div className="public-list-footer"><Link className="public-link" href="/diocesis">Ver todas las jurisdicciones territoriales →</Link></div>
                  </div>
                </article>

                <article className="public-panel public-section-card">
                  <div className="public-section-title">
                    <p className="eyebrow">Jurisdicciones especiales</p>
                    <h2>{countrySpecialJurisdictions.length} resultado</h2>
                    <p>No pertenecen a una provincia eclesiástica.</p>
                  </div>
                  <div className="public-directory-grid">
                    {countrySpecialJurisdictions.length === 0 && <EmptyViewNote title="Sin jurisdicciones especiales" detail="No hay ordinariatos o jurisdicciones personales publicados." />}
                    {countrySpecialJurisdictions.map((item) => <OrdinaryItem item={item} key={item.id} />)}
                  </div>
                  <div className="public-info-banner compact">Las jurisdicciones especiales, como los ordinariatos militares, no se integran a las provincias eclesiásticas.</div>
                </article>
              </section>
            )}

            {territoryMode === 'province' && (
              <>
                <section className="public-content-grid public-province-content-grid">
                  <article className="public-panel public-section-card">
                    <div className="public-section-title">
                      <p className="eyebrow">Jurisdicciones de la provincia</p>
                      <h2>{scopedTerritorialJurisdictions.length} resultados</h2>
                      <p>Arquidiócesis metropolitana y diócesis sufragáneas.</p>
                    </div>
                    <div className="public-table">
                      <div className="public-table-head"><span>Jurisdicción</span><span>Tipo</span><span>Acción</span></div>
                      {visibleTerritorialJurisdictions.length === 0 && <div className="public-empty">No hay jurisdicciones para mostrar.</div>}
                      {visibleTerritorialJurisdictions.map((item) => <JurisdictionRow active={jurisdictionFilter === item.id} item={item} key={item.id} />)}
                      <div className="public-list-footer"><Link className="public-link" href="/diocesis">Ver todas las jurisdicciones de la provincia →</Link></div>
                    </div>
                  </article>

                  <article className="public-panel public-section-card">
                    <div className="public-section-title">
                      <p className="eyebrow">Obispos y ordinarios</p>
                      <h2>{ordinaryCount} registros</h2>
                      <p>Pastores responsables de las jurisdicciones de esta provincia.</p>
                    </div>
                    <div className="public-directory-grid">
                      {scopedTerritorialJurisdictions.filter((item) => item.current_ordinary_name).map((item) => <OrdinaryItem item={item} key={item.id} />)}
                      {ordinaryCount === 0 && <EmptyViewNote title="Sin ordinarios publicados" detail="No hay obispos u ordinarios registrados para esta provincia." />}
                    </div>
                  </article>
                </section>
                {countrySpecialJurisdictions.length > 0 && <div className="public-info-banner">El Obispado Castrense de República Dominicana no se muestra en este listado porque no pertenece a la provincia eclesiástica seleccionada.</div>}
              </>
            )}

            {territoryMode === 'jurisdiction' && selectedJurisdiction && (
              <>
                <section className="public-content-grid public-diocese-content-grid">
                  <article className="public-panel public-section-card">
                    <div className="public-section-title">
                      <p className="eyebrow">Obispo / ordinario</p>
                      <h2>Pastor propio</h2>
                    </div>
                    <div className="public-directory-item public-feature-card">
                      <strong>{selectedJurisdiction.current_ordinary_name ?? 'Ordinario no registrado'}</strong>
                      <span>{selectedJurisdiction.current_ordinary_title ?? 'Obispo / ordinario'} · {selectedJurisdiction.name}</span>
                      <Link className="public-link" href={`/entidades/${selectedJurisdiction.slug}`}>Ver ficha →</Link>
                    </div>
                    <div className="public-info-banner compact">Es el pastor propio de esta porción del Pueblo de Dios.</div>
                  </article>

                  <article className="public-panel public-section-card">
                    <div className="public-section-title">
                      <p className="eyebrow">Sacerdotes</p>
                      <h2>Ministerio sacerdotal</h2>
                      <p>La distribución por cargo requiere asignaciones vigentes publicadas.</p>
                    </div>
                    <div className="public-table public-compact-table">
                      {priestRoleRows.map((row) => <div className="public-row" key={row.label}><span className="public-row-main"><span className="public-row-icon" aria-hidden="true">✛</span><span><strong>{row.label}</strong><small>Asignación por jurisdicción</small></span></span><span className="public-type">{row.value}</span><span /> </div>)}
                      <div className="public-list-footer"><Link className="public-link" href="/personas">Ver todos los sacerdotes →</Link></div>
                    </div>
                  </article>

                  <article className="public-panel public-section-card public-diocese-structure-card">
                    <div className="public-section-title">
                      <p className="eyebrow">Organización territorial o pastoral</p>
                      <h2>Próximos niveles configurados</h2>
                      <p>Los niveles mostrados corresponden a la configuración territorial de esta jurisdicción.</p>
                    </div>
                    <div className="public-level-grid">
                      {nextPastoralLevels.length === 0 && <EmptyViewNote title="Niveles por configurar" detail="No hay niveles pastorales publicados para esta jurisdicción." />}
                      {nextPastoralLevels.map((level, index) => (
                        <article className="public-level-card" key={level.name}>
                          <div className="public-section-title">
                            <p className="eyebrow">Nivel {index + 1}</p>
                            <h2>{level.name}</h2>
                            <p>{level.count} registros publicados</p>
                          </div>
                          <div className="public-directory-grid">
                            {level.items.slice(0, 3).map((item) => <Link className="public-directory-item" href={item.linked_entity_slug ? `/entidades/${item.linked_entity_slug}` : `/pastoral/${item.slug}`} key={item.id}><strong>{item.name}</strong><span>{item.diocese_name ?? selectedJurisdiction.name}</span></Link>)}
                          </div>
                        </article>
                      ))}
                    </div>
                  </article>
                </section>
                <div className="public-info-banner">Los datos presentados corresponden únicamente a {selectedJurisdiction.name} y a los niveles territoriales configurados en esta jurisdicción.</div>
              </>
            )}

            {territoryMode === 'special' && selectedJurisdiction && (
              <section className="public-content-grid public-province-content-grid">
                <article className="public-panel public-section-card">
                  <div className="public-section-title">
                    <p className="eyebrow">Jurisdicción especial</p>
                    <h2>{selectedJurisdiction.name}</h2>
                    <p>No está adscrita a una provincia eclesiástica.</p>
                  </div>
                  <JurisdictionRow item={selectedJurisdiction} active />
                </article>
                <article className="public-panel public-section-card">
                  <div className="public-section-title">
                    <p className="eyebrow">Ordinario y estructura propia</p>
                    <h2>{selectedJurisdiction.current_ordinary_name ?? 'Ordinario no registrado'}</h2>
                    <p>La estructura pastoral propia se publicará según las asignaciones configuradas.</p>
                  </div>
                  <div className="public-info-banner compact">Provincia eclesiástica: No aplica. Las jurisdicciones especiales tienen estatuto propio.</div>
                </article>
              </section>
            )}
          </section>
        )}

        {activeView === 'clero' && (
          <section className="public-directory-card public-panel" id="panel-clero" role="tabpanel" aria-labelledby="tab-clero">
            <div className="public-section-title">
              <p className="eyebrow">{activeViewMeta.eyebrow}</p>
              <h2>{activeViewMeta.title}</h2>
              <p>{activeViewMeta.description}</p>
            </div>
            <section className="public-metrics-grid" aria-label="Resumen de personas">
              <MetricCard icon="♙" label="Obispos" value={loading ? '—' : (peopleSummary?.bishops ?? people.filter((item) => item.person_type === 'bishop').length)} detail="Ordinarios, auxiliares y eméritos" onClick={() => setPersonTypeFilter('bishop')} active={personTypeFilter === 'bishop'} />
              <MetricCard icon="✛" label="Presbíteros" value={loading ? '—' : (peopleSummary?.priests ?? people.filter((item) => item.person_type === 'priest').length)} detail="Clero presbiteral" onClick={() => setPersonTypeFilter('priest')} active={personTypeFilter === 'priest'} />
              <MetricCard icon="◇" label="Diáconos" value={loading ? '—' : (peopleSummary?.deacons ?? people.filter((item) => item.person_type === 'deacon').length)} detail="Ministerio diaconal" onClick={() => setPersonTypeFilter('deacon')} active={personTypeFilter === 'deacon'} />
              <MetricCard icon="☧" label="Vida consagrada" value={loading ? '—' : (peopleSummary?.religious ?? people.filter((item) => item.person_type === 'religious').length)} detail="Religiosos y religiosas" onClick={() => setPersonTypeFilter('religious')} active={personTypeFilter === 'religious'} />
              <MetricCard icon="♧" label="Laicos/as" value={loading ? '—' : (peopleSummary?.laypeople ?? people.filter((item) => item.person_type === 'layperson').length)} detail="Agentes con responsabilidad" onClick={() => setPersonTypeFilter('layperson')} active={personTypeFilter === 'layperson'} />
              <MetricCard icon="◎" label="Activos" value={loading ? '—' : (peopleSummary?.active ?? people.filter((item) => item.status === 'active' && !item.death_date).length)} detail="Registros públicos vigentes" />
            </section>
            <div className="public-directory-grid">
              {visiblePeople.length === 0 && <EmptyViewNote title="Sin personas" detail="No hay personas públicas para mostrar con el filtro actual." />}
              {visiblePeople.map((item) => <Link className="public-directory-item" href={`/personas/${item.slug}`} key={item.id}><strong>{item.display_name}</strong><span>{personTypeLabel(item.person_type)} · {statusLabel(item)}</span><span className="public-link">Ver ficha →</span></Link>)}
            </div>
          </section>
        )}

        {activeView === 'pastoral' && (
          <section className="public-directory-card public-panel" id="panel-pastoral" role="tabpanel" aria-labelledby="tab-pastoral">
            <div className="public-section-title"><p className="eyebrow">{activeViewMeta.eyebrow}</p><h2>{activeViewMeta.title}</h2><p>{activeViewMeta.description}</p></div>
            <section className="public-metrics-grid" aria-label="Resumen pastoral">
              {pastoralLevels.length === 0 && <MetricCard icon="⌂" label="Estructura pastoral" value={formatNumber(registeredParishes)} detail="Parroquias registradas en BD" />}
              {pastoralLevels.slice(0, 6).map((level) => <MetricCard key={level.name} icon="✝" label={level.name} value={level.count} detail="Nivel publicado" onClick={() => setPastoralLevelFilter(level.name)} active={pastoralLevelFilter === level.name} />)}
            </section>
            {filteredPastoral.length === 0 ? <EmptyViewNote title="Vista pastoral en preparación" detail="La estructura flexible ya existe; falta publicar nodos pastorales suficientes para esta vista o ámbito." /> : <div className="public-directory-grid">{filteredPastoral.slice(0, 16).map((item) => <Link className="public-directory-item" href={item.linked_entity_slug ? `/entidades/${item.linked_entity_slug}` : `/pastoral/${item.slug}`} key={item.id}><strong>{item.name}</strong><span>{item.level_name ?? 'Nivel pastoral'} · {item.diocese_name ?? 'Sin jurisdicción'}</span></Link>)}</div>}
          </section>
        )}

        {activeView === 'administrativa' && (
          <section className="public-directory-card public-panel" id="panel-administrativa" role="tabpanel" aria-labelledby="tab-administrativa">
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
          <section className="public-directory-card public-panel" id="panel-colegial" role="tabpanel" aria-labelledby="tab-colegial">
            <div className="public-section-title"><p className="eyebrow">{activeViewMeta.eyebrow}</p><h2>{activeViewMeta.title}</h2><p>{activeViewMeta.description}</p></div>
            <section className="public-metrics-grid" aria-label="Resumen colegial">
              <MetricCard icon="♧" label="Organismos colegiales" value={collegialUnits.length} detail="Consejos, comisiones y comités" />
              <MetricCard icon="▣" label="Órganos superiores" value={collegialUnits.filter((item) => !item.parent_unit_id).length} detail="Primer nivel colegial" />
            </section>
            {collegialUnits.length === 0 ? <EmptyViewNote title="Vista colegial en preparación" detail="No hay organismos colegiales públicos todavía. Esta vista queda separada para consejos, comisiones, comités y equipos transversales." /> : <div className="public-directory-grid">{collegialUnits.slice(0, 16).map((item) => <Link className="public-directory-item" href={`/organismos/${item.id}`} key={item.id}><strong>{item.name}</strong><span>{item.description ?? 'Organismo colegial'}</span></Link>)}</div>}
          </section>
        )}
      </main>

      <nav className="public-bottom-nav" aria-label="Navegación móvil">
        {bottomNav.map((item) => <Link aria-current={item.active ? 'page' : undefined} className={item.active ? 'active' : ''} href={item.href} key={item.label}><span aria-hidden="true">{item.icon}</span><span>{item.label}</span></Link>)}
      </nav>
    </div>
  )
}
