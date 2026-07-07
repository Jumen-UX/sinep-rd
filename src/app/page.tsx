'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Diocese = {
  id: string
  slug: string
  name: string
  entity_type_name: string | null
  ecclesiastical_province_name: string | null
  current_ordinary_name: string | null
  current_ordinary_title: string | null
  catholics_total: number | null
  parishes_count: number | null
  statistics_year: number | null
}

type Person = {
  id: string
  display_name: string
  slug: string
  person_type: string | null
  status: string | null
  death_date: string | null
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
    total_parishes: number
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

type ViewCard = {
  label: string
  title: string
  description: string
  href: string
  action: string
  metric?: string
}

const publicViewCards: ViewCard[] = [
  {
    label: 'Territorial-canónica',
    title: 'Jurisdicciones y provincias',
    description: 'Consulta la organización Iglesia sui iuris, provincias eclesiásticas, arquidiócesis y diócesis sufragáneas.',
    href: '/diocesis',
    action: 'Abrir vista territorial',
  },
  {
    label: 'Pastoral-operativa',
    title: 'Estructuras internas por diócesis',
    description: 'Base para navegar vicarías, zonas pastorales, parroquias, sectores, capillas y comunidades según la estructura activa de cada diócesis.',
    href: '/diocesis',
    action: 'Explorar por diócesis',
  },
  {
    label: 'Personas y ministerios',
    title: 'Clero, religiosos y agentes',
    description: 'Acceso a obispos, sacerdotes, diáconos, religiosos/as y laicos/as registrados en el sistema.',
    href: '/personas',
    action: 'Ver personas',
  },
  {
    label: 'Administración',
    title: 'Carga y mantenimiento de datos',
    description: 'Entrada al portal administrativo para completar fichas, validar solicitudes y trabajar nombramientos.',
    href: '/admin',
    action: 'Ir al portal',
  },
]

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('es-DO').format(value)
}

function personTypeLabel(value: string | null) {
  const labels: Record<string, string> = {
    bishop: 'Obispo',
    priest: 'Sacerdote',
    deacon: 'Diácono',
    religious: 'Religioso/a',
    layperson: 'Laico/a',
  }

  if (!value) return 'Persona'
  return labels[value] ?? value
}

function parishStatLabel(item: Diocese) {
  if (!item.parishes_count) return 'Sin estadística parroquial'
  return `Estadística: ${formatNumber(item.parishes_count)} parroquias${item.statistics_year ? ` · ${item.statistics_year}` : ''}`
}

function statusLabel(item: Person) {
  return item.status === 'active' && !item.death_date ? 'Activo' : 'Histórico'
}

export default function HomePage() {
  const [dioceses, setDioceses] = useState<Diocese[]>([])
  const [bishops, setBishops] = useState<Person[]>([])
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [summaryResponse, dioceseResponse, peopleResponse] = await Promise.all([
          fetch('/api/dashboard/resumen'),
          fetch('/api/diocesis?limit=8'),
          fetch('/api/personas?tipo=bishop&limit=8'),
        ])

        if (summaryResponse.ok) {
          setSummary((await summaryResponse.json()) as DashboardSummary)
        }

        if (dioceseResponse.ok) {
          setDioceses((await dioceseResponse.json()) as Diocese[])
        }

        if (peopleResponse.ok) {
          setBishops((await peopleResponse.json()) as Person[])
        }
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  const diocesesSummary = summary?.dioceses
  const peopleSummary = summary?.people
  const provinces = diocesesSummary?.provinces ?? []
  const loadedParishes = diocesesSummary?.loaded_parishes ?? diocesesSummary?.total_parishes ?? null
  const reportedParishes = diocesesSummary?.reported_parishes ?? null
  const parishDelta = reportedParishes !== null && loadedParishes !== null ? reportedParishes - loadedParishes : null

  const viewCards = publicViewCards.map((card) => {
    if (card.title === 'Jurisdicciones y provincias') {
      return { ...card, metric: loading ? '—' : `${diocesesSummary?.total ?? 0} jurisdicciones` }
    }

    if (card.title === 'Clero, religiosos y agentes') {
      return { ...card, metric: loading ? '—' : `${peopleSummary?.active ?? 0} personas activas` }
    }

    if (card.title === 'Carga y mantenimiento de datos') {
      return { ...card, metric: 'Portal protegido' }
    }

    return { ...card, metric: 'Estructura configurable' }
  })

  return (
    <main className="container dashboard-page home-dashboard">
      <section className="home-hero-panel card">
        <div className="home-hero-copy">
          <p className="eyebrow">República Dominicana</p>
          <h1>SINEP RD</h1>
          <p className="lead">
            Sistema Nacional de Información Eclesiástica y Pastoral. Consulta nacional, fichas históricas y administración de datos eclesiales desde una navegación por vistas.
          </p>

          <div className="home-hero-actions">
            <Link className="button button-primary" href="/diocesis">
              Abrir vista nacional
            </Link>
            <Link className="button button-secondary" href="/personas?tipo=bishop">
              Ver obispos
            </Link>
            <Link className="button button-secondary" href="/admin">
              Portal administrativo
            </Link>
          </div>
        </div>

        <aside className="home-context-card" aria-label="Modelo jerárquico">
          <p className="eyebrow">Modelo de lectura</p>
          <h2>Del país a la ficha</h2>
          <div className="home-hierarchy-path" aria-label="Ruta de navegación">
            <span>País</span>
            <span>Provincia eclesiástica</span>
            <span>Diócesis</span>
            <span>Estructura interna configurable</span>
            <span>Ficha</span>
          </div>
          <p className="meta">
            La página principal no edita datos: orienta al usuario hacia la vista correcta y luego cada listado abre la ficha completa.
          </p>
        </aside>
      </section>

      <section className="home-metric-strip" aria-label="Resumen nacional">
        <Link className="home-metric-card metric-link" href="/diocesis">
          <span>Jurisdicciones</span>
          <strong>{loading ? '—' : diocesesSummary?.total ?? 0}</strong>
          <small>{loading ? 'Cargando...' : `${diocesesSummary?.archdioceses ?? 0} arquidiócesis · ${diocesesSummary?.dioceses ?? 0} diócesis`}</small>
        </Link>
        <Link className="home-metric-card metric-link" href="/diocesis">
          <span>Provincias eclesiásticas</span>
          <strong>{loading ? '—' : provinces.length}</strong>
          <small>Organización metropolitana y sufragánea</small>
        </Link>
        <Link className="home-metric-card metric-link" href="/personas?tipo=bishop">
          <span>Obispos registrados</span>
          <strong>{loading ? '—' : peopleSummary?.bishops ?? 0}</strong>
          <small>Ordinarios, auxiliares y eméritos</small>
        </Link>
        <Link className="home-metric-card metric-link" href="/personas">
          <span>Personas activas</span>
          <strong>{loading ? '—' : peopleSummary?.active ?? 0}</strong>
          <small>Clero, vida consagrada y agentes</small>
        </Link>
      </section>

      <section className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Vistas principales</p>
            <h2>Elige cómo quieres entrar al sistema</h2>
          </div>
          <span className="meta">Cada vista lleva a una lista filtrable o a un módulo operativo.</span>
        </div>

        <div className="home-view-grid">
          {viewCards.map((card) => (
            <Link className="home-view-card" href={card.href} key={card.title}>
              <span className="home-view-label">{card.label}</span>
              <strong>{card.title}</strong>
              <p>{card.description}</p>
              <span className="home-view-meta">{card.metric}</span>
              <span className="home-view-action">{card.action} →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="dashboard-grid home-data-grid">
        <article className="card dashboard-section home-data-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Cobertura territorial</p>
              <h2>Datos reportados</h2>
            </div>
          </div>

          <div className="home-data-pairs">
            <div>
              <span>Fieles católicos</span>
              <strong>{loading ? '—' : formatNumber(diocesesSummary?.total_catholics)}</strong>
            </div>
            <div>
              <span>Población total</span>
              <strong>{loading ? '—' : formatNumber(diocesesSummary?.total_population)}</strong>
            </div>
            <div>
              <span>Parroquias cargadas</span>
              <strong>{loading ? '—' : formatNumber(loadedParishes)}</strong>
            </div>
            <div>
              <span>Parroquias reportadas</span>
              <strong>{loading ? '—' : formatNumber(reportedParishes)}</strong>
            </div>
          </div>

          {parishDelta !== null && parishDelta > 0 && (
            <p className="home-warning-note">
              Faltan por cargar {formatNumber(parishDelta)} parroquias frente a la estadística reportada.
            </p>
          )}
        </article>

        <article className="card dashboard-section home-data-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Personas</p>
              <h2>Distribución registrada</h2>
            </div>
          </div>

          <div className="home-data-pairs">
            <Link href="/personas?tipo=priest">
              <span>Sacerdotes</span>
              <strong>{loading ? '—' : peopleSummary?.priests ?? 0}</strong>
            </Link>
            <Link href="/personas?tipo=deacon">
              <span>Diáconos</span>
              <strong>{loading ? '—' : peopleSummary?.deacons ?? 0}</strong>
            </Link>
            <Link href="/personas?tipo=religious">
              <span>Religiosos/as</span>
              <strong>{loading ? '—' : peopleSummary?.religious ?? 0}</strong>
            </Link>
            <Link href="/personas?tipo=layperson">
              <span>Laicos/as</span>
              <strong>{loading ? '—' : peopleSummary?.laypeople ?? 0}</strong>
            </Link>
          </div>
        </article>
      </section>

      <section className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Provincias eclesiásticas</p>
            <h2>Navegación metropolitana</h2>
          </div>
          <Link className="inline-link" href="/diocesis">Ver todas</Link>
        </div>

        <div className="home-province-grid">
          {provinces.length === 0 && <div className="empty-state">No hay provincias eclesiásticas cargadas.</div>}
          {provinces.map((province) => (
            <Link className="home-province-card" href={`/diocesis?provincia=${encodeURIComponent(province.name)}`} key={province.name}>
              <strong>{province.name}</strong>
              <span>{province.count} jurisdicciones</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="dashboard-grid two-panel-grid">
        <article className="card dashboard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Jurisdicciones</p>
              <h2>Resumen nacional</h2>
            </div>
            <Link className="inline-link" href="/diocesis">Ver todas</Link>
          </div>
          <div className="list-table compact-list-table">
            {dioceses.length === 0 && <div className="home-empty-row">No hay jurisdicciones para mostrar.</div>}
            {dioceses.map((item) => (
              <Link className="list-row" href={`/entidades/${item.slug}`} key={item.id}>
                <span><strong>{item.name}</strong><small>{item.entity_type_name ?? 'Jurisdicción'}</small></span>
                <span>{item.current_ordinary_name ?? 'Sin ordinario registrado'}</span>
                <span>{parishStatLabel(item)}</span>
              </Link>
            ))}
          </div>
        </article>

        <article className="card dashboard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Personas</p>
              <h2>Obispos</h2>
            </div>
            <Link className="inline-link" href="/personas?tipo=bishop">Ver todos</Link>
          </div>
          <div className="list-table compact-list-table">
            {bishops.length === 0 && <div className="home-empty-row">No hay obispos para mostrar.</div>}
            {bishops.map((item) => (
              <Link className="list-row" href={`/personas/${item.slug}`} key={item.id}>
                <span><strong>{item.display_name}</strong><small>{personTypeLabel(item.person_type)}</small></span>
                <span>{statusLabel(item)}</span>
                <span>Ver ficha →</span>
              </Link>
            ))}
          </div>
        </article>
      </section>
    </main>
  )
}
