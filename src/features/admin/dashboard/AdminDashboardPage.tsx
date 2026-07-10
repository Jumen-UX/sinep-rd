'use client'

import { type FormEvent, type MouseEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  id?: string
  full_name: string | null
  email: string | null
}

type RoleInfo = {
  key: string
  name: string
}

type RoleRow = {
  scope_type: string | null
  status: string
  roles: RoleInfo[] | RoleInfo | null
}

type DashboardSummary = {
  active_entities: number
  active_dioceses: number
  active_pastoral_areas: number
  pending_change_requests: number
}

type AuditRow = {
  id: string
  actor_user_id: string
  action: string
  target_table: string | null
  target_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

type ActivityRow = AuditRow & {
  actor_name: string
}

type MetricCardProps = {
  href: string
  icon: string
  label: string
  value: number | null
  note: string
  tone: 'wine' | 'gold' | 'green' | 'alert'
}

const frequentActions = [
  {
    href: '/admin/nuevo',
    icon: 'N',
    title: 'Nueva persona',
    description: 'Sacerdote, diácono, religioso o laico',
    tone: 'wine',
  },
  {
    href: '/admin/nuevo/jurisdiccion',
    icon: 'E',
    title: 'Nueva entidad',
    description: 'Diócesis, parroquia, capilla o comunidad',
    tone: 'gold',
  },
  {
    href: '/admin/asignaciones',
    icon: 'A',
    title: 'Asignar cargo',
    description: 'Nombramiento, vigencia y sucesión',
    tone: 'green',
  },
  {
    href: '/admin/estructura',
    icon: 'C',
    title: 'Crear estructura',
    description: 'Niveles y dependencias por diócesis',
    tone: 'alert',
  },
] as const

function getRoleInfo(role: RoleRow): RoleInfo | null {
  if (!role.roles) return null
  if (Array.isArray(role.roles)) return role.roles[0] ?? null
  return role.roles
}

function getInitials(profile: Profile | null) {
  const value = profile?.full_name || profile?.email || 'Usuario'
  return value
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'AD'
}

function forceNavigation(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  window.location.assign(href)
}

function formatNumber(value: number | null) {
  if (value === null) return '—'
  return new Intl.NumberFormat('es-DO').format(value)
}

function formatAction(value: string) {
  return value
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'

  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const wasYesterday = date.toDateString() === yesterday.toDateString()
  const time = new Intl.DateTimeFormat('es-DO', { hour: '2-digit', minute: '2-digit' }).format(date)

  if (sameDay) return `Hoy, ${time}`
  if (wasYesterday) return `Ayer, ${time}`
  return new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

function getMetadataText(metadata: Record<string, unknown> | null, keys: string[]) {
  if (!metadata) return null
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function activityTarget(activity: ActivityRow) {
  return getMetadataText(activity.metadata, ['display_name', 'name', 'title', 'label'])
    ?? activity.target_table
    ?? 'Registro administrativo'
}

function activityStatus(activity: ActivityRow) {
  return getMetadataText(activity.metadata, ['status', 'state']) ?? 'Registrado'
}

function MetricCard({ href, icon, label, value, note, tone }: MetricCardProps) {
  return (
    <a className="admin-dashboard-metric" href={href} onClick={(event) => forceNavigation(event, href)}>
      <span className={`admin-dashboard-metric-icon ${tone}`} aria-hidden="true">{icon}</span>
      <span className="admin-dashboard-metric-label">{label}</span>
      <span className="admin-dashboard-metric-value">{formatNumber(value)}</span>
      <span className={`admin-dashboard-metric-note ${tone}`}>{note}</span>
    </a>
  )
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [peopleCount, setPeopleCount] = useState<number | null>(null)
  const [activeAssignments, setActiveAssignments] = useState<number | null>(null)
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) {
        router.replace('/admin/login')
        return
      }

      const [profileResponse, roleResponse] = await Promise.all([
        supabase.from('profiles').select('id,full_name,email').eq('id', userData.user.id).maybeSingle(),
        supabase.from('user_role_assignments').select('scope_type,status,roles(key,name)').eq('user_id', userData.user.id).eq('status', 'active'),
      ])

      if (roleResponse.error) {
        if (!cancelled) {
          setError(roleResponse.error.message)
          setLoading(false)
        }
        return
      }

      const [summaryResponse, assignmentResponse, peopleResponse, auditResponse] = await Promise.all([
        supabase.from('admin_dashboard_summary').select('active_entities,active_dioceses,active_pastoral_areas,pending_change_requests').maybeSingle(),
        supabase.from('position_assignments').select('id', { count: 'exact', head: true }).eq('is_current', true).eq('assignment_status', 'active'),
        supabase.from('persons').select('id', { count: 'exact', head: true }),
        supabase.from('admin_audit_log').select('id,actor_user_id,action,target_table,target_id,metadata,created_at').order('created_at', { ascending: false }).limit(5),
      ])

      const auditRows = (auditResponse.data ?? []) as AuditRow[]
      const actorIds = Array.from(new Set(auditRows.map((row) => row.actor_user_id).filter(Boolean)))
      const actorProfiles = new Map<string, string>()

      if (actorIds.length > 0) {
        const { data: actors } = await supabase.from('profiles').select('id,full_name,email').in('id', actorIds)
        for (const actor of actors ?? []) {
          const typedActor = actor as Profile & { id: string }
          actorProfiles.set(typedActor.id, typedActor.full_name ?? typedActor.email ?? 'Usuario administrativo')
        }
      }

      if (cancelled) return

      setProfile((profileResponse.data as Profile | null) ?? {
        id: userData.user.id,
        full_name: userData.user.email ?? null,
        email: userData.user.email ?? null,
      })
      setRoles((roleResponse.data ?? []) as unknown as RoleRow[])
      setSummary((summaryResponse.data as DashboardSummary | null) ?? null)
      setActiveAssignments(assignmentResponse.error ? null : assignmentResponse.count ?? 0)
      setPeopleCount(peopleResponse.error ? null : peopleResponse.count ?? 0)
      setActivities(auditRows.map((row) => ({
        ...row,
        actor_name: actorProfiles.get(row.actor_user_id) ?? 'Usuario administrativo',
      })))
      setLoading(false)
    }

    loadDashboard()

    return () => {
      cancelled = true
    }
  }, [router, supabase])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = search.trim()
    if (!query) return
    window.location.assign(`/admin/personas?search=${encodeURIComponent(query)}`)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.assign('/admin/login')
  }

  if (loading) return <div className="empty-state">Cargando portal administrativo...</div>
  if (error) return <div className="error-box">{error}</div>

  if (roles.length === 0) {
    return (
      <section className="card">
        <p className="eyebrow">Acceso pendiente</p>
        <h1>Usuario sin rol activo</h1>
        <p className="lead">Tu cuenta existe, pero todavía no tiene un rol administrativo activo.</p>
        <button className="button button-secondary" onClick={handleSignOut} type="button">Cerrar sesión</button>
      </section>
    )
  }

  const pendingReviews = summary?.pending_change_requests ?? 0
  const reviewMessage = pendingReviews > 0
    ? `${formatNumber(pendingReviews)} registros requieren revisión antes de publicarse o aplicarse.`
    : 'No hay registros pendientes de revisión en este momento.'

  return (
    <div className="admin-dashboard" id="top">
      <header className="admin-dashboard-topbar">
        <div className="admin-dashboard-breadcrumb">Administración <span>/</span> Resumen</div>
        <form className="admin-dashboard-search" onSubmit={handleSearch}>
          <label htmlFor="admin-dashboard-search-input">Buscar en el portal</label>
          <input
            id="admin-dashboard-search-input"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar personas, entidades o documentos"
            type="search"
            value={search}
          />
          <button type="submit">Buscar</button>
        </form>
        <div className="admin-dashboard-user">
          <span>{getInitials(profile)}</span>
          <div>
            <strong>{profile?.full_name ?? profile?.email}</strong>
            <small>{getRoleInfo(roles[0])?.name ?? 'Administrador'}</small>
          </div>
          <button onClick={handleSignOut} type="button">Salir</button>
        </div>
      </header>

      <section className="admin-dashboard-heading">
        <div>
          <p className="eyebrow">Panel de control</p>
          <h1>Resumen administrativo</h1>
          <p>Supervisa la información eclesial, los flujos de revisión y la actividad reciente.</p>
        </div>
        <div className="admin-dashboard-heading-actions">
          <a className="button button-secondary" href="/admin/importar" onClick={(event) => forceNavigation(event, '/admin/importar')}>Importar datos</a>
          <a className="button button-primary" href="/admin/nuevo" onClick={(event) => forceNavigation(event, '/admin/nuevo')}>+ Nuevo registro</a>
        </div>
      </section>

      <section className={`admin-dashboard-review-notice ${pendingReviews > 0 ? 'has-pending' : 'is-clear'}`}>
        <span className="admin-dashboard-review-icon" aria-hidden="true">i</span>
        <div>
          <strong>{pendingReviews > 0 ? 'Integridad de datos en seguimiento' : 'Integridad de datos al día'}</strong>
          <p>{reviewMessage}</p>
        </div>
        <a href="/admin/revision" onClick={(event) => forceNavigation(event, '/admin/revision')}>Abrir centro de revisión</a>
      </section>

      <section className="admin-dashboard-metrics" aria-label="Indicadores administrativos">
        <MetricCard href="/admin/personas" icon="P" label="Personas registradas" value={peopleCount} note="Directorio general" tone="green" />
        <MetricCard href="/admin/estructura" icon="E" label="Entidades activas" value={summary?.active_entities ?? null} note={`${formatNumber(summary?.active_dioceses ?? null)} jurisdicciones`} tone="wine" />
        <MetricCard href="/admin/asignaciones" icon="A" label="Asignaciones activas" value={activeAssignments} note="Cargos vigentes" tone="gold" />
        <MetricCard href="/admin/revision" icon="R" label="Pendientes de revisión" value={pendingReviews} note={pendingReviews > 0 ? 'Requieren atención' : 'Sin pendientes'} tone="alert" />
      </section>

      <section className="admin-dashboard-primary-grid">
        <article className="admin-dashboard-panel admin-dashboard-actions-panel">
          <div className="admin-dashboard-panel-heading">
            <div>
              <h2>Acciones frecuentes</h2>
              <p>Inicia los procesos más utilizados sin salir del resumen.</p>
            </div>
            <a href="/admin/nuevo" onClick={(event) => forceNavigation(event, '/admin/nuevo')}>Ver todos</a>
          </div>
          <div className="admin-dashboard-action-list">
            {frequentActions.map((action) => (
              <a href={action.href} key={action.href} onClick={(event) => forceNavigation(event, action.href)}>
                <span className={`admin-dashboard-action-icon ${action.tone}`}>{action.icon}</span>
                <span>
                  <strong>{action.title}</strong>
                  <small>{action.description}</small>
                </span>
                <b aria-hidden="true">›</b>
              </a>
            ))}
          </div>
        </article>

        <article className="admin-dashboard-panel admin-dashboard-quality-panel">
          <div className="admin-dashboard-panel-heading">
            <div>
              <h2>Control de información</h2>
              <p>Indicadores verificables del alcance actual.</p>
            </div>
          </div>
          <div className={`admin-dashboard-quality-ring ${pendingReviews > 0 ? 'has-pending' : 'is-clear'}`}>
            <strong>{formatNumber(pendingReviews)}</strong>
            <span>pendientes</span>
          </div>
          <div className="admin-dashboard-quality-copy">
            <small>Estado general</small>
            <strong>{pendingReviews > 0 ? 'Datos en seguimiento' : 'Datos revisados'}</strong>
            <span>{roles.length} rol{roles.length === 1 ? '' : 'es'} activo{roles.length === 1 ? '' : 's'} para tu cuenta</span>
          </div>
          <dl className="admin-dashboard-quality-list">
            <div><dt>Jurisdicciones activas</dt><dd>{formatNumber(summary?.active_dioceses ?? null)}</dd></div>
            <div><dt>Áreas pastorales</dt><dd>{formatNumber(summary?.active_pastoral_areas ?? null)}</dd></div>
            <div><dt>Nombramientos activos</dt><dd>{formatNumber(activeAssignments)}</dd></div>
          </dl>
        </article>
      </section>

      <section className="admin-dashboard-panel admin-dashboard-activity-panel">
        <div className="admin-dashboard-panel-heading">
          <div>
            <h2>Actividad reciente</h2>
            <p>Últimos cambios registrados en el sistema administrativo.</p>
          </div>
          <a href="/admin/actividad" onClick={(event) => forceNavigation(event, '/admin/actividad')}>Ver toda la actividad</a>
        </div>

        <div className="admin-dashboard-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Registro</th>
                <th>Acción</th>
                <th>Usuario</th>
                <th>Fecha</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {activities.length > 0 ? activities.map((activity) => (
                <tr key={activity.id}>
                  <td><strong>{activityTarget(activity)}</strong></td>
                  <td>{formatAction(activity.action)}</td>
                  <td>{activity.actor_name}</td>
                  <td>{formatDate(activity.created_at)}</td>
                  <td><span className="admin-dashboard-state">{activityStatus(activity)}</span></td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="admin-dashboard-empty-row">Todavía no hay actividad administrativa registrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
