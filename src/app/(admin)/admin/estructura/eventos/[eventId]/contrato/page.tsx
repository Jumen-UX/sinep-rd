'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>

type EventInfo = {
  id: string
  title: string
  status: string
  event_type_name: string
  effective_date: string | null
  template_name: string | null
}

type Summary = {
  action_count: number
  state_changing_count: number
  metadata_safe_count: number
  automatic_safe_count: number
  manual_review_count: number
  manual_only_count: number
  blocked_count: number
  conflict_error_count: number
  conflict_warning_count: number
  contract_blocker_count: number
  apply_lock_reason: string
}

type Blocker = { code: string; message: string; count?: number }
type ContractAction = {
  id: string
  sort_order: number
  action_type_key: string
  title: string
  status: string
  apply_strategy: string
  contract_status: string
  contract_reason: string
  changes_state: boolean
  requires_payload: boolean
  error_count: number
  warning_count: number
  subject_node_name: string | null
  target_node_name: string | null
  parent_after_node_name: string | null
}

type ContractResponse = {
  event: EventInfo
  summary: Summary
  blockers: Blocker[]
  future_can_apply_when: string[]
  actions: ContractAction[]
}

const pageStyles = `
  .contract-hero{align-items:stretch;grid-template-columns:minmax(0,1fr) minmax(280px,.42fr)}.box,.action-card,.blocker-card{background:#fff;border:1px solid var(--border);border-radius:16px;display:grid;gap:8px;padding:14px}.box.highlight{background:#fbf8f1}.blocker-card{background:#fff7ed;border-color:#fed7aa}.layout-grid,.metric-grid,.status-grid,.action-list,.blocker-list{display:grid;gap:14px}.layout-grid{align-items:start;grid-template-columns:minmax(0,1fr) minmax(320px,.42fr)}.metric-grid,.status-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.button-row,.badge-row{display:flex;flex-wrap:wrap;gap:8px}.mini-badge{background:#fbf8f1;border:1px solid var(--border);border-radius:999px;color:var(--primary);display:inline-flex;font-size:12px;font-weight:900;padding:6px 9px}.mini-badge.warning{background:#fff7ed;color:#9a3412}.mini-badge.success{background:#f0fdf4;color:#166534}.mini-badge.danger{background:#fef2f2;color:#991b1b}.detail-backlink{margin-bottom:8px}.detail-backlink a{color:var(--primary);font-weight:800;text-decoration:none}@media(max-width:980px){.contract-hero,.layout-grid,.metric-grid,.status-grid{grid-template-columns:1fr}}
`

function badgeClass(value?: string) {
  if (['approved', 'ready', 'metadata_safe', 'automatic_safe'].includes(value ?? '')) return 'success'
  if (['manual_review_required', 'manual_only', 'planned', 'submitted', 'skipped_by_review'].includes(value ?? '')) return 'warning'
  if ((value ?? '').startsWith('blocked') || value === 'never_apply' || value === 'failed') return 'danger'
  return ''
}

function label(value?: string) {
  const labels: Record<string, string> = {
    approved: 'Aprobado', submitted: 'En revisión', draft: 'Borrador', planned: 'Planificada', ready: 'Lista', skipped: 'Omitida', failed: 'Con observación',
    metadata_safe: 'Metadato seguro', automatic_safe: 'Automática segura', manual_review_required: 'Revisión manual', manual_only: 'Solo manual',
    blocked_action_failed: 'Bloqueada por observación', blocked_conflict_error: 'Bloqueada por conflicto', blocked_not_reviewed: 'Sin revisar',
    skipped_by_review: 'Omitida por revisión', already_applied: 'Ya aplicada', never_apply: 'No aplicar'
  }
  return labels[value ?? ''] ?? value ?? '—'
}

function formatDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`)) : 'Sin fecha efectiva'
}

export default function StructuralApplicationContractPage() {
  const router = useRouter()
  const params = useParams<{ eventId: string }>()
  const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId
  const supabase = useMemo<SupabaseClient>(() => createClient(), [])
  const [contract, setContract] = useState<ContractResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadContract() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { router.push('/admin/login'); return }
      const { data, error: rpcError } = await supabase.rpc('get_structural_application_contract', { p_event_id: eventId })
      if (rpcError) setError(rpcError.message)
      setContract((data ?? null) as ContractResponse | null)
      setLoading(false)
    }
    if (eventId) loadContract()
  }, [eventId, router, supabase])

  if (loading) return <main className="container"><div className="empty-state">Cargando contrato de aplicación estructural...</div></main>
  if (!contract?.event) return <main className="container"><div className="error-box">No se encontró el contrato.</div></main>

  const event = contract.event
  const summary = contract.summary
  const automaticTotal = summary.metadata_safe_count + summary.automatic_safe_count

  return (
    <main className="container dashboard-page structural-contract-page">
      <style>{pageStyles}</style>
      <div className="detail-backlink"><Link href={`/admin/estructura/eventos/${eventId}/plan`}>← Volver al plan</Link></div>
      <section className="dashboard-hero card contract-hero"><div><p className="eyebrow">Fase 2 · contrato de aplicación estructural</p><h1>{event.title}</h1><p className="lead">Clasifica cada acción como automática segura, revisión manual, solo manual o bloqueada. Esta pantalla no modifica datos reales.</p><div className="button-row"><Link className="button button-secondary" href={`/admin/estructura/eventos/${eventId}/plan`}>Plan</Link><Link className="button button-secondary" href={`/admin/estructura/eventos/${eventId}`}>Impacto</Link><Link className="button button-secondary" href="/admin/estructura/eventos">Registro</Link></div></div><div className="box highlight"><span className={`mini-badge ${badgeClass(event.status)}`}>{label(event.status)}</span><strong>{event.event_type_name}</strong><span className="meta">{event.template_name ?? 'Sin estructura'} · {formatDate(event.effective_date)}</span></div></section>
      {error && <div className="error-box">{error}</div>}
      <section className="metric-grid"><div className="box"><strong>{summary.action_count}</strong><span className="meta">acciones</span></div><div className="box"><strong>{summary.state_changing_count}</strong><span className="meta">cambian estructura</span></div><div className="box"><strong>{summary.conflict_error_count}</strong><span className="meta">errores</span></div><div className="box"><strong>{summary.contract_blocker_count}</strong><span className="meta">bloqueos</span></div></section>
      <section className="status-grid"><div className="box"><strong>{automaticTotal}</strong><span className="meta">automatizables</span></div><div className="box"><strong>{summary.manual_review_count}</strong><span className="meta">revisión manual</span></div><div className="box"><strong>{summary.manual_only_count}</strong><span className="meta">solo manual</span></div><div className="box"><strong>{summary.blocked_count}</strong><span className="meta">bloqueadas</span></div></section>
      <section className="layout-grid"><div className="card dashboard-section"><div className="section-heading"><div><p className="eyebrow">Acciones contratadas</p><h2>Clasificación</h2><p className="meta">El contrato define reglas de aplicación futura.</p></div></div><div className="action-list">{contract.actions.length === 0 && <div className="empty-state">No hay acciones. Genera el plan primero.</div>}{contract.actions.map((action) => <article className="action-card" key={action.id}><div><p className="eyebrow">Orden {action.sort_order} · {action.action_type_key}</p><h2>{action.title}</h2><p className="meta">{action.contract_reason}</p></div><div className="badge-row"><span className={`mini-badge ${badgeClass(action.contract_status)}`}>{label(action.contract_status)}</span><span className="mini-badge">{label(action.apply_strategy)}</span><span className={`mini-badge ${badgeClass(action.status)}`}>{label(action.status)}</span>{action.changes_state && <span className="mini-badge warning">Cambia estructura</span>}{action.requires_payload && <span className="mini-badge warning">Requiere datos</span>}{action.error_count > 0 && <span className="mini-badge danger">{action.error_count} errores</span>}{action.warning_count > 0 && <span className="mini-badge warning">{action.warning_count} advertencias</span>}{action.subject_node_name && <span className="mini-badge">Nodo: {action.subject_node_name}</span>}{action.target_node_name && <span className="mini-badge">Destino: {action.target_node_name}</span>}{action.parent_after_node_name && <span className="mini-badge">Padre posterior: {action.parent_after_node_name}</span>}</div></article>)}</div></div><aside className="card dashboard-section"><div className="section-heading"><div><p className="eyebrow">Condiciones</p><h2>Antes de aplicar</h2></div></div><div className="box highlight"><strong>Aplicación bloqueada</strong><span className="meta">{summary.apply_lock_reason}</span></div><div className="blocker-list">{contract.blockers.map((blocker) => <div className="blocker-card" key={blocker.code}><strong>{blocker.code}</strong><span className="meta">{blocker.message}{blocker.count ? ` · ${blocker.count}` : ''}</span></div>)}</div><div className="box"><strong>Condiciones futuras</strong>{contract.future_can_apply_when.map((condition) => <span className="meta" key={condition}>✓ {condition}</span>)}</div></aside></section>
    </main>
  )
}
