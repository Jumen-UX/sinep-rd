'use client'

import { type FormEvent, type MouseEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { PageState } from '@/components/ui/page-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { createClient } from '@/lib/supabase/client'

type PersonRow = {
  person_id: string
  display_name: string | null
  person_type: string | null
  status: string | null
  visibility: string | null
  current_entity_id: string | null
  current_entity_name: string | null
  current_organization_unit_id: string | null
  current_organization_unit_name: string | null
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

function visibilityTone(value: string | null) {
  if (value === 'public') return 'success' as const
  if (value === 'private') return 'warning' as const
  return 'info' as const
}

function personName(person: PersonRow) {
  return person.display_name ?? 'Persona sin nombre'
}

function personScope(person: PersonRow) {
  return person.current_entity_name
    ?? person.current_organization_unit_name
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

export default function PersonListPage() {
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
    void loadPeople(normalizedSearch)
  }

  function clearSearch() {
    setSearch('')
    setSearchInput('')
    void loadPeople('')
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

  if (loading) {
    return <main className="container"><PageState compact kind="loading" title="Cargando personas" description="Estamos preparando el directorio administrativo." /></main>
  }

  return (
    <main className="container admin-dashboard" id="top">
      <PageHeader
        breadcrumbs={[{ label: 'Administración', href: '/admin' }, { label: 'Personas' }]}
        eyebrow="Gestión de personas"
        title="Personas, ministerios y agentes eclesiales"
        description="Consulta, filtra y administra fichas personales con su alcance, visibilidad, estado y vínculos actuales."
        metadata={(
          <>
            <StatusBadge tone="institutional" dot>{clergy.length} en clero</StatusBadge>
            <StatusBadge tone="info" dot>{religious.length} religiosos/as</StatusBadge>
            <StatusBadge tone="neutral" dot>{laypeople.length} laicos/as</StatusBadge>
            <StatusBadge tone="success" dot>{publicPeople.length} públicas</StatusBadge>
            <StatusBadge tone="warning" dot>{privatePeople.length} internas o privadas</StatusBadge>
          </>
        )}
        actions={(
          <>
            <Button asChild variant="secondary"><a href="/admin/importar" onClick={(event) => forceNavigation(event, '/admin/importar')}>Carga por lotes</a></Button>
            <Button asChild variant="secondary"><a href="/admin/asignaciones" onClick={(event) => forceNavigation(event, '/admin/asignaciones')}>Nombramientos</a></Button>
            <Button asChild><a href="/admin/nuevo" onClick={(event) => forceNavigation(event, '/admin/nuevo')}>Agregar ficha</a></Button>
          </>
        )}
      />

      <section className="card dashboard-section" aria-labelledby="person-quick-access-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Accesos rápidos</p>
            <h2 id="person-quick-access-heading">Registrar, importar o mantener información personal</h2>
            <p className="meta">Usa asistentes específicos para registros individuales o carga masiva para lotes revisables.</p>
          </div>
          <Button disabled={refreshing} onClick={() => void loadPeople(search)} type="button" variant="secondary">{refreshing ? 'Actualizando...' : 'Actualizar listado'}</Button>
        </div>
        <div className="admin-quick-grid">
          {quickAccesses.map((item) => (
            <a className="admin-quick-card" href={item.href} key={item.href} onClick={(event) => forceNavigation(event, item.href)}>
              <span className="admin-card-icon" aria-hidden="true">{item.icon}</span>
              <span><strong>{item.title}</strong><small>{item.description}</small></span>
              <span className="admin-card-arrow" aria-hidden="true">→</span>
            </a>
          ))}
        </div>
      </section>

      {error ? <PageState kind="error" title="No se pudo cargar el listado" description={error} /> : null}

      <section className="admin-stat-strip" aria-label="Filtros de personas">
        {filterCards.map((item) => (
          <button aria-pressed={filter === item.key} className={`metric-button ${filter === item.key ? 'active-filter' : ''}`} key={item.key} onClick={() => setFilter(item.key)} type="button">
            <span aria-hidden="true">{item.icon}</span>
            <strong>{item.count}</strong>
            <small>{item.label}</small>
          </button>
        ))}
      </section>

      <section className="card dashboard-section" aria-labelledby="person-directory-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Búsqueda y filtros</p>
            <h2 id="person-directory-heading">Listado administrativo</h2>
            <p className="meta">La búsqueda se ejecuta en servidor mediante una RPC protegida por permisos administrativos.</p>
          </div>
          <StatusBadge tone="info">{visiblePeople.length} resultado{visiblePeople.length === 1 ? '' : 's'}</StatusBadge>
        </div>

        <form className="auth-form access-form" onSubmit={handleSearch}>
          <label>
            Buscar por nombre, tipo o entidad
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Ej. Juan, sacerdote, Catedral, Santo Domingo" />
          </label>
          <Button disabled={refreshing} type="submit">Buscar</Button>
          {(search || searchInput) ? <Button onClick={clearSearch} type="button" variant="secondary">Limpiar</Button> : null}
        </form>

        <div className="role-list admin-role-list" aria-label="Filtros resumidos">
          {filterCards.map((item) => (
            <button aria-pressed={filter === item.key} className={`role-pill ${filter === item.key ? 'active-filter' : ''}`} key={`pill-${item.key}`} onClick={() => setFilter(item.key)} type="button">
              {item.label} · {item.count}
            </button>
          ))}
        </div>

        {visiblePeople.length === 0 ? (
          <PageState kind="empty" title="No hay personas visibles" description="No se encontraron registros para el filtro actual, la búsqueda o tu alcance administrativo." />
        ) : (
          <div className="admin-module-grid">
            {visiblePeople.map((person) => {
              const detailHref = `/admin/personas/${person.person_id}`
              const deceasedHref = `/admin/fallecimiento?person=${person.person_id}`

              return (
                <article className="admin-module-card is-active" key={person.person_id}>
                  <div className="admin-module-card-head">
                    <span className="admin-module-icon" aria-hidden="true">{person.person_type === 'bishop' ? '◍' : person.person_type === 'priest' ? '●' : person.person_type === 'deacon' ? '◌' : person.person_type === 'religious' ? '✦' : '◇'}</span>
                    <StatusBadge tone={visibilityTone(person.visibility)}>{visibilityLabel(person.visibility)}</StatusBadge>
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
                    <Button asChild variant="secondary"><a href={detailHref} onClick={(event) => forceNavigation(event, detailHref)}>Abrir ficha</a></Button>
                    {person.status !== 'deceased' ? (
                      <Button asChild><a href={deceasedHref} onClick={(event) => forceNavigation(event, deceasedHref)}>Marcar fallecimiento</a></Button>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
