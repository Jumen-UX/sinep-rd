'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  loadRecentAdministrativeActivity,
  type ActivityRow,
} from '../services/audit-admin-service'

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function readableAction(value: string) {
  return value.replaceAll('_', ' ')
}

export default function AdministrativeActivityPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadRows() {
      try {
        const activity = await loadRecentAdministrativeActivity(supabase)
        if (!activity) {
          router.replace('/admin/login')
          return
        }
        setRows(activity)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la actividad administrativa.')
      } finally {
        setLoading(false)
      }
    }

    loadRows()
  }, [router, supabase])

  if (loading) {
    return <main className="container"><div className="empty-state">Cargando actividad...</div></main>
  }

  return (
    <main className="container admin-dashboard">
      <div className="admin-topbar">
        <div>
          <p className="eyebrow">Registros administrativos</p>
          <h1>Actividad reciente</h1>
          <p className="lead">Consulta movimientos recientes sobre usuarios, roles y cambios administrativos.</p>
        </div>
        <Link className="button button-secondary" href="/admin/configuracion">Volver a configuración</Link>
      </div>

      {error && <div className="error-box">{error}</div>}

      <section className="card admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Últimos movimientos</p>
            <h2>{rows.length} registros visibles</h2>
            <p className="meta">Se muestra fecha, usuario, acción y destino del cambio.</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="empty-state">Todavía no hay actividad visible para tu rol.</div>
        ) : (
          <div className="grid admin-modules">
            {rows.map((row) => (
              <article className="entity-card admin-module" key={row.id}>
                <p className="entity-type">{formatDateTime(row.created_at)}</p>
                <h2>{readableAction(row.action)}</h2>
                <p className="meta">{row.actor_name ?? row.actor_email ?? 'Usuario no identificado'}</p>
                <p className="meta">{row.target_table} · {row.target_id ? row.target_id.slice(0, 8) : 'sin destino'}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
