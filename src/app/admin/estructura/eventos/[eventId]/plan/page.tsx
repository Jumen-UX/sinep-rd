'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>
type ActionStatus = 'planned' | 'ready' | 'skipped' | 'failed' | 'applied'

type PlanEvent = { id: string; title: string; status: string; event_type_key: string; event_type_name: string; effective_date: string | null; template_name: string | null; kind_key: string | null }
type PlanSummary = { action_count: number; planned_count: number; ready_count: number; skipped_count: number; failed_count: number; applied_count: number; state_changing_count: number; manual_review_count: number; blocker_count: number; warning_count: number; can_generate_plan: boolean; can_apply_now: boolean; apply_lock_reason: string }
type PlanAction = { id: string; action_type_key: string; action_type_name: string; status: ActionStatus; title: string; description: string | null; changes_state: boolean; requires_manual_review: boolean; requires_payload: boolean; auto_apply_allowed: boolean; apply_strategy: string; subject_node_id: string | null; subject_node_name: string | null; target_node_id: string | null; target_node_name: string | null; parent_before_node_id: string | null; parent_before_node_name: string | null; parent_after_node_id: string | null; parent_after_node_name: string | null; level_before_id: string | null; level_before_name: string | null; level_after_id: string | null; level_after_name: string | null; payload: Record<string, unknown>; notes: string | null; sort_order: number }
type PlanResponse = { event: PlanEvent; summary: PlanSummary; actions: PlanAction[]; impact: Record<string, unknown> }
type NodeOption = { id: string; template_id: string; level_id: string; level_name: string; name: string; official_name: string | null; parent_node_id: string | null; status: string; is_current: boolean }
type LevelOption = { id: string; template_id: string; level_key: string; name: string; level_order: number; allows_new_nodes: boolean }
type EditorOptions = { nodes: NodeOption[]; levels: LevelOption[] }
type ConflictMessage = { severity: 'error' | 'warning'; code: string; message: string; child_edge_count?: number }
type ConflictAction = { action_id: string; action_type_key: string; action_type_name: string; status: string; conflicts: ConflictMessage[]; error_count: number; warning_count: number; is_clear: boolean }
type ConflictPreview = { action_count: number; conflict_count: number; error_count: number; warning_count: number; actions: ConflictAction[]; can_apply_now: boolean; apply_lock_reason: string }

const pageStyles = `
  .structural-plan-page textarea,.structural-plan-page input,.structural-plan-page select{border:1px solid var(--border);border-radius:14px;font:inherit;padding:11px 13px;width:100%}.structural-plan-page textarea{min-height:74px;resize:vertical}
  .plan-hero{align-items:stretch;grid-template-columns:minmax(0,1fr) minmax(280px,.42fr)}.plan-summary,.plan-card,.action-card,.action-editor,.conflict-card{background:#fff;border:1px solid var(--border);border-radius:16px;display:grid;gap:8px;padding:14px}.plan-summary,.plan-card.highlight,.action-editor,.conflict-card.clear{background:#fbf8f1}.conflict-card.error{background:#fef2f2;border-color:#fecaca}.conflict-card.warning{background:#fff7ed;border-color:#fed7aa}.layout-grid,.metric-grid,.status-grid,.action-list,.editor-grid,.conflict-list{display:grid;gap:14px}.layout-grid{align-items:start;grid-template-columns:minmax(0,1fr) minmax(320px,.42fr)}.metric-grid,.status-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.editor-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.editor-grid .full{grid-column:1/-1}.field{color:var(--muted);display:grid;font-size:14px;font-weight:800;gap:6px}.button-row,.badge-row{display:flex;flex-wrap:wrap;gap:8px}.mini-badge{background:#fbf8f1;border:1px solid var(--border);border-radius:999px;color:var(--primary);display:inline-flex;font-size:12px;font-weight:900;padding:6px 9px}.mini-badge.warning{background:#fff7ed;color:#9a3412}.mini-badge.success{background:#f0fdf4;color:#166534}.mini-badge.danger{background:#fef2f2;color:#991b1b}.action-controls{border-top:1px solid var(--border);display:grid;gap:10px;margin-top:8px;padding-top:12px}.detail-backlink{margin-bottom:8px}.detail-backlink a{color:var(--primary);font-weight:800;text-decoration:none}@media(max-width:980px){.plan-hero,.layout-grid,.metric-grid,.status-grid,.editor-grid{grid-template-columns:1fr}}
`

function statusLabel(status?: string) { if (status === 'draft') return 'Borrador'; if (status === 'submitted') return 'En revisión'; if (status === 'approved') return 'Aprobado'; if (status === 'planned') return 'Planificada'; if (status === 'ready') return 'Lista'; if (status === 'skipped') return 'Omitida'; if (status === 'failed') return 'Con observación'; if (status === 'applied') return 'Aplicada'; return status ?? '—' }
function statusClass(status?: string) { if (status === 'approved' || status === 'ready') return 'success'; if (status === 'submitted' || status === 'skipped' || status === 'planned') return 'warning'; if (status === 'failed') return 'danger'; return '' }
function strategyLabel(strategy?: string) { if (strategy === 'metadata_only') return 'Solo metadatos'; if (strategy === 'automatic_safe') return 'Automática segura'; if (strategy === 'manual_review') return 'Revisión manual'; if (strategy === 'manual_only') return 'Solo manual'; if (strategy === 'never_apply') return 'No aplicable'; return strategy ?? '—' }
function formatDate(value?: string | null) { return value ? new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`)) : 'Sin fecha efectiva' }
function payloadString(payload: Record<string, unknown>, key: string) { const value = payload?.[key]; return typeof value === 'string' ? value : '' }
function needsDataEditor(action: PlanAction) { return action.requires_payload || ['create_structure_node','create_structure_edge','close_structure_edge','move_structure_node','rename_structure_node','change_structure_level','suppress_structure_node','merge_structure_nodes'].includes(action.action_type_key) }
function conflictClass(message: ConflictMessage) { return message.severity === 'error' ? 'error' : 'warning' }

function StructuralActionEditor({ action, options, saving, onSave }: { action: PlanAction; options: EditorOptions | null; saving: boolean; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [subjectNodeId, setSubjectNodeId] = useState(action.subject_node_id ?? '')
  const [targetNodeId, setTargetNodeId] = useState(action.target_node_id ?? '')
  const [parentBeforeNodeId, setParentBeforeNodeId] = useState(action.parent_before_node_id ?? '')
  const [parentAfterNodeId, setParentAfterNodeId] = useState(action.parent_after_node_id ?? '')
  const [levelBeforeId, setLevelBeforeId] = useState(action.level_before_id ?? '')
  const [levelAfterId, setLevelAfterId] = useState(action.level_after_id ?? '')
  const [newNodeName, setNewNodeName] = useState(payloadString(action.payload, 'new_node_name'))
  const [newName, setNewName] = useState(payloadString(action.payload, 'new_name'))
  const [newOfficialName, setNewOfficialName] = useState(payloadString(action.payload, 'new_official_name'))
  const [notes, setNotes] = useState(action.notes ?? '')

  if (!needsDataEditor(action)) return null

  const payloadPatch = { new_node_name: newNodeName || null, new_name: newName || null, new_official_name: newOfficialName || null }
  const savePayload = (status: ActionStatus) => onSave({ action_id: action.id, subject_node_id: subjectNodeId || null, target_node_id: targetNodeId || null, parent_before_node_id: parentBeforeNodeId || null, parent_after_node_id: parentAfterNodeId || null, level_before_id: levelBeforeId || null, level_after_id: levelAfterId || null, notes: notes || null, payload_patch: payloadPatch, status })

  return (
    <div className="action-editor">
      <strong>Editor de datos faltantes</strong>
      <span className="meta">Completa los datos que la acción necesita antes de marcarla como lista.</span>
      <div className="editor-grid">
        <label className="field">Nodo sujeto<select value={subjectNodeId} onChange={(event) => setSubjectNodeId(event.target.value)}><option value="">Seleccionar nodo</option>{(options?.nodes ?? []).map((node) => <option key={node.id} value={node.id}>{node.name} · {node.level_name}</option>)}</select></label>
        <label className="field">Nodo destino<select value={targetNodeId} onChange={(event) => setTargetNodeId(event.target.value)}><option value="">Seleccionar destino</option>{(options?.nodes ?? []).map((node) => <option key={node.id} value={node.id}>{node.name} · {node.level_name}</option>)}</select></label>
        <label className="field">Padre anterior<select value={parentBeforeNodeId} onChange={(event) => setParentBeforeNodeId(event.target.value)}><option value="">Seleccionar padre anterior</option>{(options?.nodes ?? []).map((node) => <option key={node.id} value={node.id}>{node.name} · {node.level_name}</option>)}</select></label>
        <label className="field">Padre posterior<select value={parentAfterNodeId} onChange={(event) => setParentAfterNodeId(event.target.value)}><option value="">Seleccionar padre posterior</option>{(options?.nodes ?? []).map((node) => <option key={node.id} value={node.id}>{node.name} · {node.level_name}</option>)}</select></label>
        <label className="field">Nivel anterior<select value={levelBeforeId} onChange={(event) => setLevelBeforeId(event.target.value)}><option value="">Seleccionar nivel anterior</option>{(options?.levels ?? []).map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label>
        <label className="field">Nivel posterior<select value={levelAfterId} onChange={(event) => setLevelAfterId(event.target.value)}><option value="">Seleccionar nivel posterior</option>{(options?.levels ?? []).map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label>
        <label className="field full">Nombre de nuevo nodo<input value={newNodeName} onChange={(event) => setNewNodeName(event.target.value)} placeholder="Nombre si la acción crea una unidad nueva" /></label>
        <label className="field">Nuevo nombre<input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Para cambio de nombre" /></label>
        <label className="field">Nuevo nombre oficial<input value={newOfficialName} onChange={(event) => setNewOfficialName(event.target.value)} placeholder="Nombre oficial si aplica" /></label>
        <label className="field full">Notas<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Justificación, observaciones o datos que faltan para aplicar." /></label>
      </div>
      <div className="button-row"><button className="button button-secondary" disabled={saving || action.status === 'applied'} onClick={() => savePayload('planned')} type="button">Guardar datos</button><button className="button button-primary" disabled={saving || action.status === 'applied'} onClick={() => savePayload('ready')} type="button">Guardar y marcar lista</button></div>
    </div>
  )
}

function ConflictPanel({ conflictAction }: { conflictAction?: ConflictAction }) {
  if (!conflictAction) return null
  if (conflictAction.conflicts.length === 0) return <div className="conflict-card clear"><strong>Sin conflictos estructurales detectados</strong><span className="meta">La acción no presenta ciclo, duplicidad o incompatibilidad conocida.</span></div>
  return <div className="conflict-list">{conflictAction.conflicts.map((message) => <div className={`conflict-card ${conflictClass(message)}`} key={`${message.code}-${message.message}`}><strong>{message.severity === 'error' ? 'Error' : 'Advertencia'} · {message.code}</strong><span className="meta">{message.message}</span></div>)}</div>
}

export default function StructuralApplicationPlanPage() {
  const router = useRouter()
  const params = useParams<{ eventId: string }>()
  const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId
  const supabase = useMemo<SupabaseClient>(() => createClient(), [])
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [editorOptions, setEditorOptions] = useState<EditorOptions | null>(null)
  const [conflictPreview, setConflictPreview] = useState<ConflictPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadConflictPreview() { const { data, error: conflictError } = await supabase.rpc('get_structural_plan_conflict_preview', { p_event_id: eventId }); if (conflictError) setError(conflictError.message); setConflictPreview((data ?? null) as ConflictPreview | null) }

  async function loadPlan() {
    setError(null); setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { router.push('/admin/login'); return }
    const [planRes, optionsRes, conflictRes] = await Promise.all([supabase.rpc('get_structural_application_plan', { p_event_id: eventId }), supabase.rpc('get_structural_action_editor_options', { p_event_id: eventId }), supabase.rpc('get_structural_plan_conflict_preview', { p_event_id: eventId })])
    if (planRes.error) setError(planRes.error.message)
    if (optionsRes.error) setError(optionsRes.error.message)
    if (conflictRes.error) setError(conflictRes.error.message)
    setPlan((planRes.data ?? null) as PlanResponse | null)
    setEditorOptions((optionsRes.data ?? null) as EditorOptions | null)
    setConflictPreview((conflictRes.data ?? null) as ConflictPreview | null)
    setLoading(false)
  }

  async function generatePlan() { setSaving(true); setError(null); const { data, error: generateError } = await supabase.rpc('admin_generate_structural_application_plan', { payload: { event_id: eventId } }); if (generateError) { setError(generateError.message); setSaving(false); return } setPlan((data ?? null) as PlanResponse | null); await loadConflictPreview(); setSaving(false) }
  async function updateAction(actionId: string, status: ActionStatus) { setSaving(true); setError(null); const { data, error: updateError } = await supabase.rpc('admin_update_structural_event_action', { payload: { action_id: actionId, status } }); if (updateError) { setError(updateError.message); setSaving(false); return } setPlan((data ?? null) as PlanResponse | null); await loadConflictPreview(); setSaving(false) }
  async function configureAction(payload: Record<string, unknown>) { setSaving(true); setError(null); const { data, error: configureError } = await supabase.rpc('admin_configure_structural_event_action', { payload }); if (configureError) { setError(configureError.message); setSaving(false); return } setPlan((data ?? null) as PlanResponse | null); await loadConflictPreview(); setSaving(false) }

  useEffect(() => { if (eventId) loadPlan(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [eventId])
  if (loading) return <main className="container"><div className="empty-state">Cargando plan de aplicación estructural...</div></main>
  if (!plan?.event) return <main className="container"><div className="error-box">No se encontró el evento estructural.</div></main>

  const event = plan.event
  const summary = plan.summary
  const allReviewed = summary.action_count > 0 && summary.planned_count === 0
  const conflictFor = (actionId: string) => conflictPreview?.actions.find((action) => action.action_id === actionId)

  return (
    <main className="container dashboard-page structural-plan-page">
      <style>{pageStyles}</style>
      <div className="detail-backlink"><Link href={`/admin/estructura/eventos/${eventId}`}>← Volver a impacto</Link></div>
      <section className="dashboard-hero card plan-hero"><div><p className="eyebrow">Fase 2 · plan de aplicación estructural</p><h1>{event.title}</h1><p className="lead">Convierte el impacto estructural en acciones revisables, permite completar datos faltantes y detecta conflictos. Todavía no modifica nodos.</p><div className="button-row"><button className="button button-primary" disabled={!summary.can_generate_plan || saving} onClick={generatePlan} type="button">{saving ? 'Procesando...' : 'Generar / regenerar plan'}</button><button className="button button-secondary" disabled={saving} onClick={loadConflictPreview} type="button">Revisar conflictos</button><Link className="button button-secondary" href={`/admin/estructura/eventos/${eventId}`}>Vista de impacto</Link><Link className="button button-secondary" href="/admin/estructura/eventos">Registro estructural</Link></div></div><div className="plan-summary"><span className={`mini-badge ${statusClass(event.status)}`}>{statusLabel(event.status)}</span><strong>{event.event_type_name}</strong><span className="meta">{event.template_name ?? 'Sin estructura'} · {formatDate(event.effective_date)}</span></div></section>
      {error && <div className="error-box">{error}</div>}
      <section className="metric-grid"><div className="plan-card"><strong>{summary.action_count}</strong><span className="meta">acciones</span></div><div className="plan-card"><strong>{summary.state_changing_count}</strong><span className="meta">cambiarían estructura</span></div><div className="plan-card"><strong>{conflictPreview?.error_count ?? 0}</strong><span className="meta">errores estructurales</span></div><div className="plan-card"><strong>{conflictPreview?.warning_count ?? 0}</strong><span className="meta">advertencias</span></div></section>
      <section className="status-grid"><div className="plan-card"><strong>{summary.planned_count}</strong><span className="meta">planificadas</span></div><div className="plan-card"><strong>{summary.ready_count}</strong><span className="meta">listas</span></div><div className="plan-card"><strong>{summary.skipped_count}</strong><span className="meta">omitidas</span></div><div className="plan-card"><strong>{summary.failed_count}</strong><span className="meta">observadas</span></div></section>
      <section className="layout-grid"><div className="card dashboard-section"><div className="section-heading"><div><p className="eyebrow">Acciones</p><h2>Plan generado</h2><p className="meta">Cada acción debe revisarse, completarse y quedar libre de errores antes de una futura aplicación auditada.</p></div></div><div className="action-list">{plan.actions.length === 0 && <div className="empty-state">Este evento todavía no tiene plan. Usa Generar plan.</div>}{plan.actions.map((action) => <article className="action-card" key={action.id}><div><p className="eyebrow">Orden {action.sort_order} · {action.action_type_key}</p><h2>{action.title}</h2><p className="meta">{action.description ?? 'Sin descripción.'}</p></div><div className="badge-row"><span className={`mini-badge ${statusClass(action.status)}`}>{statusLabel(action.status)}</span><span className="mini-badge">{strategyLabel(action.apply_strategy)}</span>{action.changes_state && <span className="mini-badge warning">Cambia estructura</span>}{action.requires_payload && <span className="mini-badge warning">Requiere datos</span>}{action.subject_node_name && <span className="mini-badge">Nodo: {action.subject_node_name}</span>}{action.target_node_name && <span className="mini-badge">Destino: {action.target_node_name}</span>}{action.parent_before_node_name && <span className="mini-badge">Padre anterior: {action.parent_before_node_name}</span>}{action.parent_after_node_name && <span className="mini-badge">Padre posterior: {action.parent_after_node_name}</span>}{action.level_after_name && <span className="mini-badge">Nivel posterior: {action.level_after_name}</span>}</div>{action.notes && <p className="meta">{action.notes}</p>}<StructuralActionEditor action={action} options={editorOptions} saving={saving} onSave={configureAction} /><ConflictPanel conflictAction={conflictFor(action.id)} /><div className="action-controls"><strong>Revisión de acción</strong><div className="button-row"><button className="button button-secondary" disabled={saving || action.status === 'planned' || action.status === 'applied'} onClick={() => updateAction(action.id, 'planned')} type="button">Planificada</button><button className="button button-primary" disabled={saving || action.status === 'ready' || action.status === 'applied'} onClick={() => updateAction(action.id, 'ready')} type="button">Lista</button><button className="button button-secondary" disabled={saving || action.status === 'skipped' || action.status === 'applied'} onClick={() => updateAction(action.id, 'skipped')} type="button">Omitir</button><button className="button button-secondary" disabled={saving || action.status === 'failed' || action.status === 'applied'} onClick={() => updateAction(action.id, 'failed')} type="button">Observación</button></div></div></article>)}</div></div><aside className="card dashboard-section"><div className="section-heading"><div><p className="eyebrow">Regla de fase</p><h2>Aplicación bloqueada</h2></div></div><div className="plan-card highlight"><strong>No se modifica estructura</strong><span className="meta">{summary.apply_lock_reason}</span></div><div className="plan-card"><strong>Conflictos estructurales</strong><span className="meta">{conflictPreview ? `${conflictPreview.error_count} errores y ${conflictPreview.warning_count} advertencias detectadas.` : 'Sin revisión ejecutada.'}</span></div><div className="plan-card"><strong>Revisión del plan</strong><span className="meta">{allReviewed ? 'Todas las acciones fueron revisadas.' : 'Todavía hay acciones planificadas sin decisión.'}</span></div><div className="plan-card"><strong>Siguiente compuerta</strong><span className="meta">Contrato de aplicación estructural: definir qué puede aplicarse automáticamente, manualmente o nunca.</span></div></aside></section>
    </main>
  )
}
