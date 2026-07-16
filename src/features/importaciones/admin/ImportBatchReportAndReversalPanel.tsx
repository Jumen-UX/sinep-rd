'use client'

import { useEffect, useState } from 'react'
import { getImportBatchDetail } from '@/features/importaciones/services/batch-import-admin-service'
import { reverseImportBatch } from '@/features/importaciones/services/import-reversal-admin-service'

type Props = { batchId: string }

export default function ImportBatchReportAndReversalPanel({ batchId }: Props) {
  const [status, setStatus] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isReversing, setIsReversing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void getImportBatchDetail(batchId)
      .then((detail) => { if (active) setStatus(detail.batch.status) })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'No se pudo consultar el estado del lote.') })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [batchId])

  async function submitReversal() {
    const normalizedReason = reason.trim()
    if (normalizedReason.length < 10) {
      setError('Indica un motivo de reversión de al menos 10 caracteres.')
      return
    }
    if (!window.confirm('La reversión conservará la historia y puede quedar bloqueada si requiere resolución canónica manual. ¿Deseas continuar?')) return

    setIsReversing(true)
    setError(null)
    setMessage(null)
    try {
      const result = await reverseImportBatch(batchId, normalizedReason)
      setMessage(result.status === 'completed'
        ? `Reversión lógica completada. Se procesaron ${result.plan.reversible_count} cambio(s).`
        : `La solicitud quedó registrada, pero ${result.plan.blocked_count} cambio(s) requieren resolución canónica manual.`)
      setReason('')
    } catch (reversalError) {
      setError(reversalError instanceof Error ? reversalError.message : 'No se pudo registrar la reversión lógica.')
    } finally {
      setIsReversing(false)
    }
  }

  return (
    <section className="card dashboard-section" aria-labelledby="import-report-reversal-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Trazabilidad</p>
          <h2 id="import-report-reversal-title">Reporte y reversión lógica</h2>
          <p className="meta">El reporte incluye operaciones proyectadas, resultados aplicados, incidencias, auditorías y el último estado de reversión.</p>
        </div>
        <a className="button button-secondary" href={`/api/admin/importaciones/${encodeURIComponent(batchId)}/reporte`}>
          Descargar reporte CSV
        </a>
      </div>

      {error && <div className="error-box" role="alert">{error}</div>}
      {message && <div className="success-box" role="status">{message}</div>}

      {isLoading ? <p className="meta">Consultando disponibilidad de reversión…</p> : status === 'applied' ? (
        <div className="auth-form access-form">
          <label htmlFor="import-reversal-reason">Motivo de reversión
            <textarea
              id="import-reversal-reason"
              minLength={10}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explica por qué debe revertirse lógicamente este lote."
              value={reason}
            />
          </label>
          <div className="admin-info-box">
            <span>No se eliminan físicamente personas, entidades, asignaciones ni eventos. Los casos inseguros quedan bloqueados para resolución canónica manual.</span>
          </div>
          <button
            className="button button-secondary"
            disabled={isReversing || reason.trim().length < 10}
            onClick={() => void submitReversal()}
            type="button"
          >
            {isReversing ? 'Registrando reversión…' : 'Solicitar reversión lógica'}
          </button>
        </div>
      ) : (
        <p className="meta">La reversión solo está disponible después de aplicar el lote. El reporte puede descargarse durante cualquier estado para fines de revisión.</p>
      )}
    </section>
  )
}
