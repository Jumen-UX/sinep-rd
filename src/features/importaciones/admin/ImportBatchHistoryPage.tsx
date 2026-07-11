'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  listImportBatches,
  type ImportBatchListItem,
  type ImportBatchStatus,
} from '@/features/importaciones/services/batch-import-admin-service'

const statusLabels: Record<string, string> = {
  prepared: 'Preparado',
  validating: 'Validando',
  needs_review: 'Requiere revisión',
  validated: 'Validado',
  applying: 'Aplicando',
  applied: 'Aplicado',
  failed: 'Fallido',
  cancelled: 'Cancelado',
}

const reviewLabels: Record<string, string> = {
  pending: 'Pendiente de aprobación',
  approved: 'Aprobado',
  rejected: 'Rechazado',
}

const typeLabels: Record<string, string> = {
  personas: 'Personas',
  parroquias: 'Estructuras',
  asignaciones: 'Nombramientos',
  eventos: 'Eventos',
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function ImportBatchHistoryPage() {
  const [batches, setBatches] = useState<ImportBatchListItem[]>([])
  const [statusFilter, setStatusFilter] = useState<ImportBatchStatus | ''>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadBatches = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await listImportBatches({
        status: statusFilter || undefined,
        limit: 50,
      })
      setBatches(result)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron consultar los lotes.')
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    void loadBatches()
  }, [loadBatches])

  return (
    <div id="top">
      <header className="admin-top-header">
        <div className="admin-top-title">
          <span className="admin-mini-mark">IMPORTAR</span>
          <strong>Historial de lotes</strong>
        </div>
        <div className="admin-top-actions">
          <a className="button button-secondary" href="/admin">Volver al panel</a>
          <a className="button button-primary" href="/admin/importar">Preparar nuevo lote</a>
        </div>
      </header>

      <section className="admin-welcome-panel">
        <div>
          <p className="eyebrow">Carga masiva controlada</p>
          <h1>Lotes preparados y validados</h1>
          <p className="lead">Consulta archivos persistidos, abre sus filas, revisa incidencias, corrige datos y registra la aprobación editorial sin modificar todavía los registros canónicos.</p>
          <div className="role-list admin-role-list">
            <span className="role-pill">RLS por alcance</span>
            <span className="role-pill">Corrección por fila</span>
            <span className="role-pill">Aprobación explícita</span>
            <span className="role-pill">Aplicación deshabilitada</span>
          </div>
        </div>
        <div className="admin-welcome-illustration" aria-hidden="true">▤</div>
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Historial persistente</p>
            <h2>Lotes accesibles dentro de tu alcance</h2>
            <p className="meta">Los resultados más recientes aparecen primero.</p>
          </div>
          <div className="admin-top-actions">
            <label>
              Estado
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">Todos</option>
                <option value="needs_review">Requiere revisión</option>
                <option value="validated">Validado</option>
                <option value="failed">Fallido</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </label>
            <button className="button button-secondary" disabled={isLoading} onClick={() => void loadBatches()} type="button">
              {isLoading ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>
        </div>

        {isLoading && batches.length === 0 ? (
          <div className="empty-state">
            <h3>Cargando lotes</h3>
            <p>Consultando las importaciones disponibles.</p>
          </div>
        ) : batches.length === 0 ? (
          <div className="empty-state">
            <h3>No hay lotes para este filtro</h3>
            <p>Prepara un archivo CSV o cambia el estado seleccionado.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Archivo</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Validación</th>
                  <th scope="col">Revisión</th>
                  <th scope="col">Filas</th>
                  <th scope="col">Incidencias</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">Acción</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => {
                  const incidentCount = batch.error_rows + batch.duplicate_rows + batch.unresolved_rows
                  return (
                    <tr key={batch.id}>
                      <td>
                        <strong>{batch.file_name}</strong>
                        <small>{formatBytes(batch.file_size_bytes)} · {batch.file_sha256.slice(0, 12)}…</small>
                      </td>
                      <td>{typeLabels[batch.import_type] ?? batch.import_type}</td>
                      <td><span className="role-pill">{statusLabels[batch.status] ?? batch.status}</span></td>
                      <td><span className="role-pill">{reviewLabels[batch.review_status] ?? batch.review_status}</span></td>
                      <td>{batch.row_count}</td>
                      <td>{incidentCount > 0 ? incidentCount : 'Sin bloqueos'}</td>
                      <td>{formatDate(batch.created_at)}</td>
                      <td><a className="button button-secondary" href={`/admin/importar/${batch.id}`}>Abrir lote</a></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
