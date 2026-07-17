'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { hasEventAdminSession } from '../services/event-draft-admin-service'
import {
  applyOrganizationUnitEvent,
  loadEventApplicationContract,
  type ApplicationContract,
  type ContractAction,
} from '../services/event-application-admin-service'

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

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
  if (status === 'applied') return 'Aplicada'
  if (status === 'eligible_now') return 'Lista para aplicar'
  if (status === 'blocked_failed_action') return 'Bloqueada por observación'
  if (status === 'blocked_not_reviewed') return 'Falta revisar'
  if (status === 'manual_only') return 'Requiere decisión manual'
  if (status === 'requires_manual_application') return 'Requiere aplicación manual'
  if (status === 'review_required') return 'Requiere revisión'
  return status ?? '—'
}

function lockReasonLabel(reason?: string | null) {
  if (!reason) return 'El contrato está listo para aplicar.'
  if (reason === 'entity_application_not_enabled') return 'La aplicación automática de eventos jurisdiccionales todavía no está habilitada.'
  if (reason === 'event_not_approved') return 'El evento debe aprobarse antes de aplicar.'
  if (reason === 'event_actions_not_ready') return 'Todas las acciones deben quedar listas y sin observaciones.'
  return reason
}

function badgeClass(action: ContractAction) {
  if (action.contract_status.startsWith('blocked')) return 'danger'
  if (action.contract_status === 'applied' || action.contract_status === 'eligible_now') return 'success'
  return 'warning'
}

export default function EventApplicationContractPage() {
  const router = useRouter()
  const params = useParams<{ eventId: string }>()
  const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId
  const supabase = useMemo(() => createClient(), [])
  const [contract, setContract] = useState<ApplicationContract | null>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function refreshContract() {
    setError(null)
    setLoading(true)

    try {
      if (!await hasEventAdminSession(supabase)) {
        router.replace('/admin/login')
        return
      }

      setContract(await loadEventApplicationContract(supabase, eventId))
    } catch (loadError) {
      setError(errorMessage(loadError, 'No se pudo cargar el contrato de aplicación.'))
    } finally {
      setLoading(false)
    }
  }

  async function applyEvent() {
    if (!contract?.summary.can_apply || contract.event.applies_to !== 'organization_unit') return

    setApplying(true)
    setError(null)
    setMessage(null)

    try {
      const result = await applyOrganizationUnitEvent(supabase, eventId)
      setMessage(`Evento aplicado. ${result.applied_action_count ?? 0} acción(es) quedaron selladas.`)
      await refreshContract()
    } catch (applyError) {
      setError(errorMessage(applyError, 'No se pudo aplicar el evento organizativo.'))
    } finally {
      setApplying(false)
    }
  }

  useEffect(() => {
    if (eventId) void refreshContract()
    // refreshContract uses the stable route id and Supabase client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  if (loading) {
    return <main className="container"><div className="empty-state" role="status" aria-live="polite">Cargando contrato de aplicación...</div></main>
  }

  if (!contract?.event) {
    return <main className="container"><div className="error-box" role="alert">No se encontró el evento.</div></main>
  }

  const summary = contract.summary
  const isOrganizational = contract.event.applies_to === 'organization_unit'
  const isApplied = contract.event.status === 'applied'

  return (
    <main className="container dashboard-page event-application-contract-page" aria-busy={applying}>
      <div className="detail-backlink"><Link href={`/admin/eventos/${eventId}/plan`}>← Volver al plan</Link></div>

      <section className="dashboard-hero card contract-hero">
        <div>
          <p className="eyebrow">Contrato de aplicación</p>
          <h1>{contract.event.title}</h1>
          <p className="lead">Declara qué acciones están listas, cuáles requieren revisión y si el evento puede modificar el estado vigente.</p>
          <div className="badge-row">
            <Link className="button button-secondary" href={`/admin/eventos/${eventId}`}>Revisar evento</Link>
            <Link className="button button-secondary" href={`/admin/eventos/${eventId}/plan`}>Plan de acciones</Link>
            {isOrganizational && !isApplied && (
              <button
                aria-busy={applying}
                aria-describedby="contract-application-guidance"
                className="button button-primary"
                disabled={!summary.can_apply || applying}
                onClick={applyEvent}
                type="button"
              >
                {applying ? 'Aplicando…' : 'Aplicar evento'}
              </button>
            )}
          </div>
        </div>
        <div className="contract-summary" aria-live="polite" aria-atomic="true">
          <span className={`mini-badge ${isApplied || summary.can_apply ? 'success' : 'warning'}`}>{isApplied ? 'Aplicado' : summary.can_apply ? 'Listo para aplicar' : 'Aplicación bloqueada'}</span>
          <strong>{statusLabel(contract.event.status)}</strong>
          <span className="meta">{lockReasonLabel(summary.apply_lock_reason)}</span>
        </div>
      </section>

      {error && <div className="error-box" role="alert" aria-live="assertive">{error}</div>}
      {message && <div className="success-box" role="status" aria-live="polite" aria-atomic="true">{message}</div>}

      <section className="metric-grid" aria-label="Resumen del contrato de aplicación">
        <div className="contract-card"><strong>{summary.action_count}</strong><span className="meta">acciones</span></div>
        <div className="contract-card"><strong>{summary.ready_count}</strong><span className="meta">listas</span></div>
        <div className="contract-card"><strong>{summary.applied_count}</strong><span className="meta">aplicadas</span></div>
        <div className="contract-card"><strong>{summary.failed_count}</strong><span className="meta">con observación</span></div>
      </section>

      <section className="contract-grid">
        <div className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Acciones</p><h2>Contrato por acción</h2><p className="meta">Cada acción declara su estrategia, estado y objetivo.</p></div></div>
          <div className="actions-list" aria-label="Acciones incluidas en el contrato">
            {contract.actions.length === 0 && <div className="empty-state" role="status">El evento todavía no tiene acciones generadas.</div>}
            {contract.actions.map((action) => (
              <article
                aria-label={`${action.action_type_name}: ${contractStatusLabel(action.contract_status)}`}
                className="contract-action"
                key={action.id}
              >
                <div><p className="eyebrow">Orden {action.sort_order}</p><h3>{action.action_type_name}</h3></div>
                <div className="badge-row">
                  <span className={`mini-badge ${badgeClass(action)}`}>{contractStatusLabel(action.contract_status)}</span>
                  <span className="mini-badge">{strategyLabel(action.apply_strategy)}</span>
                  <span className="mini-badge">{action.implementation_phase}</span>
                  <span className="mini-badge">{statusLabel(action.status)}</span>
                  {action.changes_state && <span className="mini-badge warning">Cambia estado</span>}
                  {action.subject_entity_name && <span className="mini-badge">Origen: {action.subject_entity_name}</span>}
                  {action.target_entity_name && <span className="mini-badge">Destino: {action.target_entity_name}</span>}
                  {action.subject_organization_unit_name && <span className="mini-badge">Unidad: {action.subject_organization_unit_name}</span>}
                  {action.target_organization_unit_name && <span className="mini-badge">Superior: {action.target_organization_unit_name}</span>}
                  {action.relationship_type_name && <span className="mini-badge">Relación: {action.relationship_type_name}</span>}
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Condiciones</p><h2>Estado del contrato</h2></div></div>
          <div className="requirements-list" aria-label="Condiciones para aplicar el evento">
            <div className="contract-card"><strong>Tipo de destino</strong><span className="meta">{isOrganizational ? 'Unidad organizativa' : 'Entidad eclesiástica'}</span></div>
            <div className="contract-card"><strong>Acciones planificadas</strong><span className="meta">{summary.planned_count}</span></div>
            <div className="contract-card"><strong>Errores relacionales</strong><span className="meta">{summary.relationship_error_count}</span></div>
            <div className="contract-card"><strong>Acciones solo manuales</strong><span className="meta">{summary.manual_only_count}</span></div>
          </div>
          <div className="contract-card highlight" id="contract-application-guidance">
            <strong>Regla vigente</strong>
            <span className="meta">{isOrganizational ? 'Los eventos organizativos aprobados pueden aplicarse transaccionalmente cuando todas sus acciones están listas.' : 'Los eventos jurisdiccionales siguen limitados a revisión y planificación; su mutación automática permanece bloqueada.'}</span>
          </div>
        </aside>
      </section>
    </main>
  )
}