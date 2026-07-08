'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>

type PendingEvent = {
  source_kind: string
  event_id: string
  event_date: string | null
  title: string
  event_type_name: string | null
  related_entity_name: string | null
  source_name: string | null
  evidence_status: string | null
  load_mode: string
  workflow_status: string
}

const pageStyles = `
  .pending-events-layout,.pending-events-list{display:grid;gap:14px}.pending-event-card{background:#fff;border:1px solid var(--border);border-radius:16px;display:grid;gap:8px;padding:16px}.pending-event-card.highlight{background:#fbf8f1;border-style:dashed}.badge-row{display:flex;flex-wrap:wrap;gap:7px}.mini-badge{background:#fbf8f1;border:1px solid var(--border);border-radius:999px;color:var(--primary);display:inline-flex;font-size:12px;font-weight:900;padding:6px 9px}.mini-badge.warning{background:#fff7ed;color:#9a3412}.detail-backlink{margin-bottom:8px}.detail-backlink a{color:var(--primary);font-weight:800;text-decoration:none}
`

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

function modeLabel(value: string) {
  if (value === 'carga_historica') return 'Carga histórica'
  if (value === 'evento_nuevo') return 'Evento nuevo'
  if (value === 'foto_inicial') return 'Foto inicial'
  return value
}

function evidenceLabel(value?: string | null) {
  if (value === 'confirmado_oficial' || value === 'documentado' || value === 'verified') return 'Documentado'
  if (value === 'fuente_secundaria') return 'Fuente secundaria'
  if (value === 'importado_vigente') return 'Importado vigente'
  if (value === 'pendiente_documento') return 'Documento pendiente'
  if (value === 'contradictorio') return 'Contradictorio'
  return value ?? 'Sin evidencia'
}

export default function PendingEventsPage() {
  const router = useRouter()
  const supabase = useMemo<SupabaseClient>(() => createClient(), [])
  const [events, setEvents] = useState<PendingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadEvents() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/admin/login')
        return
      }

      const { data, error: loadError } = await supabase.rpc('get_event_registry_stream', {
        p_year: null,
        p_month: null,
        p_event_type: null,
        p_entity_id: null,
        p_limit: 300,
      })

      if (loadError) {
        setError(loadError.message)
        setLoading(false)
        return
      }

      setEvents(((data ?? []) as PendingEvent[]).filter((event) => event.source_kind === 'canonical_event' && ['draft', 'pending_review', 'approved'].includes(event.workflow_status)))
      setLoading(false)
    }

    loadEvents()
  }, [router, supabase])

  if (loading) return <main className="container"><div className="empty-state">Cargando cola de revisión...</div></main>

  return (
    <main className="container dashboard-page pending-events-page">
      <style>{pageStyles}</style>
      <div className="detail-backlink"><Link href="/admin/eventos">← Volver a eventos</Link></div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Eventos · revisión</p>
          <h1>Cola de revisión</h1>
          <p className="lead">Eventos creados por el asistente que todavía no se han aplicado. La aprobación valida el evento, pero no altera el estado vigente.</p>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="pending-events-list">
        {events.length === 0 && <div className="empty-state">No hay eventos pendientes de revisión.</div>}
        {events.map((event) => (
          <article className="pending-event-card" key={event.event_id}>
            <div>
              <p className="eyebrow">{formatDate(event.event_date)}</p>
              <h2>{event.title}</h2>
              <p className="meta">{event.event_type_name ?? 'Tipo no definido'} · {event.related_entity_name ?? 'Sin entidad principal'}</p>
            </div>
            <div className="badge-row">
              <span className="mini-badge warning">{event.workflow_status}</span>
              <span className="mini-badge">{modeLabel(event.load_mode)}</span>
              <span className="mini-badge">{evidenceLabel(event.evidence_status)}</span>
              {event.source_name && <span className="mini-badge">Fuente: {event.source_name}</span>}
            </div>
            <Link className="button button-primary" href={`/admin/eventos/${event.event_id}`}>Revisar</Link>
          </article>
        ))}
      </section>
    </main>
  )
}
