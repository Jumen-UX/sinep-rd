'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type PersonRow = {
  id: string
  display_name: string
  slug: string
  person_type: string | null
  status: string | null
  death_date: string | null
  birth_place: string | null
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

export default function AdminPersonasPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [people, setPeople] = useState<PersonRow[]>([])
  const [filter, setFilter] = useState<PersonFilter>('active')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function loadPeople() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/admin/login')
        return
      }

      const { data, error: peopleError } = await supabase
        .from('persons')
        .select('id,display_name,slug,person_type,status,death_date,birth_place')
        .order('display_name')

      if (peopleError) {
        setError(peopleError.message)
      } else {
        setPeople((data ?? []) as PersonRow[])
      }
      setLoading(false)
    }

    loadPeople()
  }, [router, supabase])

  const clergy = people.filter((person) => ['bishop', 'priest', 'deacon'].includes(person.person_type ?? ''))
  const religious = people.filter((person) => person.person_type === 'religious')
  const laypeople = people.filter((person) => person.person_type === 'layperson')
  const deceased = people.filter((person) => person.status === 'deceased')
  const active = people.filter((person) => person.status !== 'deceased')

  const visiblePeople = people.filter((person) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'active' && person.status !== 'deceased') ||
      (filter === 'clergy' && ['bishop', 'priest', 'deacon'].includes(person.person_type ?? '')) ||
      (filter === 'religious' && person.person_type === 'religious') ||
      (filter === 'layperson' && person.person_type === 'layperson') ||
      (filter === 'deceased' && person.status === 'deceased')

    const normalizedSearch = search.trim().toLowerCase()
    const matchesSearch = normalizedSearch.length === 0 || person.display_name.toLowerCase().includes(normalizedSearch)
    return matchesFilter && matchesSearch
  })

  if (loading) return <main className="container"><div className="empty-state">Cargando personas...</div></main>

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink"><Link href="/admin">← Volver al panel administrativo</Link></div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Administración de personas</p>
          <h1>Personas registradas</h1>
          <p className="lead">Busca una persona para ver su ficha pública o ejecutar acciones administrativas como marcar fallecimiento.</p>
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
          <strong>{people.length}</strong><span>Total</span>
        </button>
      </section>

      <section className="card admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Búsqueda</p>
            <h2>Listado administrativo</h2>
            <p className="meta">Las acciones sensibles siguen protegidas por autenticación y permisos administrativos.</p>
          </div>
        </div>

        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre" />

        {visiblePeople.length === 0 ? (
          <div className="empty-state">No hay personas para este filtro.</div>
        ) : (
          <div className="grid admin-modules">
            {visiblePeople.map((person) => (
              <article className="entity-card admin-module" key={person.id}>
                <p className="entity-type">{personTypeLabel(person.person_type)}</p>
                <h2>{person.display_name}</h2>
                <p className="role-pill">{statusLabel(person.status)}</p>
                <p className="meta">{person.birth_place ?? 'Lugar de nacimiento no indicado'}</p>
                <div className="admin-actions">
                  <Link className="button button-secondary" href={`/personas/${person.slug}`}>Ver ficha</Link>
                  {person.status !== 'deceased' && (
                    <Link className="button button-primary" href={`/admin/fallecimiento?person=${person.id}`}>Marcar fallecimiento</Link>
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
