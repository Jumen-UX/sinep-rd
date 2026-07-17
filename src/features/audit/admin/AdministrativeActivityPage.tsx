'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { PageState } from '@/components/ui/page-state'
import { StatusBadge } from '@/components/ui/status-badge'
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

    void loadRows()
  }, [router, supabase])

  return (
    <main className="container admin-dashboard">
      <PageHeader
        breadcrumbs={[
          { label: 'Administración', href: '/admin' },
          { label: 'Configuración', href: '/admin/configuracion' },
          { label: 'Actividad' },
        ]}
        eyebrow="Registros administrativos"
        title="Actividad reciente"
        description="Consulta movimientos recientes sobre usuarios, roles y cambios administrativos disponibles para tu alcance."
        metadata={
          <StatusBadge tone={rows.length > 0 ? 'info' : 'neutral'} dot>
            {rows.length} registro{rows.length === 1 ? '' : 's'} visible{rows.length === 1 ? '' : 's'}
          </StatusBadge>
        }
        actions={
          <Button asChild variant="secondary">
            <Link href="/admin/configuracion">Volver a configuración</Link>
          </Button>
        }
      />

      {loading ? (
        <PageState
          compact
          kind="loading"
          title="Cargando actividad"
          description="Estamos preparando los movimientos administrativos visibles para tu perfil."
        />
      ) : error ? (
        <PageState
          kind="error"
          title="No pudimos cargar la actividad"
          description={error}
        />
      ) : rows.length === 0 ? (
        <PageState
          kind="empty"
          title="Sin actividad visible"
          description="Todavía no hay movimientos administrativos disponibles para tu rol y alcance."
        />
      ) : (
        <section className="card admin-section" aria-labelledby="activity-list-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Últimos movimientos</p>
              <h2 id="activity-list-heading">Historial administrativo</h2>
              <p className="meta">Cada registro muestra la fecha, el usuario, la acción y el destino del cambio.</p>
            </div>
            <StatusBadge tone="info">{rows.length} visible{rows.length === 1 ? '' : 's'}</StatusBadge>
          </div>

          <div className="grid admin-modules">
            {rows.map((row) => (
              <article className="entity-card admin-module" key={row.id}>
                <p className="entity-type">{formatDateTime(row.created_at)}</p>
                <h3>{readableAction(row.action)}</h3>
                <p className="meta">{row.actor_name ?? row.actor_email ?? 'Usuario no identificado'}</p>
                <p className="meta">{row.target_table} · {row.target_id ? row.target_id.slice(0, 8) : 'sin destino'}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
