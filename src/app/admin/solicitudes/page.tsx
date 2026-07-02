'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type RequestRow = {
  id: string
  target_table: string | null
  action_type: string | null
  title: string
  description: string | null
  status: string
  priority: string | null
  scope_type: string | null
  scope_entity_name: string | null
  diocese_name: string | null
  pastoral_area_name: string | null
  submitted_by_name: string | null
  submitted_by_email: string | null
  submitted_at: string | null
  created_at: string
}

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function SolicitudesPage() {
  const router = useRouter()
  const [items, setItems] = useState<RequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function loadRequests() {
      const { data: userData } = await supabase.auth.getUser()

      if (!userData.user) {
        router.replace('/admin/login')
        return
      }

      const { data, error: requestError } = await supabase
        .from('admin_pending_change_requests')
        .select('id,target_table,action_type,title,description,status,priority,scope_type,scope_entity_name,diocese_name,pastoral_area_name,submitted_by_name,submitted_by_email,submitted_at,created_at')
        .order('created_at', { ascending: false })

      if (requestError) {
        setError(requestError.message)
        setLoading(false)
        return
      }

      setItems((data ?? []) as RequestRow[])
      setLoading(false)
    }

    loadRequests()
  }, [router])

  return (
    <main className="container admin-dashboard">
      <div className="page-heading">
        <Link className="meta" href="/admin">← Volver al panel</Link>
        <p className="eyebrow">Aprobaciones</p>
        <h1>Solicitudes de cambio</h1>
        <p className="lead">
          Bandeja inicial de solicitudes pendientes de revisión y aprobación.
        </p>
      </div>

      {loading && <div className="empty-state">Cargando solicitudes...</div>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="empty-state">
          No hay solicitudes pendientes por ahora.
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <section className="request-list">
          {items.map((item) => (
            <article className="entity-card request-card" key={item.id}>
              <div className="request-card-header">
                <div>
                  <p className="entity-type">{item.action_type ?? 'Solicitud'}</p>
                  <h2>{item.title}</h2>
                </div>
                <span className="role-pill">{item.status}</span>
              </div>

              {item.description && <p className="meta">{item.description}</p>}

              <div className="request-meta-grid">
                <p className="meta"><strong>Tabla:</strong> {item.target_table ?? 'No definida'}</p>
                <p className="meta"><strong>Prioridad:</strong> {item.priority ?? 'Normal'}</p>
                <p className="meta"><strong>Ámbito:</strong> {item.scope_entity_name ?? item.diocese_name ?? item.scope_type ?? 'Nacional'}</p>
                <p className="meta"><strong>Pastoral:</strong> {item.pastoral_area_name ?? 'No aplica'}</p>
                <p className="meta"><strong>Enviada por:</strong> {item.submitted_by_name ?? item.submitted_by_email ?? 'No indicado'}</p>
                <p className="meta"><strong>Fecha:</strong> {formatDate(item.submitted_at ?? item.created_at)}</p>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
