'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ChangeRequestDetail = {
  id: string
  target_table: string | null
  target_id: string | null
  action_type: string | null
  title: string | null
  description: string | null
  original_data: Record<string, unknown> | null
  proposed_data: Record<string, unknown> | null
  status: string | null
  submitted_by_name: string | null
  submitted_by_email: string | null
  submitted_at: string | null
  created_at: string | null
  can_review: boolean
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
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function fieldLabel(value: string) {
  const labels: Record<string, string> = {
    display_name: 'Nombre visible',
    person_type: 'Tipo de persona',
    status: 'Estado',
    birth_date: 'Fecha de nacimiento',
    birth_place: 'Lugar de nacimiento',
    death_date: 'Fecha de fallecimiento',
    biography_public: 'Biografía pública',
    priest_type: 'Tipo de sacerdote',
    deacon_type: 'Tipo de diácono',
    canonical_status: 'Estado canónico',
    religious_institute_name: 'Instituto religioso',
  }

  return labels[value] ?? value
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

  const fields = Object.keys(item?.proposed_data ?? {})

  if (loading) return <main className="container"><div className="empty-state">Cargando solicitud...</div></main>

  if (!item) {
    return (
      <main className="container dashboard-page">
        <div className="detail-backlink"><Link href="/admin/solicitudes">← Volver a solicitudes</Link></div>
        <div className="empty-state">No tienes acceso a esta solicitud o no existe.</div>
      </main>
    )
  }

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
      {notice && <div className="empty-state">{notice}</div>}

      <section className="card admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Resumen</p>
            <h2>{item.status ?? 'Sin estado'}</h2>
          </div>
        </div>
        <p className="meta"><strong>Tabla:</strong> {item.target_table ?? 'No definida'}</p>
        <p className="meta"><strong>Acción:</strong> {item.action_type ?? 'No definida'}</p>
        <p className="meta"><strong>Enviada por:</strong> {item.submitted_by_name ?? item.submitted_by_email ?? 'No indicado'}</p>
        <p className="meta"><strong>Fecha:</strong> {formatDate(item.submitted_at ?? item.created_at)}</p>
      </section>

      <section className="card admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Comparación</p>
            <h2>Datos originales vs. propuesta</h2>
          </div>
        </div>

        {fields.length === 0 ? (
          <div className="empty-state">La solicitud no contiene campos propuestos.</div>
        ) : (
          <div className="grid admin-modules">
            {fields.map((field) => (
              <article className="entity-card admin-module" key={field}>
                <p className="entity-type">{fieldLabel(field)}</p>
                <p className="meta"><strong>Original:</strong> {valueText(item.original_data?.[field])}</p>
                <p className="meta"><strong>Propuesto:</strong> {valueText(item.proposed_data?.[field])}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {item.can_review && item.target_table === 'persons' && ['submitted', 'pending_review', 'in_review'].includes(item.status ?? '') && (
        <section className="card admin-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Decisión</p>
              <h2>Aprobar o rechazar</h2>
              <p className="meta">Aprobar aplicará los cambios a la ficha real y dejará auditoría.</p>
            </div>
          </div>

          <div className="admin-actions">
            <button className="button button-primary" disabled={saving} type="button" onClick={() => review('approved')}>
              {saving ? 'Procesando...' : 'Aprobar y aplicar'}
            </button>
          </div>

          <form className="auth-form access-form" onSubmit={handleReject}>
            <label>
              Motivo de rechazo
              <textarea required rows={3} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} />
            </label>
            <button className="button button-secondary" disabled={saving} type="submit">
              {saving ? 'Procesando...' : 'Rechazar'}
            </button>
          </form>
        </section>
      )}
    </main>
  )
}
