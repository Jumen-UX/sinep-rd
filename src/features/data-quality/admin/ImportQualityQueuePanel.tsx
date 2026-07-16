'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { loadReviewQueue } from '@/features/review/services/review-admin-service'

export default function ImportQualityQueuePanel() {
  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let active = true
    loadReviewQueue()
      .then((items) => {
        if (active) setPendingCount(items.filter((item) => item.item_type === 'import_batch').length)
      })
      .catch(() => {
        if (active) setLoadFailed(true)
      })
    return () => { active = false }
  }, [])

  return (
    <section className="container dashboard-page admin-config-page" aria-labelledby="import-quality-title">
      <div className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Calidad de importaciones</p>
            <h2 id="import-quality-title">Lotes que requieren intervención</h2>
            <p className="meta">Los errores, duplicados, referencias no resueltas y fallos de aplicación se corrigen en el detalle del lote para conservar la vista previa, el alcance y la auditoría.</p>
          </div>
          <span className="role-pill">
            {loadFailed ? 'Consulta no disponible' : pendingCount === null ? 'Calculando…' : `${pendingCount} pendientes`}
          </span>
        </div>
        <div className="admin-top-actions">
          <Link className="button button-primary" href="/admin/revision">Abrir cola de revisión</Link>
          <Link className="button button-secondary" href="/admin/importar/lotes">Ver historial de lotes</Link>
        </div>
      </div>
    </section>
  )
}