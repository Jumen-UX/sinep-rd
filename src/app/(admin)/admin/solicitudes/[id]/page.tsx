'use client'

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type JsonObject = Record<string, unknown>

type ChangeRequestDetail = {
  id: string
  target_table: string | null
  target_id: string | null
  action_type: string | null
  title: string | null
  description: string | null
  original_data: JsonObject | null
  proposed_data: JsonObject | null
  status: string | null
  submitted_by_name: string | null
  submitted_by_email: string | null
  submitted_at: string | null
  created_at: string | null
  can_review: boolean
}

const fieldLabels: Record<string, string> = {
  display_name: 'Nombre visible',
  status: 'Estado',
  birth_date: 'Fecha de nacimiento',
  birth_place: 'Lugar de nacimiento',
  death_date: 'Fecha de fallecimiento',
  biography_public: 'Biografía pública',
  priest_type: 'Vinculación presbiteral',
  deacon_type: 'Tipo de diácono',
  degree: 'Grado del Orden',
  ordination_date: 'Fecha de ordenación',
  ordination_place: 'Lugar de ordenación',
  principal_ordainer_person_id: 'Ordenante principal vinculado',
  principal_ordainer_name: 'Ordenante principal',
  assistant_ordainer_1_person_id: 'Primer asistente vinculado',
  assistant_ordainer_1_name: 'Primer ordenante asistente',
  assistant_ordainer_2_person_id: 'Segundo asistente vinculado',
  assistant_ordainer_2_name: 'Segundo ordenante asistente',
  status_type: 'Estado canónico',
  start_date: 'Inicio',
  end_date: 'Finalización',
  reason: 'Motivo',
  incardination_entity_id: 'Entidad de incardinación',
  institute_name: 'Instituto',
  incardination_kind: 'Tipo de incardinación',
  acquisition_method: 'Método de adquisición',
  end_reason: 'Motivo de cierre',
  religious_life_type: 'Tipo de vida consagrada',
  community_name: 'Instituto o comunidad',
  province_name: 'Provincia religiosa',
  profession_date: 'Fecha de profesión',
  canonical_status: 'Estado',
  role_type: 'Función episcopal',
  jurisdiction_entity_id: 'Jurisdicción',
  title_see_name: 'Sede titular',
  has_right_of_succession: 'Derecho de sucesión',
  dignity_type: 'Dignidad',
  title_text: 'Título visible',
  source_name: 'Fuente',
  source_url: 'Enlace de la fuente',
  source_checked_at: 'Fecha de consulta',
  verification_status: 'Verificación',
  visibility: 'Visibilidad',
}

const valueLabels: Record<string, string> = {
  keep: 'Conservar sin cambios',
  set: 'Registrar o actualizar',
  close: 'Cerrar vigencia',
  close_all: 'Cerrar todas las vigencias',
  diaconate: 'Diaconado',
  presbyterate: 'Presbiterado',
  episcopate: 'Episcopado',
  active: 'Activo',
  retired: 'Retirado',
  emeritus: 'Emérito',
  suspended: 'Suspendido',
  restricted: 'Restringido',
  inactive: 'Inactivo',
  deceased: 'Fallecido',
  lost_clerical_state: 'Pérdida del estado clerical',
  pending_review: 'Pendiente de revisión',
  verified: 'Verificado',
  disputed: 'En disputa',
  rejected: 'Rechazado',
  public: 'Público',
  internal: 'Interno',
  private: 'Privado',
  confidential: 'Confidencial',
  diocesan: 'Diocesano',
  religious: 'Religioso',
  permanent: 'Permanente',
  transitional: 'Transitorio',
  religious_institute: 'Instituto religioso',
  society_apostolic_life: 'Sociedad de vida apostólica',
  personal_prelature: 'Prelatura personal',
  military_ordinariate: 'Ordinariato militar',
  ordination: 'Ordenación',
  incardination: 'Incardinación',
  transfer: 'Traslado',
  profession: 'Profesión',
  reception: 'Recepción',
  brother: 'Hermano religioso',
  sister: 'Hermana religiosa',
  consecrated_lay: 'Laico/a consagrado/a',
  auxiliary: 'Obispo auxiliar',
  coadjutor: 'Obispo coadjutor',
  titular: 'Obispo titular',
  apostolic_administrator: 'Administrador apostólico',
  apostolic_vicar: 'Vicario apostólico',
  apostolic_prefect: 'Prefecto apostólico',
  archbishop: 'Arzobispo',
  metropolitan: 'Metropolitano',
  cardinal: 'Cardenal',
  monsignor: 'Monseñor',
  patriarch: 'Patriarca',
  major_archbishop: 'Arzobispo mayor',
  unknown: 'No identificado',
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha'

  return new Intl.DateTimeFormat('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function valueText(value: unknown) {
  if (value === null || value === undefined || value === '') return 'No registrado'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'string') return valueLabels[value] ?? value
  if (Array.isArray(value)) return `${value.length} registro(s)`
  if (isObject(value)) return 'Información estructurada'
  return String(value)
}

function fieldLabel(value: string) {
  return fieldLabels[value] ?? value.replaceAll('_', ' ')
}

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="card admin-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          {description && <p className="meta">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function ObjectDetails({
  value,
  omit = [],
}: {
  value: unknown
  omit?: string[]
}) {
  if (!isObject(value)) return <div className="empty-state">Sin información.</div>

  const entries = Object.entries(value).filter(
    ([key, item]) => !omit.includes(key) && item !== null && item !== undefined && item !== '',
  )

  if (entries.length === 0) return <div className="empty-state">Sin datos adicionales.</div>

  return (
    <dl className="detail-list">
      {entries.map(([key, item]) => (
        <div key={key}>
          <dt>{fieldLabel(key)}</dt>
          <dd>{valueText(item)}</dd>
        </div>
      ))}
    </dl>
  )
}

function IdentityComparison({ original, proposed }: { original: unknown; proposed: unknown }) {
  const originalObject = isObject(original) ? original : {}
  const proposedObject = isObject(proposed) ? proposed : {}
  const fields = Array.from(new Set([...Object.keys(originalObject), ...Object.keys(proposedObject)]))

  return (
    <div className="table-wrap">
      <table className="data-table dashboard-list-table">
        <thead><tr><th>Campo</th><th>Actual</th><th>Propuesto</th></tr></thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field}>
              <td><strong>{fieldLabel(field)}</strong></td>
              <td>{valueText(originalObject[field])}</td>
              <td>{valueText(proposedObject[field])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OperationCard({ title, value }: { title: string; value: JsonObject }) {
  return (
    <article className="entity-card admin-module">
      <p className="entity-type">{title}</p>
      <p className="meta"><strong>Operación:</strong> {valueText(value.mode)}</p>
      <ObjectDetails value={value} omit={['mode']} />
    </article>
  )
}

function CanonicalProposalReview({
  original,
  proposed,
}: {
  original: JsonObject
  proposed: JsonObject
}) {
  const ordinations = Array.isArray(proposed.ordinations)
    ? proposed.ordinations.filter((item) => isObject(item) && item.mode !== 'keep') as JsonObject[]
    : []
  const dignities = Array.isArray(proposed.dignities)
    ? proposed.dignities.filter((item) => isObject(item) && item.mode !== 'keep') as JsonObject[]
    : []
  const operations = [
    ['Estado canónico', proposed.canonical_status],
    ['Incardinación', proposed.incardination],
    ['Vida consagrada', proposed.religious_life],
    ['Función episcopal', proposed.episcopal_role],
  ] as const

  return (
    <>
      <Section eyebrow="Identidad" title="Datos personales" description="Los datos personales no determinan el grado del Orden.">
        <IdentityComparison original={original.identity} proposed={proposed.identity} />
      </Section>

      <Section eyebrow="Compatibilidad" title="Clasificaciones auxiliares" description="No modifican el tipo sacramental de la persona.">
        <IdentityComparison original={original.legacy_profile} proposed={proposed.legacy_profile} />
      </Section>

      <Section eyebrow="Sacramento" title="Operaciones sobre los grados del Orden">
        {ordinations.length === 0 ? (
          <div className="empty-state">No se proponen cambios de ordenación.</div>
        ) : (
          <div className="grid admin-modules">
            {ordinations.map((ordination, index) => (
              <OperationCard
                key={`${String(ordination.degree)}-${index}`}
                title={valueText(ordination.degree)}
                value={ordination}
              />
            ))}
          </div>
        )}
      </Section>

      <Section eyebrow="Dimensiones canónicas" title="Vigencias propuestas">
        <div className="grid admin-modules">
          {operations.map(([title, operation]) => (
            isObject(operation) && operation.mode !== 'keep'
              ? <OperationCard key={title} title={title} value={operation} />
              : null
          ))}
          {dignities.map((dignity, index) => (
            <OperationCard key={`${String(dignity.dignity_type)}-${index}`} title="Dignidad eclesiástica" value={dignity} />
          ))}
        </div>
        {!operations.some(([, operation]) => isObject(operation) && operation.mode !== 'keep')
          && dignities.length === 0
          && <div className="empty-state">No se proponen cambios de vigencia canónica.</div>}
      </Section>
    </>
  )
}

function GenericComparison({ item }: { item: ChangeRequestDetail }) {
  const fields = Object.keys(item.proposed_data ?? {})

  if (fields.length === 0) return <div className="empty-state">La solicitud no contiene campos propuestos.</div>

  return (
    <div className="grid admin-modules">
      {fields.map((field) => (
        <article className="entity-card admin-module" key={field}>
          <p className="entity-type">{fieldLabel(field)}</p>
          <p className="meta"><strong>Original:</strong> {valueText(item.original_data?.[field])}</p>
          <p className="meta"><strong>Propuesto:</strong> {valueText(item.proposed_data?.[field])}</p>
        </article>
      ))}
    </div>
  )
}

export default function ChangeRequestReviewPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [item, setItem] = useState<ChangeRequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  async function loadItem() {
    setLoading(true)
    setError(null)

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      router.replace('/admin/login')
      return
    }

    const { data, error: detailError } = await supabase.rpc('admin_get_change_request_detail', {
      p_change_request_id: params.id,
    })

    if (detailError) {
      setError(detailError.message)
      setLoading(false)
      return
    }

    const firstRow = Array.isArray(data) ? data[0] : null
    setItem((firstRow ?? null) as ChangeRequestDetail | null)
    setLoading(false)
  }

  useEffect(() => {
    loadItem()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  async function review(decision: 'approved' | 'rejected') {
    if (!item) return

    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: reviewError } = await supabase.rpc('admin_review_person_change_request', {
      p_change_request_id: item.id,
      p_decision: decision,
      p_rejection_reason: decision === 'rejected' ? rejectionReason : null,
    })

    if (reviewError) {
      setError(reviewError.message)
      setSaving(false)
      return
    }

    setNotice(decision === 'approved' ? 'Solicitud aprobada y aplicada.' : 'Solicitud rechazada.')
    setSaving(false)
    await loadItem()
  }

  function handleReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    review('rejected')
  }

  if (loading) return <main className="container"><div className="empty-state">Cargando solicitud...</div></main>

  if (!item) {
    return (
      <main className="container dashboard-page">
        <div className="detail-backlink"><Link href="/admin/solicitudes">← Volver a solicitudes</Link></div>
        <div className="empty-state">No tienes acceso a esta solicitud o no existe.</div>
      </main>
    )
  }

  const isCanonicalPersonProposal = item.proposed_data?.proposal_kind === 'canonical_person'
  const canDecide = item.can_review
    && item.target_table === 'persons'
    && ['pending_review', 'needs_changes'].includes(item.status ?? '')

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink"><Link href="/admin/solicitudes">← Volver a solicitudes</Link></div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Revisión de solicitud</p>
          <h1>{item.title ?? 'Solicitud de cambio'}</h1>
          <p className="lead">{item.description ?? 'Sin descripción adicional.'}</p>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {notice && <div className="success-box">{notice}</div>}

      <Section eyebrow="Resumen" title={valueText(item.status)}>
        <p className="meta"><strong>Tabla:</strong> {item.target_table ?? 'No definida'}</p>
        <p className="meta"><strong>Acción:</strong> {item.action_type ?? 'No definida'}</p>
        <p className="meta"><strong>Enviada por:</strong> {item.submitted_by_name ?? item.submitted_by_email ?? 'No indicado'}</p>
        <p className="meta"><strong>Fecha:</strong> {formatDate(item.submitted_at ?? item.created_at)}</p>
      </Section>

      {isCanonicalPersonProposal && item.original_data && item.proposed_data ? (
        <CanonicalProposalReview original={item.original_data} proposed={item.proposed_data} />
      ) : (
        <Section eyebrow="Comparación" title="Datos originales vs. propuesta">
          <GenericComparison item={item} />
        </Section>
      )}

      {canDecide && (
        <Section eyebrow="Decisión" title="Aprobar o rechazar" description="La aprobación aplica todas las dimensiones canónicas en una sola transacción y deja auditoría.">
          <div className="admin-actions">
            <button className="button button-primary" disabled={saving} type="button" onClick={() => review('approved')}>
              {saving ? 'Procesando...' : 'Aprobar y aplicar'}
            </button>
          </div>

          <form className="auth-form access-form" onSubmit={handleReject}>
            <label>Motivo de rechazo<textarea required rows={3} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} /></label>
            <button className="button button-secondary" disabled={saving} type="submit">
              {saving ? 'Procesando...' : 'Rechazar'}
            </button>
          </form>
        </Section>
      )}
    </main>
  )
}
