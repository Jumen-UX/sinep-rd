'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type JurisdictionAlert = {
  jurisdiction_id: string
  jurisdiction_name: string
  jurisdiction_slug: string | null
  entity_type_name: string | null
  entity_type_key: string | null
  municipality: string | null
  province: string | null
  titular_count: number
  titular_names: string | null
  has_registered_vacancy: boolean
  alert_status: 'sede_vacante_registrada' | 'posible_sede_vacante' | 'con_obispo_titular'
  alert_label: string
}

type AlertFilter = 'needs_action' | 'possible' | 'registered' | 'resolved' | 'all'

function statusDescription(status: JurisdictionAlert['alert_status']) {
  if (status === 'sede_vacante_registrada') return 'La jurisdicción tiene sede vacante registrada y requiere seguimiento hasta nombramiento titular.'
  if (status === 'posible_sede_vacante') return 'No tiene obispo diocesano activo registrado.'
  return 'Tiene obispo titular registrado.'
}

export default function AdminJurisdictionAlertsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<JurisdictionAlert[]>([])
  const [filter, setFilter] = useState<AlertFilter>('needs_action')

  useEffect(() => {
    async function loadAlerts() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/admin/login')
        return
      }

      const { data, error: alertsError } = await supabase
        .from('admin_jurisdiction_bishop_alerts')
        .select('jurisdiction_id,jurisdiction_name,jurisdiction_slug,entity_type_name,entity_type_key,municipality,province,titular_count,titular_names,has_registered_vacancy,alert_status,alert_label')
        .order('alert_status', { ascending: false })
        .order('jurisdiction_name')

      if (alertsError) {
        setError(alertsError.message)
      } else {
        setAlerts((data ?? []) as JurisdictionAlert[])
      }
      setLoading(false)
    }

    loadAlerts()
  }, [router, supabase])

  const possible = alerts.filter((item) => item.alert_status === 'posible_sede_vacante')
  const registered = alerts.filter((item) => item.alert_status === 'sede_vacante_registrada')
  const resolved = alerts.filter((item) => item.alert_status === 'con_obispo_titular')
  const needsAction = alerts.filter((item) => item.alert_status !== 'con_obispo_titular')

  const visibleAlerts = alerts.filter((item) => {
    if (filter === 'needs_action') return item.alert_status !== 'con_obispo_titular'
    if (filter === 'possible') return item.alert_status === 'posible_sede_vacante'
    if (filter === 'registered') return item.alert_status === 'sede_vacante_registrada'
    if (filter === 'resolved') return item.alert_status === 'con_obispo_titular'
    return true
  })

  if (loading) return <main className="container"><div className="empty-state">Cargando alertas...</div></main>

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink"><Link href="/admin/alertas">← Volver a alertas parroquiales</Link></div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Alertas administrativas</p>
          <h1>Jurisdicciones sin obispo titular</h1>
          <p className="lead">Una diócesis, arquidiócesis u ordinariato requiere atención cuando no tiene obispo diocesano activo registrado. El obispo auxiliar no cubre la sede titular.</p>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="dashboard-grid dashboard-summary">
        <button className={`metric-card metric-button ${filter === 'needs_action' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('needs_action')}>
          <strong>{needsAction.length}</strong><span>Requieren acción</span>
        </button>
        <button className={`metric-card metric-button ${filter === 'possible' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('possible')}>
          <strong>{possible.length}</strong><span>Posible sede vacante</span>
        </button>
        <button className={`metric-card metric-button ${filter === 'registered' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('registered')}>
          <strong>{registered.length}</strong><span>Sede vacante registrada</span>
        </button>
        <button className={`metric-card metric-button ${filter === 'resolved' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('resolved')}>
          <strong>{resolved.length}</strong><span>Con obispo titular</span>
        </button>
        <button className={`metric-card metric-button ${filter === 'all' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('all')}>
          <strong>{alerts.length}</strong><span>Total revisadas</span>
        </button>
      </section>

      <section className="card admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Listado</p>
            <h2>Jurisdicciones</h2>
            <p className="meta">Muestra arquidiócesis, diócesis y ordinariatos activos según los nombramientos actuales.</p>
          </div>
        </div>

        {visibleAlerts.length === 0 ? (
          <div className="empty-state">No hay alertas para este filtro.</div>
        ) : (
          <div className="grid admin-modules">
            {visibleAlerts.map((alert) => (
              <article className="entity-card admin-module" key={alert.jurisdiction_id}>
                <p className="entity-type">{alert.entity_type_name ?? 'Jurisdicción'}</p>
                <h2>{alert.jurisdiction_name}</h2>
                <p className="role-pill">{alert.alert_label}</p>
                <p className="meta">{statusDescription(alert.alert_status)}</p>
                <p className="meta">{[alert.municipality, alert.province].filter(Boolean).join(' · ') || 'Ubicación no indicada'}</p>
                {alert.titular_names && <p className="meta">Obispo titular: {alert.titular_names}</p>}
                <div className="admin-actions">
                  {alert.jurisdiction_slug && <Link className="button button-secondary" href={`/entidades/${alert.jurisdiction_slug}`}>Ver ficha</Link>}
                  <Link className="button button-primary" href={`/admin/asignaciones?entity=${alert.jurisdiction_id}`}>Asignar obispo titular</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
