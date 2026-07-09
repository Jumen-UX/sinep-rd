'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import CompletionIndicator from '@/components/admin/CompletionIndicator'
import EntitySectionCard from '@/components/admin/EntitySectionCard'
import SmartContextPanel from '@/components/admin/SmartContextPanel'
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
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no válida'
  return new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: 'long', year: 'numeric' }).format(date)
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
  return label(value)
}

function priestTypeLabel(value: string | null) {
  if (value === 'diocesan') return 'Sacerdote diocesano'
  if (value === 'religious') return 'Sacerdote religioso'
  return label(value)
}

function DetailRow({ label: rowLabel, value }: { label: string; value: string }) {
  return (
    <div className="admin-detail-row">
      <span>{rowLabel}</span>
      <strong>{value}</strong>
    </div>
  )
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

      const { data, error: detailError } = await supabase.rpc('admin_get_person_detail', { p_person_id: params.id })
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

  const completion = useMemo(() => {
    if (!person) return { completed: 0, total: 1, missing: [] as string[] }
    const fields = [
      ['Nombre visible', person.display_name],
      ['Tipo de persona', person.person_type],
      ['Estado', person.status],
      ['Fecha de nacimiento', person.birth_date],
      ['Lugar de nacimiento', person.birth_place],
      ['Biografía pública', person.biography_public],
      ['Servicio actual', person.current_entity_name ?? person.current_pastoral_entity_name],
      ['Incardinación', person.incardination_entity_name],
      ['Estado canónico', person.canonical_status],
    ] as Array<[string, string | null]>
    const missing = fields.filter(([, value]) => !value || !value.trim()).map(([field]) => field)
    return { completed: fields.length - missing.length, total: fields.length, missing }
  }, [person])

  if (loading) return <main className="container"><div className="empty-state">Cargando ficha...</div></main>
  if (error) return <main className="container"><div className="error-box">{error}</div></main>

  if (!person) {
    return (
      <main className="container dashboard-page">
        <div className="detail-backlink"><Link href="/admin/personas">← Volver a personas</Link></div>
        <div className="empty-state">No tienes acceso a esta persona o no existe.</div>
      </main>
    )
  }

  const editHref = `/admin/personas/${person.person_id}/editar`
  const assignmentHref = `/admin/asignaciones?person=${person.person_id}`
  const deathHref = `/admin/fallecimiento?person=${person.person_id}`

  return (
    <main className="container dashboard-page admin-entity-page" id="top">
      <div className="admin-entity-breadcrumbs">
        <Link href="/admin/personas">Personas</Link>
        <span>›</span>
        <span>{personTypeLabel(person.person_type)}</span>
        <span>›</span>
        <strong>Ficha</strong>
      </div>

      <section className="card admin-entity-header">
        <div className="admin-entity-identity">
          <div className="admin-entity-avatar" aria-hidden="true">
            {person.photo_url ? <img alt="" src={person.photo_url} /> : <span>{person.display_name?.slice(0, 1).toUpperCase() ?? 'P'}</span>}
          </div>
          <div>
            <p className="eyebrow">Ficha administrativa</p>
            <h1>{label(person.display_name)}</h1>
            <div className="role-list admin-role-list">
              <span className="role-pill">{personTypeLabel(person.person_type)}</span>
              <span className="role-pill">{statusLabel(person.status)}</span>
              {person.priest_type && <span className="role-pill">{priestTypeLabel(person.priest_type)}</span>}
            </div>
            <p className="meta">{label(person.current_entity_name ?? person.current_pastoral_entity_name ?? person.incardination_entity_name)}</p>
          </div>
        </div>
        <div className="admin-entity-header-actions">
          {person.can_update_proposal && <Link className="button button-primary" href={editHref}>Editar ficha</Link>}
          <Link className="button button-secondary" href={assignmentHref}>Nuevo nombramiento</Link>
          <Link className="button button-secondary" href={`/personas/${person.person_id}`}>Ver ficha pública</Link>
        </div>
      </section>

      <nav className="admin-entity-tabs" aria-label="Secciones de la ficha">
        <a href="#resumen">Resumen</a>
        <a href="#personales">Datos personales</a>
        <a href="#clericales">Datos clericales</a>
        <a href="#servicio">Servicio</a>
        <a href="#acciones">Acciones</a>
      </nav>

      <div className="admin-entity-layout">
        <div className="admin-entity-main">
          <section id="resumen" className="admin-entity-summary-grid">
            <CompletionIndicator completed={completion.completed} total={completion.total} missing={completion.missing} />
            <div className="card admin-entity-summary-card">
              <p className="eyebrow">Estado actual</p>
              <h2>{statusLabel(person.status)}</h2>
              <p className="meta">{personTypeLabel(person.person_type)} · {priestTypeLabel(person.priest_type)}</p>
            </div>
            <div className="card admin-entity-summary-card">
              <p className="eyebrow">Servicio visible</p>
              <h2>{label(person.current_entity_name ?? person.current_pastoral_entity_name)}</h2>
              <p className="meta">Incardinación: {label(person.incardination_entity_name)}</p>
            </div>
          </section>

          <div id="personales">
            <EntitySectionCard eyebrow="Identidad" title="Datos personales" description="Información general y pública de la persona." editHref={person.can_update_proposal ? editHref : undefined}>
              <DetailRow label="Nombre visible" value={label(person.display_name)} />
              <DetailRow label="Tipo de persona" value={personTypeLabel(person.person_type)} />
              <DetailRow label="Fecha de nacimiento" value={formatDate(person.birth_date)} />
              <DetailRow label="Lugar de nacimiento" value={label(person.birth_place)} />
              <DetailRow label="Biografía pública" value={label(person.biography_public)} />
              {person.death_date && <DetailRow label="Fecha de fallecimiento" value={formatDate(person.death_date)} />}
            </EntitySectionCard>
          </div>

          <div id="clericales">
            <EntitySectionCard eyebrow="Ministerio" title="Datos clericales" description="Estado canónico, pertenencia e información ministerial." editHref={person.can_update_proposal ? editHref : undefined}>
              <DetailRow label="Tipo de sacerdote" value={priestTypeLabel(person.priest_type)} />
              <DetailRow label="Tipo de diácono" value={label(person.deacon_type)} />
              <DetailRow label="Estado canónico" value={label(person.canonical_status)} />
              <DetailRow label="Incardinación" value={label(person.incardination_entity_name)} />
              <DetailRow label="Instituto religioso" value={label(person.religious_institute_name)} />
            </EntitySectionCard>
          </div>

          <div id="servicio">
            <EntitySectionCard eyebrow="Asignación actual" title="Servicio y relaciones" description="Las operaciones históricas se registran mediante nombramientos, no sobrescribiendo campos." editHref={assignmentHref} editLabel="Gestionar nombramientos">
              <DetailRow label="Entidad de servicio" value={label(person.current_entity_name)} />
              <DetailRow label="Entidad pastoral" value={label(person.current_pastoral_entity_name)} />
              <DetailRow label="Incardinación" value={label(person.incardination_entity_name)} />
            </EntitySectionCard>
          </div>

          <section className="card admin-entity-quick-actions" id="acciones">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Operaciones</p>
                <h2>Acciones sobre la ficha</h2>
                <p className="meta">Las acciones históricas generan trazabilidad y no sustituyen datos silenciosamente.</p>
              </div>
            </div>
            <div className="admin-actions">
              <Link className="button button-primary" href={assignmentHref}>Registrar nombramiento</Link>
              {person.status !== 'deceased' && <Link className="button button-secondary" href={deathHref}>Registrar fallecimiento</Link>}
              {person.can_update_proposal && <Link className="button button-secondary" href={editHref}>Proponer corrección</Link>}
              {person.can_approve && <Link className="button button-secondary" href="/admin/solicitudes">Revisar solicitudes</Link>}
            </div>
          </section>
        </div>

        <SmartContextPanel title="Contexto de la persona">
          <CompletionIndicator completed={completion.completed} total={completion.total} missing={completion.missing} />
          <div className="admin-context-block">
            <span>Cargo o servicio visible</span>
            <strong>{label(person.current_entity_name ?? person.current_pastoral_entity_name)}</strong>
          </div>
          <div className="admin-context-block">
            <span>Pertenencia</span>
            <strong>{label(person.incardination_entity_name ?? person.religious_institute_name)}</strong>
          </div>
          <div className="admin-context-block">
            <span>Alertas</span>
            <strong>{completion.missing.length > 0 ? `${completion.missing.length} datos pendientes` : 'Sin alertas principales'}</strong>
          </div>
          <div className="admin-context-block">
            <span>Próxima acción sugerida</span>
            <strong>{completion.missing.length > 0 ? 'Completar la ficha' : 'Revisar nombramientos'}</strong>
          </div>
        </SmartContextPanel>
      </div>
    </main>
  )
}
