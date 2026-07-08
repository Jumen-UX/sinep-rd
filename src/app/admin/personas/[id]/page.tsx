'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type PersonDetail = {
  person_id: string
  display_name: string | null
  person_type: string | null
  status: string | null
  birth_date: string | null
  birth_place: string | null
  death_date: string | null
  photo_url: string | null
  biography_public: string | null
  current_entity_name: string | null
  current_pastoral_entity_name: string | null
  incardination_entity_name: string | null
  priest_type: string | null
  deacon_type: string | null
  canonical_status: string | null
  religious_institute_name: string | null
  can_update_proposal: boolean
  can_approve: boolean
}

function label(value: string | null) {
  return value && value.trim() ? value : 'No registrado'
}

function formatDate(value: string | null) {
  if (!value) return 'No registrada'

  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
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

export default function AdminPersonDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [person, setPerson] = useState<PersonDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function loadPerson() {
      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (userError || !userData.user) {
        router.replace('/admin/login')
        return
      }

      const { data, error: detailError } = await supabase.rpc('admin_get_person_detail', {
        p_person_id: params.id,
      })

      if (detailError) {
        setError(detailError.message)
        setLoading(false)
        return
      }

      const firstRow = Array.isArray(data) ? data[0] : null
      setPerson((firstRow ?? null) as PersonDetail | null)
      setLoading(false)
    }

    loadPerson()
  }, [params.id, router])

  if (loading) return <main className="container"><div className="empty-state">Cargando ficha...</div></main>

  if (error) {
    return (
      <main className="container">
        <div className="error-box">{error}</div>
      </main>
    )
  }

  if (!person) {
    return (
      <main className="container dashboard-page">
        <div className="detail-backlink"><Link href="/admin/personas">← Volver a personas</Link></div>
        <div className="empty-state">No tienes acceso a esta persona o no existe.</div>
      </main>
    )
  }

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink"><Link href="/admin/personas">← Volver a personas</Link></div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Ficha administrativa</p>
          <h1>{label(person.display_name)}</h1>
          <p className="lead">{personTypeLabel(person.person_type)} · {label(person.status)}</p>
        </div>
      </section>

      <section className="grid two-panel-grid">
        <article className="card admin-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Datos públicos</p>
              <h2>Información general</h2>
            </div>
          </div>
          <p className="meta">Nacimiento: {formatDate(person.birth_date)}</p>
          <p className="meta">Lugar: {label(person.birth_place)}</p>
          <p className="meta">Fallecimiento: {formatDate(person.death_date)}</p>
          <p className="meta">Biografía: {label(person.biography_public)}</p>
        </article>

        <article className="card admin-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Alcance visible</p>
              <h2>Relación eclesial</h2>
            </div>
          </div>
          <p className="meta">Servicio actual: {label(person.current_entity_name)}</p>
          <p className="meta">Entidad pastoral: {label(person.current_pastoral_entity_name)}</p>
          <p className="meta">Incardinación: {label(person.incardination_entity_name)}</p>
          <p className="meta">Estado canónico: {label(person.canonical_status)}</p>
          <p className="meta">Tipo de sacerdote: {label(person.priest_type)}</p>
          <p className="meta">Tipo de diácono: {label(person.deacon_type)}</p>
          <p className="meta">Instituto religioso: {label(person.religious_institute_name)}</p>
        </article>
      </section>

      <section className="card admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Acciones</p>
            <h2>Permisos disponibles</h2>
            <p className="meta">Estas acciones se muestran según permisos efectivos y alcance.</p>
          </div>
        </div>

        <div className="admin-actions">
          {person.can_update_proposal && <Link className="button button-primary" href={`/admin/personas/${person.person_id}/editar`}>Proponer cambios</Link>}
          {person.can_approve && <Link className="button button-secondary" href="/admin/solicitudes">Revisar solicitudes</Link>}
          {person.status !== 'deceased' && <Link className="button button-secondary" href={`/admin/fallecimiento?person=${person.person_id}`}>Marcar fallecimiento</Link>}
        </div>
      </section>
    </main>
  )
}
