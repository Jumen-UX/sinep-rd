'use client'

import { type FormEvent, type MouseEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { createClient } from '@/lib/supabase/client'
import { useAdminNavigation } from '../navigation/AdminNavigationProvider'
import {
  loadAdminDashboardData,
  signOutAdminDashboard,
  type DashboardActivity,
  type DashboardProfile,
  type DashboardRoleInfo,
  type DashboardRoleRow,
  type DashboardSummary,
} from './admin-dashboard-service'

type MetricCardProps = {
  href: string
  icon: string
  label: string
  value: number | null
  note: string
  tone: 'wine' | 'gold' | 'green' | 'alert'
}

type DashboardAction = {
  href: string
  icon: string
  title: string
  description: string
  tone: MetricCardProps['tone']
}

const actionCatalog: readonly DashboardAction[] = [
  { href: '/admin/nuevo', icon: 'N', title: 'Nueva persona', description: 'Sacerdote, diácono, religioso o laico', tone: 'wine' },
  { href: '/admin/jurisdicciones', icon: 'E', title: 'Gestionar entidades', description: 'Diócesis, parroquias y otras entidades', tone: 'gold' },
  { href: '/admin/asignaciones', icon: 'A', title: 'Gestionar cargos', description: 'Nombramientos, vigencia y sucesión', tone: 'green' },
  { href: '/admin/estructura', icon: 'C', title: 'Configurar estructura', description: 'Niveles y dependencias territoriales', tone: 'alert' },
] as const

function getRoleInfo(role: DashboardRoleRow): DashboardRoleInfo | null {
  if (!role.roles) return null
  if (Array.isArray(role.roles)) return role.roles[0] ?? null
  return role.roles
}

function getInitials(profile: DashboardProfile | null) {
  const value = profile?.full_name || profile?.email || 'Usuario'
  return value.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'AD'
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
  return value.replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
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

function activityTarget(activity: DashboardActivity) {
  return getMetadataText(activity.metadata, ['display_name', 'name', 'title', 'label']) ?? activity.target_table ?? 'Registro administrativo'
}

function activityStatus(activity: DashboardActivity) {
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
  const navigation = useAdminNavigation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<DashboardProfile | null>(null)
  const [roles, setRoles] = useState<DashboardRoleRow[]>([])
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [peopleCount, setPeopleCount] = useState<number | null>(null)
  const [activeAssignments, setActiveAssignments] = useState<number | null>(null)
  const [activities, setActivities] = useState<DashboardActivity[]>([])
  const [search, setSearch] = useState('')

  const destinations = useMemo(() => navigation.sections.flatMap((section) => section.items), [navigation.sections])
  const destinationByHref = useMemo(() => new Map(destinations.map((item) => [item.href, item])), [destinations])
  const canVisit = (href: string) => destinationByHref.has(href)
  const canOperate = (href: string) => destinationByHref.get(href)?.availability === 'available'
  const frequentActions = actionCatalog.filter((action) => canOperate(action.href))

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      try {
        const data = await loadAdminDashboardData(supabase)
        if (cancelled) return
        setProfile(data.profile)
        setRoles(data.roles)
        setSummary(data.summary)
        setPeopleCount(data.peopleCount)
        setActiveAssignments(data.activeAssignments)
        setActivities(data.activities)
      } catch (loadError) {
        if (cancelled) return
        if (loadError instanceof Error && loadError.message === 'AUTH_REQUIRED') {
          router.replace('/admin/login')
          return
        }
        setError(loadError instanceof Error ? loadError.message : 'No pudimos cargar el portal.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadDashboard()
    return () => { cancelled = true }
  }, [router, supabase])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = search.trim()
    if (!query || !canVisit('/admin/personas')) return
    window.location.assign(`/admin/personas?search=${encodeURIComponent(query)}`)
  }

  async function handleSignOut() {
    try {
      await signOutAdminDashboard(supabase)
    } finally {
      window.location.assign('/admin/login')
    }
  }

  if (loading || navigation.loading) {
    return <div data-ui="page-shell"><EmptyState compact title="Cargando portal administrativo" description="Estamos preparando tus indicadores, permisos y actividad reciente." /></div>
  }

  if (error || navigation.error) {
    return <div data-ui="page-shell"><EmptyState compact title="No pudimos cargar el portal" description={error ?? navigation.error ?? 'Error desconocido'} /></div>
  }

  if (roles.length === 0) {
    return <div data-ui="page-shell"><EmptyState title="Usuario sin rol activo" description="Tu cuenta existe, pero todavía no tiene un rol administrativo activo." action={<Button variant="secondary" onClick={handleSignOut}>Cerrar sesión</Button>} /></div>
  }

  const pendingReviews = summary?.pending_change_requests ?? 0
  const activeScopeLabel = navigation.context?.activeScope.label ?? 'Sin alcance activo'
  const primaryRole = getRoleInfo(roles[0])?.name ?? 'Usuario administrativo'

  return (
    <div className="admin-dashboard" id="top">
      <header className="admin-dashboard-topbar">
        {canVisit('/admin/personas') ? (
          <form className="admin-dashboard-search" onSubmit={handleSearch}>
            <label htmlFor="admin-dashboard-search-input">Buscar personas</label>
            <input id="admin-dashboard-search-input" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar personas por nombre" type="search" value={search} />
            <button type="submit">Buscar</button>
          </form>
        ) : <span />}
        <div className="admin-dashboard-user">
          <span>{getInitials(profile)}</span>
          <div><strong>{profile?.full_name ?? profile?.email}</strong><small>{primaryRole}</small></div>
          <button onClick={handleSignOut} type="button">Salir</button>
        </div>
      </header>

      <PageHeader
        className="admin-dashboard-heading"
        breadcrumbs={[{ label: 'Administración', href: '/admin' }, { label: 'Resumen' }]}
        eyebrow="Panel de control"
        title="Resumen administrativo"
        description="Supervisa la información eclesial, los flujos de revisión y la actividad disponible para tu alcance."
        metadata={<><StatusBadge tone="institutional" dot>{primaryRole}</StatusBadge><StatusBadge tone="info" dot>{activeScopeLabel}</StatusBadge></>}
        actions={(canOperate('/admin/importar') || canOperate('/admin/nuevo')) ? (
          <>
            {canOperate('/admin/importar') && <Button asChild variant="secondary"><a href="/admin/importar" onClick={(event) => forceNavigation(event, '/admin/importar')}>Importar datos</a></Button>}
            {canOperate('/admin/nuevo') && <Button asChild><a href="/admin/nuevo" onClick={(event) => forceNavigation(event, '/admin/nuevo')}>+ Nuevo registro</a></Button>}
          </>
        ) : undefined}
      />

      {canVisit('/admin/revision') && (
        <section className={`admin-dashboard-review-notice ${pendingReviews > 0 ? 'has-pending' : 'is-clear'}`}>
          <span className="admin-dashboard-review-icon" aria-hidden="true">i</span>
          <div><strong>{pendingReviews > 0 ? 'Integridad de datos en seguimiento' : 'Integridad de datos al día'}</strong><p>{pendingReviews > 0 ? `${formatNumber(pendingReviews)} registros requieren revisión.` : 'No hay registros pendientes de revisión.'}</p></div>
          <a href="/admin/revision" onClick={(event) => forceNavigation(event, '/admin/revision')}>Abrir centro de revisión</a>
        </section>
      )}

      <section className="admin-dashboard-metrics" aria-label="Indicadores administrativos">
        {canVisit('/admin/personas') && <MetricCard href="/admin/personas" icon="P" label="Personas registradas" value={peopleCount} note="Directorio general" tone="green" />}
        {canVisit('/admin/jurisdicciones') && <MetricCard href="/admin/jurisdicciones" icon="E" label="Entidades activas" value={summary?.active_entities ?? null} note={`${formatNumber(summary?.active_dioceses ?? null)} jurisdicciones`} tone="wine" />}
        {canVisit('/admin/asignaciones') && <MetricCard href="/admin/asignaciones" icon="A" label="Asignaciones activas" value={activeAssignments} note="Cargos vigentes" tone="gold" />}
        {canVisit('/admin/revision') && <MetricCard href="/admin/revision" icon="R" label="Pendientes de revisión" value={pendingReviews} note={pendingReviews > 0 ? 'Requieren atención' : 'Sin pendientes'} tone="alert" />}
      </section>

      <section className="admin-dashboard-primary-grid">
        <article className="admin-dashboard-panel admin-dashboard-actions-panel">
          <div className="admin-dashboard-panel-heading"><div><h2>Acciones disponibles</h2><p>Procesos habilitados para tus permisos y alcance activo.</p></div></div>
          {frequentActions.length > 0 ? (
            <div className="admin-dashboard-action-list">
              {frequentActions.map((action) => <a href={action.href} key={action.href} onClick={(event) => forceNavigation(event, action.href)}><span className={`admin-dashboard-action-icon ${action.tone}`}>{action.icon}</span><span><strong>{action.title}</strong><small>{action.description}</small></span><b aria-hidden="true">›</b></a>)}
            </div>
          ) : <EmptyState compact title="Acceso de consulta" description="Tu perfil no tiene operaciones de creación o configuración habilitadas en este alcance." />}
        </article>

        <article className="admin-dashboard-panel admin-dashboard-quality-panel">
          <div className="admin-dashboard-panel-heading"><div><h2>Contexto activo</h2><p>Resumen del ámbito con el que estás trabajando.</p></div></div>
          <div className="admin-dashboard-quality-copy"><small>Alcance seleccionado</small><strong>{activeScopeLabel}</strong><span>{roles.length} rol{roles.length === 1 ? '' : 'es'} activo{roles.length === 1 ? '' : 's'} para tu cuenta</span></div>
          <dl className="admin-dashboard-quality-list"><div><dt>Jurisdicciones activas</dt><dd>{formatNumber(summary?.active_dioceses ?? null)}</dd></div><div><dt>Áreas pastorales</dt><dd>{formatNumber(summary?.active_pastoral_areas ?? null)}</dd></div><div><dt>Nombramientos activos</dt><dd>{formatNumber(activeAssignments)}</dd></div></dl>
        </article>
      </section>

      {canVisit('/admin/actividad') && (
        <section className="admin-dashboard-panel admin-dashboard-activity-panel">
          <div className="admin-dashboard-panel-heading"><div><h2>Actividad reciente</h2><p>Últimos cambios registrados en el sistema administrativo.</p></div><a href="/admin/actividad" onClick={(event) => forceNavigation(event, '/admin/actividad')}>Ver toda la actividad</a></div>
          {activities.length > 0 ? (
            <DataTable caption="Última actividad administrativa"><DataTableHeader><tr><DataTableHead>Registro</DataTableHead><DataTableHead>Acción</DataTableHead><DataTableHead>Usuario</DataTableHead><DataTableHead>Fecha</DataTableHead><DataTableHead>Estado</DataTableHead></tr></DataTableHeader><DataTableBody>{activities.map((activity) => <DataTableRow key={activity.id}><DataTableCell><strong>{activityTarget(activity)}</strong></DataTableCell><DataTableCell>{formatAction(activity.action)}</DataTableCell><DataTableCell>{activity.actor_name}</DataTableCell><DataTableCell>{formatDate(activity.created_at)}</DataTableCell><DataTableCell><StatusBadge tone="info" dot>{activityStatus(activity)}</StatusBadge></DataTableCell></DataTableRow>)}</DataTableBody></DataTable>
          ) : <EmptyState compact title="Sin actividad registrada" description="Los cambios administrativos auditados aparecerán aquí cuando se realice la primera operación." />}
        </section>
      )}
    </div>
  )
}
