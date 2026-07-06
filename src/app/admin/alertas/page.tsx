'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ParishAlert = {
  parish_id: string
  parish_name: string
  parish_slug: string | null
  entity_type_name: string | null
  municipality: string | null
  province: string | null
  responsible_count: number
  responsible_names: string | null
  has_registered_vacancy: boolean
  alert_status: 'vacante_registrada' | 'posible_vacancia' | 'con_responsable'
  alert_label: string
}

type AlertFilter = 'needs_action' | 'possible' | 'registered' | 'resolved' | 'all'

function statusDescription(status: ParishAlert['alert_status']) {
  if (status === 'vacante_registrada') return 'Ya hay una vacancia registrada. Requiere asignar responsable cuando corresponda.'
  if (status === 'posible_vacancia') return 'No tiene párroco ni administrador parroquial activo registrado.'
  return 'Tiene responsable principal registrado.'
}

export default function AdminAlertasPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<ParishAlert[]>([])
  const [filter, setFilter] = useState<AlertFilter>('needs_action')

  useEffect(() => {
    async function loadAlerts() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/admin/login')
        return
      }

      const { data, error: alertsError } = await supabase
        .from('admin_parish_responsibility_alerts')
        .select('parish_id,parish_name,parish_slug,entity_type_name,municipality,province,responsible_count,responsible_names,has_registered_vacancy,alert_status,alert_label')
        .order('alert_status', { ascending: false })
        .order('parish_name')

      if (alertsError) {
        setError(alertsError.message)
      } else {
        setAlerts((data ?? []) as ParishAlert[])
      }
      setLoading(false)
    }

    loadAlerts()
  }, [router, supabase])

  const possible = alerts.filter((item) => item.alert_status === 'posible_vacancia')
  const registered = alerts.filter((item) => item.alert_status === 'vacante_registrada')
  const resolved = alerts.filter((item) => item.alert_status === 'con_responsable')
  const needsAction = alerts.filter((item) => item.alert_status !== 'con_responsable')

  const visibleAlerts = alerts.filter((item) => {
    if (filter === 'needs_action') return item.alert_status !== 'con_responsable'
    if (filter === 'possible') return item.alert_status === 'posible_vacancia'
    if (filter === 'registered') return item.alert_status === 'vacante_registrada'
    if (filter === 'resolved') return item.alert_status === 'con_responsable'
    return true
  })

  if (loading) return <main className="container"><div className="empty-state">Cargando alertas...</div></main>

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink"><Link href="/admin">← Volver al panel administrativo</Link></div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Alertas administrativas</p>
          <h1>Parroquias sin responsable principal</h1>
          <p className="lead">Una parroquia requiere atención cuando no tiene párroco ni administrador parroquial activo. El vicario parroquial no elimina la vacancia.</p>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="dashboard-grid dashboard-summary">
        <button className={`metric-card metric-button ${filter === 'needs_action' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('needs_action')}>
          <strong>{needsAction.length}</strong><span>Requieren acción</span>
        </button>
        <button className={`metric-card metric-button ${filter === 'possible' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('possible')}>
          <strong>{possible.length}</strong><span>Posible vacancia</span>
        </button>
        <button className={`metric-card metric-button ${filter === 'registered' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('registered')}>
          <strong>{registered.length}</strong><span>Vacante registrada</span>
        </button>
        <button className={`metric-card metric-button ${filter === 'resolved' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('resolved')}>
          <strong>{resolved.length}</strong><span>Con responsable</span>
        </button>
        <button className={`metric-card metric-button ${filter === 'all' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('all')}>
          <strong>{alerts.length}</strong><span>Total revisadas</span>
        </button>
      </section>

      <section className="card admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Listado</p>
            <h2>Parroquias</h2>
            <p className="meta">Muestra parroquias y cuasiparroquias activas según los nombramientos actuales.</p>
          </div>
        </div>

        {visibleAlerts.length === 0 ? (
          <div className="empty-state">No hay alertas para este filtro.</div>
        ) : (
          <div className="grid admin-modules">
            {visibleAlerts.map((alert) => (
              <article className="entity-card admin-module" key={alert.parish_id}>
                <p className="entity-type">{alert.entity_type_name ?? 'Parroquia'}</p>
                <h2>{alert.parish_name}</h2>
                <p className="role-pill">{alert.alert_label}</p>
                <p className="meta">{statusDescription(alert.alert_status)}</p>
                <p className="meta">{[alert.municipality, alert.province].filter(Boolean).join(' · ') || 'Ubicación no indicada'}</p>
                {alert.responsible_names && <p className="meta">Responsable: {alert.responsible_names}</p>}
                <div className="admin-actions">
                  {alert.parish_slug && <Link className="button button-secondary" href={`/entidades/${alert.parish_slug}`}>Ver ficha</Link>}
                  <Link className="button button-primary" href={`/admin/asignaciones?entity=${alert.parish_id}`}>Asignar responsable</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
