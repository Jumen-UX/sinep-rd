'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>

type HealthResponse = {
  phase: string
  status: string
  tables: Record<string, boolean>
  functions: Record<string, boolean>
  counts: Record<string, number>
  readiness: Record<string, boolean>
  required_manual_test: string[]
  closure_criteria: string[]
  next_gate: string
}

const pageStyles = `
  .phase2-health-page .hero-grid{align-items:stretch;grid-template-columns:minmax(0,1fr) minmax(280px,.42fr)}.health-card,.metric-card-small,.check-card{background:#fff;border:1px solid var(--border);border-radius:16px;display:grid;gap:8px;padding:14px}.health-card.highlight,.check-card.ok{background:#fbf8f1}.check-card.fail{background:#fff7ed;border-color:#fed7aa}.layout-grid,.metric-grid,.check-grid,.list-grid{display:grid;gap:14px}.layout-grid{align-items:start;grid-template-columns:minmax(0,1fr) minmax(340px,.45fr)}.metric-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.check-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.button-row{display:flex;flex-wrap:wrap;gap:8px}.mini-badge{background:#fbf8f1;border:1px solid var(--border);border-radius:999px;color:var(--primary);display:inline-flex;font-size:12px;font-weight:900;padding:6px 9px}.mini-badge.success{background:#f0fdf4;color:#166534}.mini-badge.warning{background:#fff7ed;color:#9a3412}.detail-backlink{margin-bottom:8px}.detail-backlink a{color:var(--primary);font-weight:800;text-decoration:none}@media(max-width:980px){.phase2-health-page .hero-grid,.layout-grid,.metric-grid,.check-grid{grid-template-columns:1fr}}
`

function CheckCard({ label, ok }: { label: string; ok: boolean }) {
  return <div className={`check-card ${ok ? 'ok' : 'fail'}`}><strong>{ok ? '✓' : '⚠'} {label}</strong><span className="meta">{ok ? 'Listo' : 'Pendiente o incompleto'}</span></div>
}

function keyLabel(value: string) {
  return value.replaceAll('_', ' ')
}

export default function Phase2StructuralHealthPage() {
  const router = useRouter()
  const supabase = useMemo<SupabaseClient>(() => createClient(), [])
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadHealth() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { router.push('/admin/login'); return }
      const { data, error: healthError } = await supabase.rpc('get_phase2_structural_workflow_health')
      if (healthError) setError(healthError.message)
      setHealth((data ?? null) as HealthResponse | null)
      setLoading(false)
    }
    loadHealth()
  }, [router, supabase])

  if (loading) return <main className="container"><div className="empty-state">Cargando verificación de Fase 2...</div></main>
  if (!health) return <main className="container"><div className="error-box">No se pudo cargar la verificación de Fase 2.</div></main>

  const counts = health.counts ?? {}
  const readiness = health.readiness ?? {}
  const statusReady = health.status === 'ready_for_functional_test'

  return (
    <main className="container dashboard-page phase2-health-page">
      <style>{pageStyles}</style>
      <div className="detail-backlink"><Link href="/admin/estructura/eventos">← Volver a eventos estructurales</Link></div>

      <section className="dashboard-hero card hero-grid">
        <div>
          <p className="eyebrow">Fase 2 · verificación</p>
          <h1>Eventos de evolución estructural</h1>
          <p className="lead">Verifica que el registro, impacto, plan, editor, conflictos y contrato estén listos antes de cerrar la fase.</p>
          <div className="button-row"><Link className="button button-primary" href="/admin/estructura/eventos">Crear evento estructural</Link><Link className="button button-secondary" href="/admin/estructura">Motor de estructuras</Link></div>
        </div>
        <div className="health-card highlight"><span className={`mini-badge ${statusReady ? 'success' : 'warning'}`}>{health.status}</span><strong>{health.phase}</strong><span className="meta">Siguiente compuerta: {health.next_gate}</span></div>
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="metric-grid">
        <div className="metric-card-small"><strong>{counts.structure_events_total ?? 0}</strong><span className="meta">eventos estructurales</span></div>
        <div className="metric-card-small"><strong>{counts.structure_event_actions_total ?? 0}</strong><span className="meta">acciones generadas</span></div>
        <div className="metric-card-small"><strong>{counts.active_action_types ?? 0}</strong><span className="meta">tipos de acción</span></div>
        <div className="metric-card-small"><strong>{counts.current_nodes ?? 0}</strong><span className="meta">nodos vigentes</span></div>
      </section>

      <section className="layout-grid">
        <div className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Checklist técnico</p><h2>Preparación del flujo</h2></div></div>
          <div className="check-grid">
            {Object.entries(readiness).map(([key, value]) => <CheckCard key={key} label={keyLabel(key)} ok={Boolean(value)} />)}
          </div>
        </div>

        <aside className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Prueba manual</p><h2>Ruta obligatoria</h2></div></div>
          <div className="list-grid">{(health.required_manual_test ?? []).map((item) => <div className="health-card" key={item}><span className="meta">{item}</span></div>)}</div>
        </aside>
      </section>

      <section className="layout-grid">
        <div className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Cierre de fase</p><h2>Criterios</h2></div></div>
          <div className="list-grid">{(health.closure_criteria ?? []).map((item) => <div className="health-card" key={item}><strong>✓ {item}</strong></div>)}</div>
        </div>

        <aside className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Bloqueo</p><h2>Aplicación real</h2></div></div>
          <div className="health-card highlight"><strong>No se aplican mutaciones</strong><span className="meta">Fase 2 valida el flujo y mantiene bloqueada la modificación real de nodos y jerarquías.</span></div>
          <div className="button-row"><Link className="button button-primary" href="/admin/estructura/eventos">Abrir registro</Link><Link className="button button-secondary" href="/admin">Panel administrativo</Link></div>
        </aside>
      </section>
    </main>
  )
}
