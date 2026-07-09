'use client'

import { type FormEvent, type MouseEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type PersonRow = {
  person_id: string
  display_name: string | null
  person_type: string | null
  status: string | null
  visibility: string | null
  current_entity_id: string | null
  current_entity_name: string | null
  current_pastoral_entity_id: string | null
  current_pastoral_entity_name: string | null
  incardination_entity_id: string | null
  incardination_entity_name: string | null
  updated_at: string | null
}

type PersonFilter = 'active' | 'clergy' | 'bishops' | 'priests' | 'deacons' | 'religious' | 'layperson' | 'deceased' | 'all'

type FilterCard = {
  key: PersonFilter
  label: string
  description: string
  icon: string
  count: number
}

type QuickAccess = {
  href: string
  icon: string
  title: string
  description: string
}

function forceNavigation(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  window.location.assign(href)
}

function personTypeLabel(value: string | null) {
  if (value === 'bishop') return 'Obispo'
  if (value === 'priest') return 'Sacerdote'
  if (value === 'deacon') return 'Diácono'
  if (value === 'religious') return 'Religioso/a'
  if (value === 'layperson') return 'Laico/a'
  if (value === 'seminarian') return 'Seminarista'
  return 'Persona'
}

function statusLabel(value: string | null) {
  if (value === 'active') return 'Activo/a'
  if (value === 'retired') return 'Retirado/a'
  if (value === 'emeritus') return 'Emérito'
  if (value === 'deceased') return 'Fallecido/a'
  if (value === 'transferred') return 'Trasladado/a'
  if (value === 'inactive') return 'Inactivo/a'
  if (value === 'suspended') return 'Suspendido/a'
  return value ?? 'No indicado'
}

function visibilityLabel(value: string | null) {
  if (value === 'public') return 'Pública'
  if (value === 'private') return 'Privada'
  if (value === 'internal') return 'Interna'
  return value ?? 'Sin visibilidad'
}

function personName(person: PersonRow) {
  return person.display_name ?? 'Persona sin nombre'
}

function personScope(person: PersonRow) {
  return person.current_entity_name
    ?? person.current_pastoral_entity_name
    ?? person.incardination_entity_name
    ?? 'Sin entidad vinculada visible'
}

function formatDate(value: string | null) {
  if (!value) return 'Sin actualización'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no válida'
  return new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

const quickAccesses: QuickAccess[] = [
  { href: '/admin/importar', icon: '⇪', title: 'Cargar por lotes', description: 'Importar personas desde CSV o Excel con revisión previa.' },
  { href: '/admin/nuevo/sacerdote', icon: '●', title: 'Registrar sacerdote', description: 'Alta clerical, ordenación y cargo inicial.' },
  { href: '/admin/nuevo/obispo', icon: '◍', title: 'Registrar obispo', description: 'Perfil episcopal y jurisdicción vinculada.' },
  { href: '/admin/nuevo/diacono', icon: '◌', title: 'Registrar diácono', description: 'Diaconado, incardinación y servicio actual.' },
  { href: '/admin/nuevo/religioso', icon: '✦', title: 'Registrar religioso/a', description: 'Instituto, comunidad y responsabilidad.' },
  { href: '/admin/nuevo/laico', icon: '◇', title: 'Registrar laico/a', description: 'Agente pastoral o responsabilidad administrativa.' },
  { href: '/admin/asignaciones', icon: '▣', title: 'Nombramientos', description: 'Cargos actuales, historial y sucesiones.' },
]

export default function AdminPersonasPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [people, setPeople] = useState<PersonRow[]>([])
  const [filter, setFilter] = useState<PersonFilter>('active')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  async function loadPeople(query = search, mode: 'initial' | 'refresh' = 'refresh') {
    if (mode === 'initial') setLoading(true)
    else setRefreshing(true)

    setError(null)

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    const { data, error: peopleError } = await supabase.rpc('admin_list_people', {
      p_search: query.trim() || null,
      p_limit: 300,
    })

    if (peopleError) {
      setError(peopleError.message)
      setPeople([])
    } else {
      setPeople((data ?? []) as PersonRow[])
    }

    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    loadPeople('', 'initial')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedSearch = searchInput.trim()
    setSearch(normalizedSearch)
    loadPeople(normalizedSearch)
  }

  function clearSearch() {
    setSearch('')
    setSearchInput('')
    loadPeople('')
  }

  const bishops = people.filter((person) => person.person_type === 'bishop')
  const priests = people.filter((person) => person.person_type === 'priest')
  const deacons = people.filter((person) => person.person_type === 'deacon')
  const clergy = people.filter((person) => ['bishop', 'priest', 'deacon'].includes(person.person_type ?? ''))
  const religious = people.filter((person) => person.person_type === 'religious')
  const laypeople = people.filter((person) => person.person_type === 'layperson')
  const deceased = people.filter((person) => person.status === 'deceased')
  const active = people.filter((person) => person.status !== 'deceased')
  const publicPeople = people.filter((person) => person.visibility === 'public')
  const privatePeople = people.filter((person) => person.visibility !== 'public')

  const filterCards: FilterCard[] = [
    { key: 'active', label: 'Activas', description: 'No fallecidas', icon: '✓', count: active.length },
    { key: 'clergy', label: 'Clero', description: 'Obispos, presbíteros y diáconos', icon: '◉', count: clergy.length },
    { key: 'bishops', label: 'Obispos', description: 'Orden episcopal', icon: '◍', count: bishops.length },
    { key: 'priests', label: 'Sacerdotes', description: 'Presbíteros registrados', icon: '●', count: priests.length },
    { key: 'deacons', label: 'Diáconos', description: 'Diaconado registrado', icon: '◌', count: deacons.length },
    { key: 'religious', label: 'Religiosos/as', description: 'Vida consagrada', icon: '✦', count: religious.length },
    { key: 'layperson', label: 'Laicos/as', description: 'Agentes pastorales', icon: '◇', count: laypeople.length },
    { key: 'deceased', label: 'Fallecidas', description: 'Historial necrológico', icon: '✝', count: deceased.length },
    { key: 'all', label: 'Total', description: 'Todas las visibles para tu alcance', icon: '∑', count: people.length },
  ]

  const visiblePeople = people.filter((person) => {
    return filter === 'all'
      || (filter === 'active' && person.status !== 'deceased')
      || (filter === 'clergy' && ['bishop', 'priest', 'deacon'].includes(person.person_type ?? ''))
      || (filter === 'bishops' && person.person_type === 'bishop')
      || (filter === 'priests' && person.person_type === 'priest')
      || (filter === 'deacons' && person.person_type === 'deacon')
      || (filter === 'religious' && person.person_type === 'religious')
      || (filter === 'layperson' && person.person_type === 'layperson')
      || (filter === 'deceased' && person.status === 'deceased')
  })

  if (loading) return <div className="empty-state">Cargando personas...</div>

  return (
    <div id="top">
      <header className="admin-top-header">
        <div className="admin-top-title">
          <span className="admin-mini-mark">PERSONAS</span>
          <strong>Directorio administrativo</strong>
        </div>
        <div className="admin-top-actions">
          <a className="button button-secondary" href="/admin" onClick={(event) => forceNavigation(event, '/admin')}>Volver al panel</a>
          <a className="button button-secondary" href="/admin/importar" onClick={(event) => forceNavigation(event, '/admin/importar')}>Carga por lotes</a>
          <a className="button button-secondary" href="/admin/asignaciones" onClick={(event) => forceNavigation(event, '/admin/asignaciones')}>Nombramientos</a>
          <a className="button button-primary" href="/admin/nuevo" onClick={(event) => forceNavigation(event, '/admin/nuevo')}>Agregar ficha</a>
        </div>
      </header>

      <section className="admin-welcome-panel">
        <div>
          <p className="eyebrow">Gestión de personas</p>
          <h1>Personas, ministerios y agentes eclesiales</h1>
          <p className="lead">Consulta, filtra y administra fichas personales con su alcance, visibilidad, estado y vínculos actuales. Cada ficha puede abrirse para edición o seguimiento.</p>
          <div className="role-list admin-role-list">
            <span className="role-pill">{clergy.length} en clero</span>
            <span className="role-pill">{religious.length} religiosos/as</span>
            <span className="role-pill">{laypeople.length} laicos/as</span>
            <span className="role-pill">{publicPeople.length} públicas · {privatePeople.length} internas/privadas</span>
          </div>
        </div>
        <div className="admin-welcome-illustration" aria-hidden="true">◉</div>
      </section>

      <section className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Accesos rápidos</p>
            <h2>Registrar, importar o mantener información personal</h2>
            <p className="meta">Usa asistentes específicos para registros individuales o carga masiva para lotes revisables.</p>
          </div>
          <button className="button button-secondary" disabled={refreshing} onClick={() => loadPeople(search)} type="button">{refreshing ? 'Actualizando...' : 'Actualizar listado'}</button>
        </div>
        <div className="admin-quick-grid">
          {quickAccesses.map((item) => (
            <a className="admin-quick-card" href={item.href} key={item.href} onClick={(event) => forceNavigation(event, item.href)}>
              <span className="admin-card-icon">{item.icon}</span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
              <span className="admin-card-arrow" aria-hidden="true">→</span>
            </a>
          ))}
        </div>
      </section>

      {error && (
        <div className="error-box">
          <strong>No se pudo cargar el listado.</strong>
          <p>{error}</p>
        </div>
      )}

      <section className="admin-stat-strip" aria-label="Filtros de personas">
        {filterCards.map((item) => (
          <button className={`metric-button ${filter === item.key ? 'active-filter' : ''}`} key={item.key} onClick={() => setFilter(item.key)} type="button">
            <span>{item.icon}</span>
            <strong>{item.count}</strong>
            <small>{item.label}</small>
          </button>
        ))}
      </section>

      <section className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Búsqueda y filtros</p>
            <h2>Listado administrativo</h2>
            <p className="meta">La búsqueda se ejecuta en servidor mediante una RPC protegida por permisos administrativos.</p>
          </div>
          <span className="role-pill">{visiblePeople.length} resultados</span>
        </div>

        <form className="auth-form access-form" onSubmit={handleSearch}>
          <label>
            Buscar por nombre, tipo o entidad
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Ej. Juan, sacerdote, Catedral, Santo Domingo" />
          </label>
          <button className="button button-primary" disabled={refreshing} type="submit">Buscar</button>
          {(search || searchInput) && <button className="button button-secondary" onClick={clearSearch} type="button">Limpiar</button>}
        </form>

        <div className="role-list admin-role-list">
          {filterCards.map((item) => (
            <button className={`role-pill ${filter === item.key ? 'active-filter' : ''}`} key={`pill-${item.key}`} onClick={() => setFilter(item.key)} type="button">
              {item.label} · {item.count}
            </button>
          ))}
        </div>

        {visiblePeople.length === 0 ? (
          <div className="empty-state">
            <h3>No hay personas visibles</h3>
            <p>No se encontraron registros para el filtro actual o tu alcance administrativo.</p>
          </div>
        ) : (
          <div className="admin-module-grid">
            {visiblePeople.map((person) => {
              const detailHref = `/admin/personas/${person.person_id}`
              const deceasedHref = `/admin/fallecimiento?person=${person.person_id}`

              return (
                <article className="admin-module-card is-active" key={person.person_id}>
                  <div className="admin-module-card-head">
                    <span className="admin-module-icon">{person.person_type === 'bishop' ? '◍' : person.person_type === 'priest' ? '●' : person.person_type === 'deacon' ? '◌' : person.person_type === 'religious' ? '✦' : '◇'}</span>
                    <span className="admin-status-pill active">{visibilityLabel(person.visibility)}</span>
                  </div>
                  <p className="entity-type">{personTypeLabel(person.person_type)}</p>
                  <h3>{personName(person)}</h3>
                  <p className="meta">{personScope(person)}</p>
                  <ul>
                    <li>Estado: {statusLabel(person.status)}</li>
                    <li>Actualizado: {formatDate(person.updated_at)}</li>
                    <li>ID: {person.person_id.slice(0, 8)}</li>
                  </ul>
                  <div className="admin-actions">
                    <a className="button button-secondary" href={detailHref} onClick={(event) => forceNavigation(event, detailHref)}>Abrir ficha</a>
                    {person.status !== 'deceased' && (
                      <a className="button button-primary" href={deceasedHref} onClick={(event) => forceNavigation(event, deceasedHref)}>Marcar fallecimiento</a>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
