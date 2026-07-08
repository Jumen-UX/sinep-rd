'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ActivityRow = {
  id: string
  actor_email: string | null
  actor_name: string | null
  action: string
  target_table: string
  target_id: string | null
  created_at: string
}

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

export default function AdminActivityPage() {
  const router = useRouter()
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function loadRows() {
      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (userError || !userData.user) {
        router.replace('/admin/login')
        return
      }

      const { data, error: rowsError } = await supabase.rpc('admin_list_recent_audit_logs', {
        p_limit: 150,
      })

      if (rowsError) {
        setError(rowsError.message)
        setLoading(false)
        return
      }

      setRows((data ?? []) as ActivityRow[])
      setLoading(false)
    }

    loadRows()
  }, [router])

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
