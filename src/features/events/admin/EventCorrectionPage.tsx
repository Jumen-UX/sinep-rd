'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { hasEventAdminSession } from '../services/event-draft-admin-service'
import {
  correctCanonicalEvent,
  loadCanonicalEventRevisions,
  type CanonicalEventRevision,
  type CorrectableEventField,
} from '../services/event-correction-admin-service'
import { loadEventReview, type EventReviewData } from '../services/event-workflow-admin-service'

const styles = `
  .event-correction-page input,.event-correction-page select,.event-correction-page textarea{background:var(--surface,#fff);border:1px solid var(--border);border-radius:12px;color:inherit;font:inherit;padding:11px 12px;width:100%}
  .event-correction-page textarea{min-height:96px;resize:vertical}.correction-layout{align-items:start;display:grid;gap:18px;grid-template-columns:minmax(0,1fr) minmax(320px,.45fr)}
  .correction-grid,.revision-list,.revision-states{display:grid;gap:14px}.correction-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.field-wide{grid-column:1/-1}.field-label{display:grid;font-weight:800;gap:7px}.field-label span{font-size:13px}
  .revision-card,.state-card{background:#fff;border:1px solid var(--border);border-radius:16px;display:grid;gap:10px;padding:14px}.revision-states{grid-template-columns:repeat(2,minmax(0,1fr))}.state-card pre{font-size:12px;overflow:auto;white-space:pre-wrap}.revision-meta{align-items:center;display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between}
  .correction-notice{background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:14px}.button-row{display:flex;flex-wrap:wrap;gap:10px}@media(max-width:900px){.correction-layout,.correction-grid,.revision-states{grid-template-columns:1fr}}
`

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function toDateInput(value: string | null | undefined) {
  return value ?? ''
}

export default function EventCorrectionPage() {
  const params = useParams<{ eventId: string }>()
  const router = useRouter()
  const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId
  const supabase = useMemo(() => createClient(), [])
  const [review, setReview] = useState<EventReviewData | null>(null)
  const [revisions, setRevisions] = useState<CanonicalEventRevision[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [form, setForm] = useState({
    title: '', description: '', event_date: '', effective_date: '',
    source_name_text: '', source_url_text: '', source_checked_at: '',
    verification_status: 'pending_review', evidence_status: 'pendiente_documento',
  })

  async function loadPage() {
    setLoading(true)
    setError(null)
    try {
      if (!await hasEventAdminSession(supabase)) {
        router.replace('/admin/login')
        return
      }
      const [reviewData, revisionData] = await Promise.all([
        loadEventReview(supabase, eventId),
        loadCanonicalEventRevisions(supabase, eventId),
      ])
      setReview(reviewData)
      setRevisions(revisionData)
      if (reviewData?.event) {
        const event = reviewData.event
        setForm({
          title: event.title,
          description: event.description ?? '',
          event_date: toDateInput(event.event_date),
          effective_date: toDateInput(event.effective_date),
          source_name_text: event.source_name ?? '',
          source_url_text: event.source_url ?? '',
          source_checked_at: toDateInput(event.source_checked_at),
          verification_status: event.verification_status,
          evidence_status: event.evidence_status,
        })
      }
    } catch (loadError) {
      setError(errorMessage(loadError, 'No se pudo cargar el evento.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (eventId) void loadPage()
    // loadPage depends on the stable route id and client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submitCorrection() {
    if (!review?.event) return
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const current = review.event
      const changes: Partial<Record<CorrectableEventField, string | null>> = {}
      const candidateValues: Partial<Record<CorrectableEventField, string | null>> = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        event_date: form.event_date || null,
        effective_date: form.effective_date || null,
        source_name_text: form.source_name_text.trim() || null,
        source_url_text: form.source_url_text.trim() || null,
        source_checked_at: form.source_checked_at || null,
        verification_status: form.verification_status,
        evidence_status: form.evidence_status,
      }
      const currentValues: Partial<Record<CorrectableEventField, string | null>> = {
        title: current.title,
        description: current.description,
        event_date: current.event_date,
        effective_date: current.effective_date,
        source_name_text: current.source_name,
        source_url_text: current.source_url,
        source_checked_at: current.source_checked_at,
        verification_status: current.verification_status,
        evidence_status: current.evidence_status,
      }

      for (const [field, value] of Object.entries(candidateValues) as [CorrectableEventField, string | null][]) {
        if (value !== currentValues[field]) changes[field] = value
      }

      const result = await correctCanonicalEvent(supabase, {
        eventId,
        changeReason: reason,
        changes,
        sourceName,
        sourceUrl,
      })
      setReason('')
      setSuccess(`Corrección guardada como revisión ${result.revision_number}.`)
      await loadPage()
    } catch (saveError) {
      setError(errorMessage(saveError, 'No se pudo guardar la corrección.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className="container"><div className="empty-state">Cargando evento...</div></main>
  if (!review?.event) return <main className="container"><div className="error-box">No se encontró el evento.</div></main>

  return (
    <main className="container dashboard-page event-correction-page">
      <style>{styles}</style>
      <div className="detail-backlink"><Link href={`/admin/eventos/${eventId}/revisar`}>← Volver a la ficha del evento</Link></div>
      <section className="dashboard-hero card">
        <div><p className="eyebrow">Corrección administrativa</p><h1>{review.event.title}</h1><p className="lead">Corrige un error de registro sin crear un hecho histórico nuevo. Cada cambio conserva estado anterior, estado resultante, motivo, fuente, usuario y fecha.</p></div>
      </section>
      {error && <div className="error-box">{error}</div>}
      {success && <div className="success-box">{success}</div>}
      <div className="correction-notice"><strong>No uses esta pantalla para cambios institucionales reales.</strong><p className="meta">Un traslado, cambio de dependencia, supresión o nueva decisión debe registrarse como un evento nuevo.</p></div>

      <section className="correction-layout">
        <div className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Datos corregibles</p><h2>Editar el registro</h2></div></div>
          <div className="correction-grid">
            <label className="field-label field-wide"><span>Título</span><input value={form.title} onChange={(event) => updateField('title', event.target.value)} /></label>
            <label className="field-label field-wide"><span>Descripción</span><textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} /></label>
            <label className="field-label"><span>Fecha del evento</span><input type="date" value={form.event_date} onChange={(event) => updateField('event_date', event.target.value)} /></label>
            <label className="field-label"><span>Fecha efectiva</span><input type="date" value={form.effective_date} onChange={(event) => updateField('effective_date', event.target.value)} /></label>
            <label className="field-label"><span>Fuente registrada</span><input value={form.source_name_text} onChange={(event) => updateField('source_name_text', event.target.value)} /></label>
            <label className="field-label"><span>URL registrada</span><input type="url" value={form.source_url_text} onChange={(event) => updateField('source_url_text', event.target.value)} /></label>
            <label className="field-label"><span>Fecha de verificación</span><input type="date" value={form.source_checked_at} onChange={(event) => updateField('source_checked_at', event.target.value)} /></label>
            <label className="field-label"><span>Verificación</span><select value={form.verification_status} onChange={(event) => updateField('verification_status', event.target.value)}><option value="pending_review">Pendiente</option><option value="verified">Verificado</option><option value="rejected">Rechazado</option><option value="unverified">No verificado</option></select></label>
            <label className="field-label"><span>Evidencia</span><select value={form.evidence_status} onChange={(event) => updateField('evidence_status', event.target.value)}><option value="pendiente_documento">Documento pendiente</option><option value="confirmado_oficial">Confirmado oficial</option><option value="fuente_secundaria">Fuente secundaria</option><option value="contradictorio">Contradictorio</option><option value="corregido">Corregido</option></select></label>
            <label className="field-label field-wide"><span>Motivo obligatorio</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explica el error detectado y por qué debe corregirse." /></label>
            <label className="field-label"><span>Fuente que sustenta la corrección</span><input value={sourceName} onChange={(event) => setSourceName(event.target.value)} /></label>
            <label className="field-label"><span>URL de respaldo</span><input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} /></label>
          </div>
          <div className="button-row"><button className="button button-primary" disabled={saving} onClick={() => void submitCorrection()} type="button">{saving ? 'Guardando...' : 'Guardar corrección'}</button><Link className="button button-secondary" href={`/admin/eventos/${eventId}/revisar`}>Cancelar</Link></div>
        </div>

        <aside className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Auditoría</p><h2>Historial de revisiones</h2><p className="meta">Visible solo en administración.</p></div></div>
          <div className="revision-list">
            {revisions.length === 0 && <div className="empty-state">Este evento todavía no tiene correcciones registradas.</div>}
            {revisions.map((revision) => <article className="revision-card" key={revision.id}>
              <div className="revision-meta"><strong>Revisión {revision.revision_number}</strong><span className="meta">{formatTimestamp(revision.changed_at)}</span></div>
              <span className="meta">Campos: {revision.changed_fields.join(', ')}</span>
              <p>{revision.change_reason}</p>
              {(revision.source_name || revision.source_url) && <span className="meta">Fuente: {revision.source_name ?? '—'} {revision.source_url ? `· ${revision.source_url}` : ''}</span>}
              <details><summary>Comparar antes y después</summary><div className="revision-states"><div className="state-card"><strong>Estado anterior</strong><pre>{JSON.stringify(revision.before_state, null, 2)}</pre></div><div className="state-card"><strong>Estado corregido</strong><pre>{JSON.stringify(revision.after_state, null, 2)}</pre></div></div></details>
            </article>)}
          </div>
        </aside>
      </section>
    </main>
  )
}
