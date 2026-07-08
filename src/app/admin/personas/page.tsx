'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useState } from 'react'
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

type PersonFilter = 'active' | 'clergy' | 'religious' | 'layperson' | 'deceased' | 'all'

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

function personName(person: PersonRow) {
  return person.display_name ?? 'Persona sin nombre'
}

function personScope(person: PersonRow) {
  return person.current_entity_name
    ?? person.current_pastoral_entity_name
    ?? person.incardination_entity_name
    ?? 'Sin entidad vinculada visible'
}

export default function AdminPersonasPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [people, setPeople] = useState<PersonRow[]>([])
  const [filter, setFilter] = useState<PersonFilter>('active')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  async function loadPeople(query = search) {
    setLoading(true)
    setError(null)

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    const { data, error: peopleError } = await supabase.rpc('admin_list_people', {
      p_search: query.trim() || null,
      p_limit: 200,
    })

    if (peopleError) {
      setError(peopleError.message)
      setPeople([])
    } else {
      setPeople((data ?? []) as PersonRow[])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadPeople('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSearch(searchInput)
    loadPeople(searchInput)
  }

  const clergy = people.filter((person) => ['bishop', 'priest', 'deacon'].includes(person.person_type ?? ''))
  const religious = people.filter((person) => person.person_type === 'religious')
  const laypeople = people.filter((person) => person.person_type === 'layperson')
  const deceased = people.filter((person) => person.status === 'deceased')
  const active = people.filter((person) => person.status !== 'deceased')

  const visiblePeople = people.filter((person) => {
    return filter === 'all'
      || (filter === 'active' && person.status !== 'deceased')
      || (filter === 'clergy' && ['bishop', 'priest', 'deacon'].includes(person.person_type ?? ''))
      || (filter === 'religious' && person.person_type === 'religious')
      || (filter === 'layperson' && person.person_type === 'layperson')
      || (filter === 'deceased' && person.status === 'deceased')
  })

  if (loading) return <main className="container"><div className="empty-state">Cargando personas...</div></main>

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink"><Link href="/admin">← Volver al panel administrativo</Link></div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Administración de personas</p>
          <h1>Personas registradas</h1>
          <p className="lead">El listado respeta permisos por alcance: parroquia, zona, vicaría, diócesis, pastoral o nivel nacional.</p>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="dashboard-grid dashboard-summary">
        <button className={`metric-card metric-button ${filter === 'active' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('active')}>
          <strong>{active.length}</strong><span>Activas</span>
        </button>
        <button className={`metric-card metric-button ${filter === 'clergy' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('clergy')}>
          <strong>{clergy.length}</strong><span>Clero</span>
        </button>
        <button className={`metric-card metric-button ${filter === 'religious' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('religious')}>
          <strong>{religious.length}</strong><span>Religiosos/as</span>
        </button>
        <button className={`metric-card metric-button ${filter === 'layperson' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('layperson')}>
          <strong>{laypeople.length}</strong><span>Laicos/as</span>
        </button>
        <button className={`metric-card metric-button ${filter === 'deceased' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('deceased')}>
          <strong>{deceased.length}</strong><span>Fallecidas</span>
        </button>
        <button className={`metric-card metric-button ${filter === 'all' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('all')}>
          <strong>{people.length}</strong><span>Total visible</span>
        </button>
      </section>

      <section className="card admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Búsqueda</p>
            <h2>Listado administrativo</h2>
            <p className="meta">Los resultados salen de una RPC protegida; la búsqueda se ejecuta en servidor.</p>
          </div>
        </div>

        <form className="auth-form access-form" onSubmit={handleSearch}>
          <label>
            Buscar por nombre, tipo o entidad
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Ej. Juan, sacerdote, Catedral" />
          </label>
          <button className="button button-primary" type="submit">Buscar</button>
        </form>

        {visiblePeople.length === 0 ? (
          <div className="empty-state">No hay personas visibles para este filtro o alcance.</div>
        ) : (
          <div className="grid admin-modules">
            {visiblePeople.map((person) => (
              <article className="entity-card admin-module" key={person.person_id}>
                <p className="entity-type">{personTypeLabel(person.person_type)}</p>
                <h2>{personName(person)}</h2>
                <p className="role-pill">{statusLabel(person.status)}</p>
                <p className="meta">{personScope(person)}</p>
                <div className="admin-actions">
                  <Link className="button button-secondary" href={`/admin/personas/${person.person_id}`}>Abrir ficha</Link>
                  {person.status !== 'deceased' && (
                    <Link className="button button-primary" href={`/admin/fallecimiento?person=${person.person_id}`}>Marcar fallecimiento</Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
