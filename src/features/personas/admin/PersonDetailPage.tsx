'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import CompletionIndicator from '@/components/admin/CompletionIndicator'
import EntitySectionCard from '@/components/admin/EntitySectionCard'
import SmartContextPanel from '@/components/admin/SmartContextPanel'
import { createClient } from '@/lib/supabase/client'
import { getAdminPersonDetail, type AdminPersonDetail } from '../services/person-admin-service'

function valueLabel(value: string | null | undefined) {
  return value && value.trim() ? value : 'No registrado'
}

function formatDate(value: string | null) {
  if (!value) return 'No registrada'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no válida'
  return new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: 'long', year: 'numeric' }).format(date)
}

function personTypeLabel(value: string | null) {
  return ({ bishop: 'Obispo', priest: 'Sacerdote', deacon: 'Diácono', religious: 'Religioso/a', layperson: 'Laico/a', seminarian: 'Seminarista' } as Record<string, string>)[value ?? ''] ?? 'Persona'
}

function statusLabel(value: string | null) {
  return ({ active: 'Activo/a', retired: 'Retirado/a', emeritus: 'Emérito', deceased: 'Fallecido/a', transferred: 'Trasladado/a', inactive: 'Inactivo/a', suspended: 'Suspendido/a' } as Record<string, string>)[value ?? ''] ?? valueLabel(value)
}

function priestTypeLabel(value: string | null) {
  return value === 'diocesan' ? 'Sacerdote diocesano' : value === 'religious' ? 'Sacerdote religioso' : valueLabel(value)
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="admin-detail-row"><span>{label}</span><strong>{value}</strong></div>
}

export default function PersonDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [person, setPerson] = useState<AdminPersonDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data, error: authError } = await supabase.auth.getUser()
      if (authError || !data.user) {
        router.replace('/admin/login')
        return
      }
      try {
        setPerson(await getAdminPersonDetail(supabase, params.id))
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la ficha.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id, router])

  const completion = useMemo(() => {
    if (!person) return { completed: 0, total: 1, missing: [] as string[] }
    const fields: Array<[string, string | null | undefined]> = [
      ['Nombre visible', person.display_name], ['Tipo de persona', person.person_type], ['Estado', person.status],
      ['Fecha de nacimiento', person.birth_date], ['Lugar de nacimiento', person.birth_place], ['Biografía pública', person.biography_public],
      ['Servicio actual', person.current_entity_name ?? person.current_pastoral_entity_name], ['Incardinación', person.incardination_entity_name], ['Estado canónico', person.canonical_status],
    ]
    const missing = fields.filter(([, fieldValue]) => !fieldValue?.trim()).map(([field]) => field)
    return { completed: fields.length - missing.length, total: fields.length, missing }
  }, [person])

  if (loading) return <main className="container"><div className="empty-state">Cargando ficha...</div></main>
  if (error) return <main className="container"><div className="error-box">{error}</div></main>
  if (!person) return <main className="container dashboard-page"><div className="detail-backlink"><Link href="/admin/personas">← Volver a personas</Link></div><div className="empty-state">No tienes acceso a esta persona o no existe.</div></main>

  const editHref = `/admin/personas/${person.person_id}/editar`
  const assignmentHref = `/admin/asignaciones?person=${person.person_id}`
  const deathHref = `/admin/fallecimiento?person=${person.person_id}`

  return (
    <main className="container dashboard-page admin-entity-page" id="top">
      <div className="admin-entity-breadcrumbs"><Link href="/admin/personas">Personas</Link><span>›</span><span>{personTypeLabel(person.person_type)}</span><span>›</span><strong>Ficha</strong></div>
      <section className="card admin-entity-header">
        <div className="admin-entity-identity">
          <div className="admin-entity-avatar" aria-hidden="true">{person.photo_url ? <img alt="" src={person.photo_url} /> : <span>{person.display_name?.slice(0, 1).toUpperCase() ?? 'P'}</span>}</div>
          <div><p className="eyebrow">Ficha administrativa</p><h1>{valueLabel(person.display_name)}</h1><div className="role-list admin-role-list"><span className="role-pill">{personTypeLabel(person.person_type)}</span><span className="role-pill">{statusLabel(person.status)}</span>{person.priest_type && <span className="role-pill">{priestTypeLabel(person.priest_type)}</span>}</div><p className="meta">{valueLabel(person.current_entity_name ?? person.current_pastoral_entity_name ?? person.incardination_entity_name)}</p></div>
        </div>
        <div className="admin-entity-header-actions">{person.can_update_proposal && <Link className="button button-primary" href={editHref}>Editar ficha</Link>}<Link className="button button-secondary" href={assignmentHref}>Nuevo nombramiento</Link></div>
      </section>
      <nav className="admin-entity-tabs" aria-label="Secciones de la ficha"><a href="#resumen">Resumen</a><a href="#personales">Datos personales</a><a href="#clericales">Datos clericales</a><a href="#servicio">Servicio</a><a href="#acciones">Acciones</a></nav>
      <div className="admin-entity-layout">
        <div className="admin-entity-main">
          <section id="resumen" className="admin-entity-summary-grid"><CompletionIndicator completed={completion.completed} total={completion.total} missing={completion.missing} /><div className="card admin-entity-summary-card"><p className="eyebrow">Estado actual</p><h2>{statusLabel(person.status)}</h2><p className="meta">{personTypeLabel(person.person_type)} · {priestTypeLabel(person.priest_type)}</p></div><div className="card admin-entity-summary-card"><p className="eyebrow">Servicio visible</p><h2>{valueLabel(person.current_entity_name ?? person.current_pastoral_entity_name)}</h2><p className="meta">Incardinación: {valueLabel(person.incardination_entity_name)}</p></div></section>
          <div id="personales"><EntitySectionCard eyebrow="Identidad" title="Datos personales" description="Información general y pública de la persona." editHref={person.can_update_proposal ? editHref : undefined}><DetailRow label="Nombre visible" value={valueLabel(person.display_name)} /><DetailRow label="Tipo de persona" value={personTypeLabel(person.person_type)} /><DetailRow label="Fecha de nacimiento" value={formatDate(person.birth_date)} /><DetailRow label="Lugar de nacimiento" value={valueLabel(person.birth_place)} /><DetailRow label="Biografía pública" value={valueLabel(person.biography_public)} />{person.death_date && <DetailRow label="Fecha de fallecimiento" value={formatDate(person.death_date)} />}</EntitySectionCard></div>
          <div id="clericales"><EntitySectionCard eyebrow="Ministerio" title="Datos clericales" description="Estado canónico, pertenencia e información ministerial." editHref={person.can_update_proposal ? editHref : undefined}><DetailRow label="Tipo de sacerdote" value={priestTypeLabel(person.priest_type)} /><DetailRow label="Tipo de diácono" value={valueLabel(person.deacon_type)} /><DetailRow label="Estado canónico" value={valueLabel(person.canonical_status)} /><DetailRow label="Incardinación" value={valueLabel(person.incardination_entity_name)} /><DetailRow label="Instituto religioso" value={valueLabel(person.religious_institute_name)} /></EntitySectionCard></div>
          <div id="servicio"><EntitySectionCard eyebrow="Asignación actual" title="Servicio y relaciones" description="Las operaciones históricas se registran mediante nombramientos." editHref={assignmentHref} editLabel="Gestionar nombramientos"><DetailRow label="Entidad de servicio" value={valueLabel(person.current_entity_name)} /><DetailRow label="Entidad pastoral" value={valueLabel(person.current_pastoral_entity_name)} /><DetailRow label="Incardinación" value={valueLabel(person.incardination_entity_name)} /></EntitySectionCard></div>
          <section className="card admin-entity-quick-actions" id="acciones"><div className="section-heading"><div><p className="eyebrow">Operaciones</p><h2>Acciones sobre la ficha</h2><p className="meta">Las acciones históricas generan trazabilidad.</p></div></div><div className="admin-actions"><Link className="button button-primary" href={assignmentHref}>Registrar nombramiento</Link>{person.status !== 'deceased' && <Link className="button button-secondary" href={deathHref}>Registrar fallecimiento</Link>}{person.can_update_proposal && <Link className="button button-secondary" href={editHref}>Proponer corrección</Link>}</div></section>
        </div>
        <SmartContextPanel title="Contexto de la persona"><CompletionIndicator completed={completion.completed} total={completion.total} missing={completion.missing} /><div className="admin-context-block"><span>Cargo o servicio visible</span><strong>{valueLabel(person.current_entity_name ?? person.current_pastoral_entity_name)}</strong></div><div className="admin-context-block"><span>Pertenencia</span><strong>{valueLabel(person.incardination_entity_name ?? person.religious_institute_name)}</strong></div><div className="admin-context-block"><span>Alertas</span><strong>{completion.missing.length > 0 ? `${completion.missing.length} datos pendientes` : 'Sin alertas principales'}</strong></div></SmartContextPanel>
      </div>
    </main>
  )
}
