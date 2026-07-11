'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Item = {
  assignment_id: string
  person_id: string
  office_configuration_id: string
  person_name: string
  office_name: string
  entity_name: string
  start_date: string | null
  reason_code: string
  message: string
  review_status: string
  resolution_type: string | null
  review_notes: string | null
}

type ResponseData = { total: number; items: Item[] }

export default function AssignmentCanonicalIncompatibilityPage() {
  const [status, setStatus] = useState('open')
  const [data, setData] = useState<ResponseData>({ total: 0, items: [] })
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  async function load(nextStatus = status) {
    setLoading(true)
    setError(null)
    const response = await fetch(`/api/admin/incompatibilidades-canonicas?status=${encodeURIComponent(nextStatus)}`)
    const body = await response.json()
    if (!response.ok) setError(body.error ?? 'No se pudo cargar la bandeja.')
    else setData(body as ResponseData)
    setLoading(false)
  }

  useEffect(() => { load(status) }, [status])

  async function resolve(item: Item, action: 'acknowledge' | 'recheck' | 'close_assignment' | 'accept_exception') {
    const note = notes[item.assignment_id]?.trim() ?? ''
    if ((action === 'accept_exception' || action === 'close_assignment') && !note) {
      setError('Debes escribir una justificación antes de aplicar esta acción.')
      return
    }
    if (action === 'close_assignment' && !window.confirm(`Se cerrará el nombramiento de ${item.person_name} como ${item.office_name}. ¿Continuar?`)) return
    setSavingId(item.assignment_id)
    setError(null)
    setMessage(null)
    const response = await fetch('/api/admin/incompatibilidades-canonicas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignment_id: item.assignment_id, action, notes: note }),
    })
    const body = await response.json()
    if (!response.ok) setError(body.error ?? 'No se pudo procesar la incompatibilidad.')
    else {
      setMessage(action === 'close_assignment' ? 'Nombramiento cerrado y auditado.' : 'Revisión registrada correctamente.')
      await load(status)
    }
    setSavingId(null)
  }

  return <main className="container dashboard-page admin-config-page">
    <div className="detail-backlink"><Link href="/admin">← Volver al panel administrativo</Link></div>
    <section className="dashboard-hero card"><div><p className="eyebrow">Control de coherencia</p><h1>Incompatibilidades canónicas</h1><p className="lead">Revisa nombramientos vigentes que ya no cumplen las reglas del cargo. Ningún nombramiento se cierra automáticamente.</p></div></section>
    {error && <div className="error-box">{error}</div>}
    {message && <div className="empty-state">{message}</div>}

    <section className="card dashboard-section">
      <div className="section-heading"><div><p className="eyebrow">Bandeja</p><h2>{data.total} casos</h2></div>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="open">Pendientes y reconocidos</option>
          <option value="pending">Pendientes</option>
          <option value="acknowledged">Reconocidos</option>
          <option value="all">Todos los incompatibles</option>
        </select>
      </div>
      {loading && <div className="empty-state">Evaluando nombramientos...</div>}
      {!loading && data.items.length === 0 && <div className="empty-state">No hay incompatibilidades en este filtro.</div>}
      <div className="timeline-list">
        {data.items.map((item) => <article className="timeline-item" key={item.assignment_id}>
          <strong>{item.person_name}</strong>
          <span>{item.office_name} · {item.entity_name}</span>
          <small>{item.message}</small>
          <small>Código: {item.reason_code} · Estado de revisión: {item.review_status}</small>
          <textarea
            placeholder="Justificación, observación o criterio de resolución"
            value={notes[item.assignment_id] ?? item.review_notes ?? ''}
            onChange={(event) => setNotes((current) => ({ ...current, [item.assignment_id]: event.target.value }))}
          />
          <div className="actions">
            <button className="button button-secondary" disabled={savingId === item.assignment_id} onClick={() => resolve(item, 'recheck')}>Volver a comprobar</button>
            <button className="button button-secondary" disabled={savingId === item.assignment_id} onClick={() => resolve(item, 'acknowledge')}>Dejar pendiente con nota</button>
            <button className="button button-secondary" disabled={savingId === item.assignment_id} onClick={() => resolve(item, 'accept_exception')}>Aceptar excepción justificada</button>
            <button className="button button-primary" disabled={savingId === item.assignment_id} onClick={() => resolve(item, 'close_assignment')}>Cerrar nombramiento</button>
          </div>
          <div className="actions">
            <Link className="button button-secondary" href={`/admin/personas/${item.person_id}/editar`}>Corregir persona</Link>
            <Link className="button button-secondary" href="/admin/cargos">Revisar reglas del cargo</Link>
          </div>
        </article>)}
      </div>
    </section>
  </main>
}
