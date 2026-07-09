'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>

type ContractEvent = {
  id: string
  title: string
  status: string
  load_mode: string
  evidence_status: string
  event_type_key: string
  event_type_name: string
}

type ContractSummary = {
  event_exists: boolean
  event_status: string
  action_count: number
  ready_count: number
  planned_count: number
  failed_count: number
  state_changing_count: number
  auto_apply_allowed_count: number
  manual_application_count: number
  manual_only_count: number
  relationship_error_count: number
  relationship_warning_count: number
  phase_1_can_apply: boolean
  phase_1_lock_reason: string
  future_can_apply_when: string[]
}

type ContractAction = {
  id: string
  action_type_key: string
  action_type_name: string
  status: string
  changes_state: boolean
  requires_manual_review: boolean
  auto_apply_allowed: boolean
  apply_strategy: string
  implementation_phase: string
  contract_status: string
  subject_entity_name: string | null
  target_entity_name: string | null
  relationship_type_name: string | null
  sort_order: number
}

type ApplicationContract = {
  event: ContractEvent
  summary: ContractSummary
  actions: ContractAction[]
}

const pageStyles = `
  .contract-hero{align-items:stretch;grid-template-columns:minmax(0,1fr) minmax(280px,.42fr)}
  .contract-summary,.contract-card,.contract-action{background:#fff;border:1px solid var(--border);border-radius:16px;display:grid;gap:8px;padding:14px}
  .contract-summary,.contract-card.highlight{background:#fbf8f1}.contract-grid,.metric-grid,.actions-list,.requirements-list{display:grid;gap:14px}.contract-grid{align-items:start;grid-template-columns:minmax(0,1fr) minmax(300px,.4fr)}.metric-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.badge-row{display:flex;flex-wrap:wrap;gap:7px}.mini-badge{background:#fbf8f1;border:1px solid var(--border);border-radius:999px;color:var(--primary);display:inline-flex;font-size:12px;font-weight:900;padding:6px 9px}.mini-badge.warning{background:#fff7ed;color:#9a3412}.mini-badge.success{background:#f0fdf4;color:#166534}.mini-badge.danger{background:#fef2f2;color:#991b1b}.detail-backlink{margin-bottom:8px}.detail-backlink a{color:var(--primary);font-weight:800;text-decoration:none}@media(max-width:980px){.contract-hero,.contract-grid,.metric-grid{grid-template-columns:1fr}}
`

function statusLabel(status?: string) {
  if (status === 'pending_review') return 'Pendiente de revisión'
  if (status === 'approved') return 'Aprobado'
  if (status === 'applied') return 'Aplicado'
  if (status === 'cancelled') return 'Cancelado'
  if (status === 'draft') return 'Borrador'
  if (status === 'ready') return 'Lista'
  if (status === 'planned') return 'Planificada'
  if (status === 'failed') return 'Con observación'
  if (status === 'skipped') return 'Omitida'
  return status ?? '—'
}

function strategyLabel(strategy?: string) {
  if (strategy === 'metadata_only') return 'Solo metadatos'
  if (strategy === 'automatic_safe') return 'Automática segura'
  if (strategy === 'manual_review') return 'Aplicación con revisión'
  if (strategy === 'manual_only') return 'Solo manual'
  if (strategy === 'never_apply') return 'No aplicable'
  return strategy ?? '—'
}

function contractStatusLabel(status?: string) {
  if (status === 'blocked_failed_action') return 'Bloqueada por observación'
  if (status === 'blocked_not_reviewed') return 'Falta revisar'
  if (status === 'manual_only') return 'Requiere decisión manual'
  if (status === 'requires_manual_application') return 'Requiere aplicación manual'
  if (status === 'eligible_when_phase_enabled') return 'Elegible cuando se habilite fase'
  if (status === 'review_required') return 'Requiere revisión'
  return status ?? '—'
}

function badgeClass(action: ContractAction) {
  if (action.contract_status.startsWith('blocked')) return 'danger'
  if (action.auto_apply_allowed) return 'success'
  if (action.apply_strategy === 'manual_only') return 'warning'
  return 'warning'
}

export default function EventApplicationContractPage() {
  const router = useRouter()
  const params = useParams()
  const eventIdParam = params?.eventId
  const eventId = Array.isArray(eventIdParam) ? eventIdParam[0] : String(eventIdParam ?? '')
  const supabase = useMemo<SupabaseClient>(() => createClient(), [])

  const [contract, setContract] = useState<ApplicationContract | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadContract() {
      setError(null)
      setLoading(true)
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/admin/login')
        return
      }
      const { data, error: contractError } = await supabase.rpc('get_event_application_contract', { p_event_id: eventId })
      if (contractError) {
        setError(contractError.message)
        setLoading(false)
        return
      }
      setContract(data as ApplicationContract | null)
      setLoading(false)
    }

    if (eventId) loadContract()
  }, [eventId, router, supabase])

  if (loading) return <main className="container"><div className="empty-state">Cargando contrato de aplicación...</div></main>
  if (!contract?.event) return <main className="container"><div className="error-box">No se encontró el evento.</div></main>

  const summary = contract.summary

  return (
    <main className="container dashboard-page event-application-contract-page">
      <style>{pageStyles}</style>
      <div className="detail-backlink"><Link href={`/admin/eventos/${eventId}/plan`}>← Volver al plan</Link></div>

      <section className="dashboard-hero card contract-hero">
        <div>
          <p className="eyebrow">Fase 1 · contrato de aplicación</p>
          <h1>{contract.event.title}</h1>
          <p className="lead">Define qué acciones podrán automatizarse, cuáles requieren revisión manual y qué condiciones deben cumplirse antes de aplicar cualquier cambio real.</p>
          <div className="badge-row">
            <Link className="button button-secondary" href={`/admin/eventos/${eventId}`}>Revisar evento</Link>
            <Link className="button button-secondary" href={`/admin/eventos/${eventId}/plan`}>Plan de acciones</Link>
          </div>
        </div>
        <div className="contract-summary">
          <span className="mini-badge warning">Aplicación bloqueada</span>
          <strong>{statusLabel(contract.event.status)}</strong>
          <span className="meta">{summary.phase_1_lock_reason}</span>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="metric-grid">
        <div className="contract-card"><strong>{summary.action_count}</strong><span className="meta">acciones</span></div>
        <div className="contract-card"><strong>{summary.auto_apply_allowed_count}</strong><span className="meta">automatizables</span></div>
        <div className="contract-card"><strong>{summary.manual_application_count}</strong><span className="meta">manuales con estado</span></div>
        <div className="contract-card"><strong>{summary.manual_only_count}</strong><span className="meta">solo manuales</span></div>
      </section>

      <section className="metric-grid">
        <div className="contract-card"><strong>{summary.ready_count}</strong><span className="meta">listas</span></div>
        <div className="contract-card"><strong>{summary.planned_count}</strong><span className="meta">sin revisar</span></div>
        <div className="contract-card"><strong>{summary.relationship_error_count}</strong><span className="meta">errores relacionales</span></div>
        <div className="contract-card"><strong>{summary.relationship_warning_count}</strong><span className="meta">advertencias</span></div>
      </section>

      <section className="contract-grid">
        <div className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Acciones</p><h2>Contrato por acción</h2><p className="meta">Cada acción declara su estrategia de aplicación y su fase de implementación.</p></div></div>
          <div className="actions-list">
            {contract.actions.length === 0 && <div className="empty-state">El evento todavía no tiene acciones generadas.</div>}
            {contract.actions.map((action) => (
              <article className="contract-action" key={action.id}>
                <div><p className="eyebrow">Orden {action.sort_order}</p><h2>{action.action_type_name}</h2></div>
                <div className="badge-row">
                  <span className={`mini-badge ${badgeClass(action)}`}>{contractStatusLabel(action.contract_status)}</span>
                  <span className="mini-badge">{strategyLabel(action.apply_strategy)}</span>
                  <span className="mini-badge">{action.implementation_phase}</span>
                  <span className="mini-badge">{statusLabel(action.status)}</span>
                  {action.changes_state && <span className="mini-badge warning">Cambia estado</span>}
                  {action.auto_apply_allowed && <span className="mini-badge success">Automatizable</span>}
                  {action.subject_entity_name && <span className="mini-badge">Origen: {action.subject_entity_name}</span>}
                  {action.target_entity_name && <span className="mini-badge">Destino: {action.target_entity_name}</span>}
                  {action.relationship_type_name && <span className="mini-badge">Relación: {action.relationship_type_name}</span>}
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Condiciones futuras</p><h2>Antes de aplicar</h2></div></div>
          <div className="requirements-list">
            {(summary.future_can_apply_when ?? []).map((item) => <div className="contract-card" key={item}><span className="meta">{item}</span></div>)}
          </div>
          <div className="contract-card highlight">
            <strong>Regla actual</strong>
            <span className="meta">Fase 1 solo define contrato. No hay mutación de estado, relaciones ni fichas vigentes.</span>
          </div>
        </aside>
      </section>
    </main>
  )
}
