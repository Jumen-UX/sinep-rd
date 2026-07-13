'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import CompletionIndicator from '@/components/admin/CompletionIndicator'
import EntitySectionCard from '@/components/admin/EntitySectionCard'
import SmartContextPanel from '@/components/admin/SmartContextPanel'
import { createClient } from '@/lib/supabase/client'
import PersonAssignmentHistory, { type AssignmentHistoryItem } from './PersonAssignmentHistory'
import PersonCanonicalTimeline from './PersonCanonicalTimeline'
import { getAdminPersonDetail, type AdminPersonDetail } from '../services/person-admin-service'

function valueLabel(value: string | null | undefined) {
  return value && value.trim() ? value : 'No registrado'
}

function formatDate(value: string | null) {
  if (!value) return 'No registrada'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return 'Fecha no válida'
  return new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: 'long', year: 'numeric' }).format(date)
}

function personTypeLabel(value: string | null | undefined) {
  return ({ bishop: 'Obispo', priest: 'Sacerdote', deacon: 'Diácono', religious: 'Religioso/a', layperson: 'Laico/a', seminarian: 'Seminarista' } as Record<string, string>)[value ?? ''] ?? 'Persona'
}

function statusLabel(value: string | null) {
  return ({ active: 'Activo/a', retired: 'Retirado/a', emeritus: 'Emérito', deceased: 'Fallecido/a', transferred: 'Trasladado/a', inactive: 'Inactivo/a', suspended: 'Suspendido/a', restricted: 'Con restricciones', lost_clerical_state: 'Pérdida del estado clerical', unknown: 'No identificado' } as Record<string, string>)[value ?? ''] ?? valueLabel(value)
}

function priestTypeLabel(value: string | null) {
  return value === 'diocesan' ? 'Sacerdote diocesano' : value === 'religious' ? 'Sacerdote religioso' : valueLabel(value)
}

function ordinationDegreeLabel(value: string | null | undefined) {
  return ({ diaconate: 'Diaconado', presbyterate: 'Presbiterado', episcopate: 'Episcopado' } as Record<string, string>)[value ?? ''] ?? 'Sin ordenación registrada'
}

function incardinationKindLabel(value: string | null | undefined) {
  return ({ diocesan: 'Diocesana', religious_institute: 'Instituto religioso', society_apostolic_life: 'Sociedad de vida apostólica', personal_prelature: 'Prelatura personal', military_ordinariate: 'Ordinariato militar', other: 'Otra', unknown: 'No identificada' } as Record<string, string>)[value ?? ''] ?? valueLabel(value)
}

function episcopalRoleLabel(value: string) {
  return ({ diocesan: 'Obispo diocesano', auxiliary: 'Obispo auxiliar', coadjutor: 'Obispo coadjutor', titular: 'Obispo titular', emeritus: 'Obispo emérito', apostolic_administrator: 'Administrador apostólico', apostolic_vicar: 'Vicario apostólico', apostolic_prefect: 'Prefecto apostólico', other: 'Otra función episcopal' } as Record<string, string>)[value] ?? value
}

function dignityLabel(value: string) {
  return ({ archbishop: 'Arzobispo', metropolitan: 'Metropolitano', cardinal: 'Cardenal', monsignor: 'Monseñor', patriarch: 'Patriarca', major_archbishop: 'Arzobispo mayor', other: 'Otra dignidad' } as Record<string, string>)[value] ?? value
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="admin-detail-row"><span>{label}</span><strong>{value}</strong></div>
}

export default function PersonDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [person, setPerson] = useState<AdminPersonDetail | null>(null)
  const [assignments, setAssignments] = useState<AssignmentHistoryItem[]>([])
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
      ['Nombre visible', person.display_name],
      ['Condición sacramental', person.ecclesial_condition],
      ['Estado', person.status],
      ['Fecha de nacimiento', person.birth_date],
      ['Lugar de nacimiento', person.birth_place],
      ['Biografía pública', person.biography_public],
      ['Servicio actual', person.current_entity_name ?? person.current_organization_unit_name],
    ]

    if (person.ecclesial_condition === 'cleric') {
      fields.push(
        ['Estado canónico', person.canonical_status],
        ['Incardinación', person.incardination_entity_name ?? person.incardination_institute_name],
      )
    }

    const missing = fields.filter(([, fieldValue]) => !fieldValue?.trim()).map(([field]) => field)
    return { completed: fields.length - missing.length, total: fields.length, missing }
  }, [person])

  if (loading) return <main className="container"><div className="empty-state">Cargando ficha...</div></main>
  if (error) return <main className="container"><div className="error-box">{error}</div></main>
  if (!person) return <main className="container dashboard-page"><div className="detail-backlink"><Link href="/admin/personas">← Volver a personas</Link></div><div className="empty-state">No tienes acceso a esta persona o no existe.</div></main>

  const effectiveType = person.effective_person_type ?? person.person_type
  const isOrdained = person.ecclesial_condition === 'cleric'
  const currentEpiscopalRole = person.episcopal_roles[0] ?? null
  const dignityNames = person.ecclesiastical_dignities.map((item) => dignityLabel(item.dignity_type)).join(', ')
  const editHref = `/admin/personas/${person.person_id}/editar`
  const assignmentHref = `/admin/asignaciones?person=${person.person_id}`
  const deathHref = `/admin/fallecimiento?person=${person.person_id}`
  const totalTimelineItems = person.ordination_history.length + person.clerical_history.length + assignments.length

  return (
    <main className="container dashboard-page admin-entity-page" id="top">
      <div className="admin-entity-breadcrumbs"><Link href="/admin/personas">Personas</Link><span>›</span><span>{personTypeLabel(effectiveType)}</span><span>›</span><strong>Ficha</strong></div>

      <section className="card admin-entity-header">
        <div className="admin-entity-identity">
          <div className="admin-entity-avatar" aria-hidden="true">{person.photo_url ? <img alt="" src={person.photo_url} /> : <span>{person.display_name?.slice(0, 1).toUpperCase() ?? 'P'}</span>}</div>
          <div>
            <p className="eyebrow">Ficha administrativa</p>
            <h1>{valueLabel(person.display_name)}</h1>
            <div className="role-list admin-role-list">
              <span className="role-pill">{personTypeLabel(effectiveType)}</span>
              <span className="role-pill">{statusLabel(person.status)}</span>
              {isOrdained && <span className="role-pill">{ordinationDegreeLabel(person.highest_ordination_degree)}</span>}
              {person.priest_type && <span className="role-pill">{priestTypeLabel(person.priest_type)}</span>}
              {currentEpiscopalRole && <span className="role-pill">{episcopalRoleLabel(currentEpiscopalRole.role_type)}</span>}
            </div>
            <p className="meta">{valueLabel(person.current_entity_name ?? person.current_organization_unit_name ?? person.incardination_entity_name ?? person.incardination_institute_name)}</p>
          </div>
        </div>
        <div className="admin-entity-header-actions">{person.can_update_proposal && <Link className="button button-primary" href={editHref}>Editar ficha</Link>}<Link className="button button-secondary" href={assignmentHref}>Nuevo nombramiento</Link></div>
      </section>

      <nav className="admin-entity-tabs" aria-label="Secciones de la ficha"><a href="#resumen">Resumen</a><a href="#personales">Datos personales</a><a href="#orden">Orden sagrado</a><a href="#clericales">Situación canónica</a><a href="#servicio">Servicio</a><a href="#nombramientos">Nombramientos</a><a href="#historial">Línea de tiempo</a><a href="#acciones">Acciones</a></nav>

      <div className="admin-entity-layout">
        <div className="admin-entity-main">
          <section id="resumen" className="admin-entity-summary-grid">
            <CompletionIndicator completed={completion.completed} total={completion.total} missing={completion.missing} />
            <div className="card admin-entity-summary-card"><p className="eyebrow">Condición sacramental</p><h2>{isOrdained ? ordinationDegreeLabel(person.highest_ordination_degree) : 'Sin ordenación registrada'}</h2><p className="meta">{isOrdained ? 'Grado más alto recibido' : 'Condición laical derivada'}</p></div>
            <div className="card admin-entity-summary-card"><p className="eyebrow">Servicio visible</p><h2>{valueLabel(person.current_entity_name ?? person.current_organization_unit_name)}</h2><p className="meta">Incardinación: {valueLabel(person.incardination_entity_name ?? person.incardination_institute_name)}</p></div>
          </section>

          <div id="personales">
            <EntitySectionCard eyebrow="Identidad" title="Datos personales" description="La identidad permanece estable aunque cambien la ordenación, los oficios o el estado canónico." editHref={person.can_update_proposal ? editHref : undefined}>
              <DetailRow label="Nombre visible" value={valueLabel(person.display_name)} />
              <DetailRow label="Clasificación derivada" value={personTypeLabel(effectiveType)} />
              <DetailRow label="Fecha de nacimiento" value={formatDate(person.birth_date)} />
              <DetailRow label="Lugar de nacimiento" value={valueLabel(person.birth_place)} />
              <DetailRow label="Biografía pública" value={valueLabel(person.biography_public)} />
              {person.death_date && <DetailRow label="Fecha de fallecimiento" value={formatDate(person.death_date)} />}
            </EntitySectionCard>
          </div>

          <div id="orden">
            <EntitySectionCard eyebrow="Historia sacramental" title="Grados del Orden" description="Diaconado, presbiterado y episcopado son eventos acumulativos de la misma persona.">
              {person.ordination_history.length === 0 ? (
                <p className="meta">No hay ordenaciones registradas.</p>
              ) : person.ordination_history.map((ordination) => (
                <DetailRow
                  key={ordination.degree}
                  label={ordinationDegreeLabel(ordination.degree)}
                  value={`${formatDate(ordination.ordination_date)} · ${valueLabel(ordination.ordination_place)} · ${valueLabel(ordination.verification_status)}`}
                />
              ))}
            </EntitySectionCard>
          </div>

          <div id="clericales">
            <EntitySectionCard eyebrow="Dimensiones canónicas" title="Situación canónica y pertenencia" description="El estado, la incardinación, la función episcopal y las dignidades son independientes del grado sacramental." editHref={person.can_update_proposal ? editHref : undefined}>
              <DetailRow label="Estado canónico" value={isOrdained ? statusLabel(person.canonical_status) : 'No aplica'} />
              <DetailRow label="Tipo de incardinación" value={isOrdained ? incardinationKindLabel(person.incardination_kind) : 'No aplica'} />
              <DetailRow label="Incardinación o pertenencia" value={isOrdained ? valueLabel(person.incardination_entity_name ?? person.incardination_institute_name) : 'No aplica'} />
              <DetailRow label="Tipo de sacerdote" value={priestTypeLabel(person.priest_type)} />
              <DetailRow label="Tipo de diácono" value={valueLabel(person.deacon_type)} />
              <DetailRow label="Instituto religioso" value={valueLabel(person.religious_institute_name)} />
              <DetailRow label="Función episcopal vigente" value={currentEpiscopalRole ? `${episcopalRoleLabel(currentEpiscopalRole.role_type)} · ${valueLabel(currentEpiscopalRole.title_see_name ?? currentEpiscopalRole.jurisdiction_name)}` : 'No registrada'} />
              <DetailRow label="Dignidades vigentes" value={dignityNames || 'No registradas'} />
            </EntitySectionCard>
          </div>

          <div id="servicio">
            <EntitySectionCard eyebrow="Asignación actual" title="Servicio y relaciones" description="Los oficios y nombramientos tienen su propia vigencia e historial." editHref={assignmentHref} editLabel="Gestionar nombramientos">
              <DetailRow label="Entidad de servicio" value={valueLabel(person.current_entity_name)} />
              <DetailRow label="Unidad organizativa" value={valueLabel(person.current_organization_unit_name)} />
              <DetailRow label="Incardinación" value={valueLabel(person.incardination_entity_name ?? person.incardination_institute_name)} />
              <DetailRow label="Cambios canónicos registrados" value={`${person.clerical_history.length}`} />
            </EntitySectionCard>
          </div>

          <PersonAssignmentHistory personId={person.person_id} onItemsChange={setAssignments} />
          <PersonCanonicalTimeline person={person} assignments={assignments} />

          <section className="card admin-entity-quick-actions" id="acciones">
            <div className="section-heading"><div><p className="eyebrow">Operaciones</p><h2>Acciones sobre la ficha</h2><p className="meta">Las acciones históricas generan trazabilidad y no reemplazan la identidad personal.</p></div></div>
            <div className="admin-actions"><Link className="button button-primary" href={assignmentHref}>Registrar nombramiento</Link>{person.status !== 'deceased' && <Link className="button button-secondary" href={deathHref}>Registrar fallecimiento</Link>}{person.can_update_proposal && <Link className="button button-secondary" href={editHref}>Proponer corrección</Link>}</div>
          </section>
        </div>

        <SmartContextPanel title="Contexto de la persona">
          <CompletionIndicator completed={completion.completed} total={completion.total} missing={completion.missing} />
          <div className="admin-context-block"><span>Grado más alto recibido</span><strong>{ordinationDegreeLabel(person.highest_ordination_degree)}</strong></div>
          <div className="admin-context-block"><span>Cargo o servicio visible</span><strong>{valueLabel(person.current_entity_name ?? person.current_organization_unit_name)}</strong></div>
          <div className="admin-context-block"><span>Pertenencia</span><strong>{valueLabel(person.incardination_entity_name ?? person.incardination_institute_name ?? person.religious_institute_name)}</strong></div>
          <div className="admin-context-block"><span>Nombramientos</span><strong>{assignments.length}</strong></div>
          <div className="admin-context-block"><span>Hitos de trayectoria</span><strong>{totalTimelineItems}</strong></div>
          <div className="admin-context-block"><span>Alertas</span><strong>{completion.missing.length > 0 ? `${completion.missing.length} datos pendientes` : 'Sin alertas principales'}</strong></div>
        </SmartContextPanel>
      </div>
    </main>
  )
}
