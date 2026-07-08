'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>

type StructuralEventRow = {
  event_id: string
  template_id: string | null
  template_name: string | null
  kind_key: string | null
  event_type_key: string
  event_type_name: string
  title: string
  description: string | null
  effective_date: string | null
  status: string
  reason: string | null
  source_name: string | null
  source_url: string | null
  participant_count: number
  created_at: string
  updated_at: string
}

type EventTypeOption = { key: string; name: string; description: string | null }
type RoleTypeOption = { key: string; name: string; description: string | null; applies_to_event_types: string[]; is_required: boolean }
type TemplateOption = { id: string; name: string; kind_key: string; diocese_name: string | null }
type NodeOption = { id: string; template_id: string; name: string; level_name: string; parent_node_id: string | null }
type Options = { event_types: EventTypeOption[]; role_types: RoleTypeOption[]; templates: TemplateOption[]; nodes: NodeOption[] }

type DraftForm = {
  title: string
  event_type_key: string
  template_id: string
  node_id: string
  role_key: string
  effective_date: string
  source_name: string
  source_url: string
  reason: string
  description: string
  node_notes: string
}

const initialForm: DraftForm = {
  title: '',
  event_type_key: '',
  template_id: '',
  node_id: '',
  role_key: 'affected_node',
  effective_date: '',
  source_name: '',
  source_url: '',
  reason: '',
  description: '',
  node_notes: '',
}

const pageStyles = `
  .structural-events-page select,.structural-events-page input,.structural-events-page textarea{border:1px solid var(--border);border-radius:14px;font:inherit;padding:11px 13px;width:100%}.structural-events-page textarea{min-height:86px;resize:vertical}
  .phase-hero{align-items:stretch;grid-template-columns:minmax(0,1fr) minmax(280px,.42fr)}.phase-summary,.event-card,.form-card,.metric-card-small{background:#fff;border:1px solid var(--border);border-radius:16px;display:grid;gap:8px;padding:14px}.phase-summary,.form-card.highlight{background:#fbf8f1}.layout-grid,.event-list,.form-grid,.metric-grid{display:grid;gap:14px}.layout-grid{align-items:start;grid-template-columns:minmax(0,1fr) minmax(340px,.45fr)}.form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.form-grid .full{grid-column:1/-1}.metric-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.field{color:var(--muted);display:grid;font-size:14px;font-weight:800;gap:6px}.button-row,.badge-row{display:flex;flex-wrap:wrap;gap:8px}.mini-badge{background:#fbf8f1;border:1px solid var(--border);border-radius:999px;color:var(--primary);display:inline-flex;font-size:12px;font-weight:900;padding:6px 9px}.mini-badge.warning{background:#fff7ed;color:#9a3412}.mini-badge.success{background:#f0fdf4;color:#166534}.mini-badge.danger{background:#fef2f2;color:#991b1b}.detail-backlink{margin-bottom:8px}.detail-backlink a{color:var(--primary);font-weight:800;text-decoration:none}@media(max-width:980px){.phase-hero,.layout-grid,.form-grid,.metric-grid{grid-template-columns:1fr}}
`

function statusLabel(status?: string) {
  if (status === 'draft') return 'Borrador'
  if (status === 'submitted') return 'En revisión'
  if (status === 'approved') return 'Aprobado'
  if (status === 'rejected') return 'Rechazado'
  if (status === 'archived') return 'Archivado'
  return status ?? '—'
}

function statusClass(status?: string) {
  if (status === 'approved') return 'success'
  if (status === 'submitted') return 'warning'
  if (status === 'rejected') return 'danger'
  return ''
}

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha efectiva'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

export default function StructuralEvolutionEventsPage() {
  const router = useRouter()
  const supabase = useMemo<SupabaseClient>(() => createClient(), [])
  const [options, setOptions] = useState<Options | null>(null)
  const [events, setEvents] = useState<StructuralEventRow[]>([])
  const [form, setForm] = useState<DraftForm>(initialForm)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredNodes = useMemo(() => {
    if (!options) return []
    if (!form.template_id) return options.nodes
    return options.nodes.filter((node) => node.template_id === form.template_id)
  }, [form.template_id, options])

  const filteredRoles = useMemo(() => {
    if (!options) return []
    if (!form.event_type_key) return options.role_types
    return options.role_types.filter((role) => role.applies_to_event_types.includes(form.event_type_key))
  }, [form.event_type_key, options])

  async function loadData() {
    setError(null)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    const [optionsRes, streamRes] = await Promise.all([
      supabase.rpc('get_structural_evolution_options'),
      supabase.rpc('get_structural_evolution_stream', { p_status: statusFilter || null, p_template_id: null, p_limit: 160 }),
    ])

    if (optionsRes.error) setError(optionsRes.error.message)
    if (streamRes.error) setError(streamRes.error.message)

    setOptions((optionsRes.data ?? null) as Options | null)
    setEvents((streamRes.data ?? []) as StructuralEventRow[])
    setLoading(false)
  }

  async function createDraft() {
    setSaving(true)
    setError(null)

    const { error: createError } = await supabase.rpc('admin_create_structural_evolution_event_draft', {
      payload: {
        title: form.title,
        event_type_key: form.event_type_key,
        template_id: form.template_id || null,
        node_id: form.node_id || null,
        role_key: form.role_key || 'affected_node',
        effective_date: form.effective_date || null,
        source_name: form.source_name || null,
        source_url: form.source_url || null,
        reason: form.reason || null,
        description: form.description || null,
        node_notes: form.node_notes || null,
      },
    })

    if (createError) {
      setError(createError.message)
      setSaving(false)
      return
    }

    setForm(initialForm)
    await loadData()
    setSaving(false)
  }

  async function reviewEvent(eventId: string, action: 'submit' | 'approve' | 'return_to_draft' | 'reject' | 'archive') {
    setSaving(true)
    setError(null)
    const { error: reviewError } = await supabase.rpc('admin_review_structural_evolution_event', {
      payload: { event_id: eventId, action },
    })
    if (reviewError) setError(reviewError.message)
    await loadData()
    setSaving(false)
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  if (loading) return <main className="container"><div className="empty-state">Cargando eventos de evolución estructural...</div></main>

  return (
    <main className="container dashboard-page structural-events-page">
      <style>{pageStyles}</style>
      <div className="detail-backlink"><Link href="/admin">← Volver al panel administrativo</Link></div>

      <section className="dashboard-hero card phase-hero">
        <div>
          <p className="eyebrow">Fase 2 · evolución estructural</p>
          <h1>Eventos de evolución estructural</h1>
          <p className="lead">Registra creación, desmembramiento, división, fusión, reorganización, supresión, cambio de nombre, límites, dependencia o nivel dentro de estructuras flexibles.</p>
          <div className="button-row"><Link className="button button-secondary" href="/admin/estructura">Motor de estructuras</Link><Link className="button button-secondary" href="/admin/eventos/fase-1">Verificar Fase 1</Link></div>
        </div>
        <div className="phase-summary"><span className="mini-badge warning">Aplicación bloqueada</span><strong>Solo registra y aprueba eventos</strong><span className="meta">La mutación real de jerarquías queda para la aplicación auditada.</span></div>
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="metric-grid">
        <div className="metric-card-small"><strong>{events.length}</strong><span className="meta">eventos listados</span></div>
        <div className="metric-card-small"><strong>{options?.event_types.length ?? 0}</strong><span className="meta">tipos de evento</span></div>
        <div className="metric-card-small"><strong>{options?.templates.length ?? 0}</strong><span className="meta">estructuras activas</span></div>
        <div className="metric-card-small"><strong>{options?.nodes.length ?? 0}</strong><span className="meta">nodos seleccionables</span></div>
      </section>

      <section className="layout-grid">
        <div className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Registro</p><h2>Eventos estructurales</h2><p className="meta">Filtra y revisa eventos. Aprobar no altera todavía nodos ni dependencias.</p></div></div>
          <label className="field">Estado
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">Todos</option><option value="draft">Borrador</option><option value="submitted">En revisión</option><option value="approved">Aprobado</option><option value="rejected">Rechazado</option><option value="archived">Archivado</option>
            </select>
          </label>
          <div className="event-list">
            {events.length === 0 && <div className="empty-state">No hay eventos estructurales todavía.</div>}
            {events.map((event) => (
              <article className="event-card" key={event.event_id}>
                <div><p className="eyebrow">{formatDate(event.effective_date)}</p><h2>{event.title}</h2><p className="meta">{event.event_type_name} · {event.template_name ?? 'Sin estructura'}</p></div>
                <div className="badge-row"><span className={`mini-badge ${statusClass(event.status)}`}>{statusLabel(event.status)}</span><span className="mini-badge">{event.kind_key ?? 'estructura'}</span><span className="mini-badge">{event.participant_count} participantes</span>{event.source_name && <span className="mini-badge">Fuente: {event.source_name}</span>}</div>
                {event.reason && <p className="meta">{event.reason}</p>}
                <div className="button-row">
                  <Link className="button button-primary" href={`/admin/estructura/eventos/${event.event_id}`}>Vista de impacto</Link>
                  <Link className="button button-secondary" href={`/admin/estructura/eventos/${event.event_id}/plan`}>Plan</Link>
                  <Link className="button button-secondary" href={`/admin/estructura/eventos/${event.event_id}/contrato`}>Contrato</Link>
                  {event.status === 'draft' && <button className="button button-primary" disabled={saving} onClick={() => reviewEvent(event.event_id, 'submit')} type="button">Enviar a revisión</button>}
                  {event.status === 'submitted' && <button className="button button-primary" disabled={saving} onClick={() => reviewEvent(event.event_id, 'approve')} type="button">Aprobar</button>}
                  {event.status === 'submitted' && <button className="button button-secondary" disabled={saving} onClick={() => reviewEvent(event.event_id, 'return_to_draft')} type="button">Devolver</button>}
                  {['draft', 'submitted'].includes(event.status) && <button className="button button-secondary" disabled={saving} onClick={() => reviewEvent(event.event_id, 'reject')} type="button">Rechazar</button>}
                  {event.status !== 'archived' && <button className="button button-secondary" disabled={saving} onClick={() => reviewEvent(event.event_id, 'archive')} type="button">Archivar</button>}
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Nuevo evento</p><h2>Preparar evolución</h2><p className="meta">Seleccionar primero. Escribir solo lo necesario.</p></div></div>
          <div className="form-card highlight">
            <div className="form-grid">
              <label className="field full">Título<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ej. Reorganización de zonas pastorales" /></label>
              <label className="field">Tipo<select value={form.event_type_key} onChange={(event) => setForm({ ...form, event_type_key: event.target.value, role_key: 'affected_node' })}><option value="">Seleccionar tipo</option>{(options?.event_types ?? []).map((type) => <option key={type.key} value={type.key}>{type.name}</option>)}</select></label>
              <label className="field">Fecha efectiva<input type="date" value={form.effective_date} onChange={(event) => setForm({ ...form, effective_date: event.target.value })} /></label>
              <label className="field full">Estructura<select value={form.template_id} onChange={(event) => setForm({ ...form, template_id: event.target.value, node_id: '' })}><option value="">Seleccionar estructura</option>{(options?.templates ?? []).map((template) => <option key={template.id} value={template.id}>{template.diocese_name} · {template.name} · {template.kind_key}</option>)}</select></label>
              <label className="field full">Nodo relacionado<select value={form.node_id} onChange={(event) => setForm({ ...form, node_id: event.target.value })}><option value="">Seleccionar nodo</option>{filteredNodes.map((node) => <option key={node.id} value={node.id}>{node.name} · {node.level_name}</option>)}</select></label>
              <label className="field full">Rol del nodo<select value={form.role_key} onChange={(event) => setForm({ ...form, role_key: event.target.value })}>{filteredRoles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}</select></label>
              <label className="field full">Fuente<input value={form.source_name} onChange={(event) => setForm({ ...form, source_name: event.target.value })} placeholder="Decreto, acta, boletín, fuente interna..." /></label>
              <label className="field full">URL o referencia<input value={form.source_url} onChange={(event) => setForm({ ...form, source_url: event.target.value })} placeholder="https://..." /></label>
              <label className="field full">Motivo<textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Por qué cambia la estructura." /></label>
              <label className="field full">Descripción<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Qué cambia, qué queda histórico y qué se debe validar." /></label>
            </div>
            <button className="button button-primary" disabled={saving || !form.title || !form.event_type_key} onClick={createDraft} type="button">Crear borrador estructural</button>
          </div>
        </aside>
      </section>
    </main>
  )
}
