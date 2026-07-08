'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>

type HealthResponse = {
  status: string
  counts: Record<string, number>
  readiness: Record<string, boolean>
  required_manual_test: string[]
  closure_criteria: string[]
  next_gate: string
}

const pageStyles = `
  .verify-page .hero-grid,.verify-page .layout-grid{display:grid;gap:14px;grid-template-columns:minmax(0,1fr) minmax(320px,.42fr)}.verify-card,.metric-card-small,.check-card{background:#fff;border:1px solid var(--border);border-radius:16px;display:grid;gap:8px;padding:14px}.verify-card.highlight,.check-card.ok{background:#fbf8f1}.check-card.fail{background:#fff7ed;border-color:#fed7aa}.metric-grid,.check-grid,.list-grid{display:grid;gap:14px}.metric-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.check-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.button-row{display:flex;flex-wrap:wrap;gap:8px}.mini-badge{background:#fbf8f1;border:1px solid var(--border);border-radius:999px;color:var(--primary);display:inline-flex;font-size:12px;font-weight:900;padding:6px 9px}.mini-badge.success{background:#f0fdf4;color:#166534}.mini-badge.warning{background:#fff7ed;color:#9a3412}.detail-backlink{margin-bottom:8px}.detail-backlink a{color:var(--primary);font-weight:800;text-decoration:none}@media(max-width:980px){.verify-page .hero-grid,.verify-page .layout-grid,.metric-grid,.check-grid{grid-template-columns:1fr}}
`

function label(value: string) {
  return value.replaceAll('_', ' ')
}

export default function StructuralWorkflowVerificationPage() {
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

  if (loading) return <main className="container"><div className="empty-state">Cargando verificación...</div></main>
  if (!health) return <main className="container"><div className="error-box">No se cargó la verificación.</div></main>

  const counts = health.counts ?? {}
  const readiness = health.readiness ?? {}
  const ready = health.status === 'ready_for_functional_test'

  return (
    <main className="container dashboard-page verify-page">
      <style>{pageStyles}</style>
      <div className="detail-backlink"><Link href="/admin/estructura/eventos">← Volver a eventos estructurales</Link></div>
      <section className="dashboard-hero card hero-grid"><div><p className="eyebrow">Verificación interna</p><h1>Flujo de evolución estructural</h1><p className="lead">Revisa registro, impacto, plan, editor, conflictos y contrato antes de cerrar el flujo operativo.</p><div className="button-row"><Link className="button button-primary" href="/admin/estructura/eventos">Crear evento estructural</Link><Link className="button button-secondary" href="/admin/estructura">Motor de estructuras</Link></div></div><div className="verify-card highlight"><span className={`mini-badge ${ready ? 'success' : 'warning'}`}>{health.status}</span><strong>Eventos de evolución estructural</strong><span className="meta">Siguiente compuerta: {health.next_gate}</span></div></section>
      {error && <div className="error-box">{error}</div>}
      <section className="metric-grid"><div className="metric-card-small"><strong>{counts.structure_events_total ?? 0}</strong><span className="meta">eventos</span></div><div className="metric-card-small"><strong>{counts.structure_event_actions_total ?? 0}</strong><span className="meta">acciones</span></div><div className="metric-card-small"><strong>{counts.active_action_types ?? 0}</strong><span className="meta">tipos de acción</span></div><div className="metric-card-small"><strong>{counts.current_nodes ?? 0}</strong><span className="meta">nodos vigentes</span></div></section>
      <section className="layout-grid"><div className="card dashboard-section"><div className="section-heading"><div><p className="eyebrow">Checklist técnico</p><h2>Preparación</h2></div></div><div className="check-grid">{Object.entries(readiness).map(([key, value]) => <div className={`check-card ${value ? 'ok' : 'fail'}`} key={key}><strong>{value ? '✓' : '⚠'} {label(key)}</strong><span className="meta">{value ? 'Listo' : 'Pendiente'}</span></div>)}</div></div><aside className="card dashboard-section"><div className="section-heading"><div><p className="eyebrow">Prueba manual</p><h2>Ruta obligatoria</h2></div></div><div className="list-grid">{(health.required_manual_test ?? []).map((item) => <div className="verify-card" key={item}><span className="meta">{item}</span></div>)}</div></aside></section>
      <section className="layout-grid"><div className="card dashboard-section"><div className="section-heading"><div><p className="eyebrow">Cierre del flujo</p><h2>Criterios</h2></div></div><div className="list-grid">{(health.closure_criteria ?? []).map((item) => <div className="verify-card" key={item}><strong>✓ {item}</strong></div>)}</div></div><aside className="card dashboard-section"><div className="section-heading"><div><p className="eyebrow">Regla operativa</p><h2>Sin cambios reales todavía</h2></div></div><div className="verify-card highlight"><strong>Solo verificación</strong><span className="meta">El circuito queda revisable antes de habilitar la aplicación auditada.</span></div></aside></section>
    </main>
  )
}
