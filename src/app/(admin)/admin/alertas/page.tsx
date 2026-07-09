'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type StructureAlert = {
  node_id: string
  template_name: string | null
  kind_key: string | null
  level_name: string | null
  level_key: string | null
  diocese_name: string | null
  entity_id: string
  entity_name: string
  entity_slug: string | null
  entity_type_name: string | null
  municipality: string | null
  province: string | null
  responsible_office_name: string | null
  responsible_office_key: string | null
  responsible_count: number
  responsible_names: string | null
  has_registered_vacancy: boolean
  alert_status: 'vacante_registrada' | 'posible_vacancia' | 'con_responsable'
  alert_label: string
}

type AlertFilter = 'needs_action' | 'possible' | 'registered' | 'resolved' | 'all'

function statusDescription(alert: StructureAlert) {
  const office = alert.responsible_office_name ?? 'responsable principal'
  if (alert.alert_status === 'vacante_registrada') return `Ya hay una vacancia registrada para ${office}. Requiere asignar responsable cuando corresponda.`
  if (alert.alert_status === 'posible_vacancia') return `No tiene ${office} activo registrado.`
  return `Tiene ${office} registrado.`
}

function locationLabel(alert: StructureAlert) {
  const parts = [alert.diocese_name, alert.level_name, alert.municipality, alert.province].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : 'Ubicación o nivel no indicado'
}

export default function AdminAlertasPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<StructureAlert[]>([])
  const [filter, setFilter] = useState<AlertFilter>('needs_action')

  useEffect(() => {
    async function loadAlerts() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/admin/login')
        return
      }

      const { data, error: alertsError } = await supabase
        .from('admin_structure_responsibility_alerts')
        .select('node_id,template_name,kind_key,level_name,level_key,diocese_name,entity_id,entity_name,entity_slug,entity_type_name,municipality,province,responsible_office_name,responsible_office_key,responsible_count,responsible_names,has_registered_vacancy,alert_status,alert_label')
        .order('alert_status', { ascending: false })
        .order('diocese_name')
        .order('level_name')
        .order('entity_name')

      if (alertsError) {
        setError(alertsError.message)
      } else {
        setAlerts((data ?? []) as StructureAlert[])
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
          <h1>Unidades sin responsable principal</h1>
          <p className="lead">La alerta se genera desde la estructura flexible: cada nivel revisa el cargo marcado como predeterminado en Configuración → Cargos permitidos por nivel.</p>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="card admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Otras alertas</p>
            <h2>Revisión de jurisdicciones</h2>
            <p className="meta">También puedes revisar diócesis, arquidiócesis u ordinariatos sin obispo titular activo.</p>
          </div>
        </div>
        <Link className="button button-secondary" href="/admin/alertas/jurisdicciones">Ver jurisdicciones sin obispo titular</Link>
      </section>

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
            <h2>Unidades estructurales monitoreadas</h2>
            <p className="meta">Muestra unidades activas que tienen un cargo responsable configurado por nivel estructural.</p>
          </div>
        </div>

        {visibleAlerts.length === 0 ? (
          <div className="empty-state">No hay alertas para este filtro.</div>
        ) : (
          <div className="grid admin-modules">
            {visibleAlerts.map((alert) => (
              <article className="entity-card admin-module" key={`${alert.node_id}-${alert.responsible_office_key ?? 'responsable'}`}>
                <p className="entity-type">{alert.level_name ?? alert.entity_type_name ?? 'Unidad estructural'}</p>
                <h2>{alert.entity_name}</h2>
                <p className="role-pill">{alert.alert_label}</p>
                <p className="meta">{statusDescription(alert)}</p>
                <p className="meta">Cargo monitoreado: {alert.responsible_office_name ?? 'responsable principal'}</p>
                <p className="meta">{locationLabel(alert)}</p>
                {alert.responsible_names && <p className="meta">Responsable: {alert.responsible_names}</p>}
                <div className="admin-actions">
                  {alert.entity_slug && <Link className="button button-secondary" href={`/entidades/${alert.entity_slug}`}>Ver ficha</Link>}
                  <Link className="button button-primary" href={`/admin/asignaciones?entity=${alert.entity_id}`}>Asignar responsable</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
