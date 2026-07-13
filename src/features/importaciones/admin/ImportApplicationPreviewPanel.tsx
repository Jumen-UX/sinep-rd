import { buildImportApplicationPreview } from '@/features/importaciones/domain/import-application-preview'
import type { ImportBatchRowDetail } from '@/features/importaciones/services/batch-import-admin-service'

type Props = {
  rows: ImportBatchRowDetail[]
  serverCanApply: boolean
}

function formatTableName(value: string) {
  return value.replaceAll('_', ' ')
}

export default function ImportApplicationPreviewPanel({ rows, serverCanApply }: Props) {
  const preview = buildImportApplicationPreview(rows)
  const ready = !preview.isCompleted && preview.canApply && serverCanApply

  return (
    <div className="compact-section" aria-label="Vista previa de aplicación">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Vista previa antes de aplicar</p>
          <h3>{preview.isCompleted ? 'Aplicación completada' : ready ? 'Operaciones resueltas' : 'La aplicación todavía está bloqueada'}</h3>
          <p className="meta">
            Esta vista no modifica datos. Resume las operaciones determinadas durante la validación vigente.
          </p>
        </div>
        <span className="role-pill">{preview.isCompleted ? 'Lote finalizado' : ready ? 'Lista para aplicar' : 'Requiere atención'}</span>
      </div>

      <div className="admin-stat-strip" aria-label="Operaciones previstas">
        <div><span>＋</span><strong>{preview.createRows}</strong><small>Creaciones</small></div>
        <div><span>↻</span><strong>{preview.updateRows}</strong><small>Actualizaciones</small></div>
        <div><span>＝</span><strong>{preview.noopRows}</strong><small>Sin cambios</small></div>
        <div><span>✓</span><strong>{preview.completedRows}</strong><small>Completadas</small></div>
        <div><span>×</span><strong>{preview.blockedRows}</strong><small>Bloqueadas</small></div>
        <div><span>?</span><strong>{preview.unresolvedTargets}</strong><small>Sin objetivo</small></div>
      </div>

      {preview.targetTables.length > 0 && (
        <div className="admin-system-list">
          {preview.targetTables.map((target) => (
            <div key={target.table}>
              <span>{formatTableName(target.table)}</span>
              <strong>{target.count} fila(s)</strong>
            </div>
          ))}
        </div>
      )}

      {preview.isCompleted && (
        <div className="admin-info-box">
          <span>
            El lote ya fue procesado. Las creaciones, actualizaciones y coincidencias sin cambio conservan su objetivo y auditoría sin permitir una segunda aplicación.
          </span>
        </div>
      )}

      {!preview.isCompleted && !preview.canApply && (
        <div className="admin-info-box">
          <span>
            Corrige las filas bloqueadas y vuelve a validar hasta que cada fila tenga una operación y un objetivo canónico resueltos.
          </span>
        </div>
      )}

      {!preview.isCompleted && preview.canApply && !serverCanApply && (
        <div className="admin-info-box">
          <span>
            Las operaciones están resueltas, pero aún falta aprobación editorial, permiso de aplicación o alcance autorizado.
          </span>
        </div>
      )}
    </div>
  )
}
