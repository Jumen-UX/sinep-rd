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
import { groupAdminKpisByDimension } from './admin-kpi-policy'
import { resolveAdminKpiValues, type AdminKpiValue } from './admin-kpi-value-service'

const dimensionLabels = {
  territorial: 'Territorial',
  pastoral: 'Pastoral',
  administrative: 'Administrativa',
  collegial: 'Colegial',
} as const

const dimensionIcons = {
  territorial: 'T',
  pastoral: 'P',
  administrative: 'A',
  collegial: 'C',
} as const

const dimensionTones = {
  territorial: 'wine',
  pastoral: 'green',
  administrative: 'gold',
  collegial: 'alert',
} as const

const searchPermissions = new Set(['people.view', 'entities.view', 'pastorals.view'])

type DashboardAction = {
  href: string
  icon: string
  title: string
  description: string
  tone: 'wine' | 'gold' | 'green' | 'alert'
}

const actionCatalog: readonly DashboardAction[] = [
  { href: '/admin/nuevo', icon: 'N', title: 'Nueva persona', description: 'Sacerdote, diácono, religioso o laico', tone: 'wine' },
  { href: '/admin/jurisdicciones', icon: 'E', title: 'Gestionar entidades', description: 'Diócesis, parroquias y otras entidades', tone: 'gold' },
  { href: '/admin/asignaciones', icon: 'A', title: 'Gestionar cargos', description: 'Nombramientos, vigencia y sucesión', tone: 'green' },
  { href: '/admin/estructura', icon: 'C', title: 'Configurar estructura', description: 'Niveles y dependencias territoriales', tone: 'alert' },
]

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

function formatKpiValue(value: AdminKpiValue) {
  if (value.value === null) return '—'
  if (value.valueKind === 'percentage') return `${formatNumber(value.value)} %`
  if (value.valueKind === 'duration_days') return `${formatNumber(value.value)} días`
  return formatNumber(value.value)
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
  const [contextualKpis, setContextualKpis] = useState<Record<string, number> | null>(null)
  const [activities, setActivities] = useState<DashboardActivity[]>([])
  const [search, setSearch] = useState('')

  const destinations = useMemo(() => navigation.sections.flatMap((section) => section.items), [navigation.sections])
  const destinationByHref = useMemo(() => new Map(destinations.map((item) => [item.href, item])), [destinations])
  const canVisit = (href: string) => destinationByHref.has(href)
  const canOperate = (href: string) => destinationByHref.get(href)?.availability === 'available'
  const frequentActions = actionCatalog.filter((action) => canOperate(action.href))
  const activeScope = navigation.context?.activeScope
  const includeGlobalMetrics = activeScope?.isUnrestricted ?? false
  const includeActivity = canVisit('/admin/actividad')
  const canSearch = navigation.context?.permissionKeys.some((permission) => searchPermissions.has(permission)) ?? false

  const kpiGroups = useMemo(
    () => groupAdminKpisByDimension(navigation.policyContext),
    [navigation.policyContext],
  )
  const kpiValues = useMemo(() => {
    const values = resolveAdminKpiValues(
      kpiGroups.flatMap((group) => group.items),
      { summary, peopleCount, activeAssignments, contextualKpis },
      includeGlobalMetrics,
    )
    return new Map(values.map((value) => [value.id, value]))
  }, [activeAssignments, contextualKpis, includeGlobalMetrics, kpiGroups, peopleCount, summary])

  useEffect(() => {
    if (navigation.loading || !navigation.context) return
    let cancelled = false

    async function loadDashboard() {
      setLoading(true)
      setError(null)
      try {
        const data = await loadAdminDashboardData(supabase, {
          includeGlobalMetrics,
          includeActivity,
          activeScopeType: activeScope?.type ?? null,
          activeScopeEntityId: activeScope?.entityId ?? null,
        })
        if (cancelled) return
        setProfile(data.profile)
        setRoles(data.roles)
        setSummary(data.summary)
        setPeopleCount(data.peopleCount)
        setActiveAssignments(data.activeAssignments)
        setContextualKpis(data.contextualKpis)
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
  }, [activeScope?.entityId, activeScope?.key, activeScope?.type, includeActivity, includeGlobalMetrics, navigation.context, navigation.loading, router, supabase])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = search.trim().replace(/\s+/g, ' ')
    if (query.length < 2 || !canSearch) return
    window.location.assign(`/admin/buscar?q=${encodeURIComponent(query)}`)
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

  const pendingReviewValue = kpiValues.get('administrative.pending_reviews')
  const pendingReviews = pendingReviewValue?.status === 'available' ? pendingReviewValue.value ?? 0 : null
  const activeScopeLabel = activeScope?.label ?? 'Sin alcance activo'
  const primaryRole = getRoleInfo(roles[0])?.name ?? 'Usuario administrativo'

  return (
    <div className="admin-dashboard" id="top">
      <header className="admin-dashboard-topbar">
        {canSearch ? (
          <form className="admin-dashboard-search" onSubmit={handleSearch}>
            <label htmlFor="admin-dashboard-search-input">Buscar en el directorio interno</label>
            <input id="admin-dashboard-search-input" minLength={2} maxLength={120} onChange={(event) => setSearch(event.target.value)} placeholder="Persona, entidad o unidad organizativa" type="search" value={search} />
            <button disabled={search.trim().length < 2} type="submit">Buscar</button>
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

      {canVisit('/admin/revision') && pendingReviews !== null && (
        <section className={`admin-dashboard-review-notice ${pendingReviews > 0 ? 'has-pending' : 'is-clear'}`}>
          <span className="admin-dashboard-review-icon" aria-hidden="true">i</span>
          <div><strong>{pendingReviews > 0 ? 'Integridad de datos en seguimiento' : 'Integridad de datos al día'}</strong><p>{pendingReviews > 0 ? `${formatNumber(pendingReviews)} registros requieren revisión.` : 'No hay registros pendientes de revisión.'}</p></div>
          <a href="/admin/revision" onClick={(event) => forceNavigation(event, '/admin/revision')}>Abrir centro de revisión</a>
        </section>
      )}

      {kpiGroups.map((group) => (
        <section className="admin-dashboard-panel" key={group.dimension} aria-labelledby={`kpi-${group.dimension}`}>
          <div className="admin-dashboard-panel-heading"><div><h2 id={`kpi-${group.dimension}`}>Dimensión {dimensionLabels[group.dimension].toLowerCase()}</h2><p>Indicadores aplicables al alcance activo y a tus permisos de lectura.</p></div></div>
          <div className="admin-dashboard-metrics">
            {group.items.map((kpi) => {
              const value = kpiValues.get(kpi.id)
              if (!value) return null
              const destination = kpi.destination && canVisit(kpi.destination) ? kpi.destination : null
              const content = <><span className={`admin-dashboard-metric-icon ${dimensionTones[group.dimension]}`} aria-hidden="true">{dimensionIcons[group.dimension]}</span><span className="admin-dashboard-metric-label">{kpi.label}</span><span className="admin-dashboard-metric-value">{formatKpiValue(value)}</span><span className={`admin-dashboard-metric-note ${dimensionTones[group.dimension]}`}>{value.message}</span></>
              return destination ? <a className="admin-dashboard-metric" href={destination} key={kpi.id} onClick={(event) => forceNavigation(event, destination)}>{content}</a> : <div className="admin-dashboard-metric" key={kpi.id}>{content}</div>
            })}
          </div>
        </section>
      ))}

      <section className="admin-dashboard-primary-grid">
        <article className="admin-dashboard-panel admin-dashboard-actions-panel">
          <div className="admin-dashboard-panel-heading"><div><h2>Acciones disponibles</h2><p>Procesos habilitados para tus permisos y alcance activo.</p></div></div>
          {frequentActions.length > 0 ? <div className="admin-dashboard-action-list">{frequentActions.map((action) => <a href={action.href} key={action.href} onClick={(event) => forceNavigation(event, action.href)}><span className={`admin-dashboard-action-icon ${action.tone}`}>{action.icon}</span><span><strong>{action.title}</strong><small>{action.description}</small></span><b aria-hidden="true">›</b></a>)}</div> : <EmptyState compact title="Acceso de consulta" description="Tu perfil no tiene operaciones de creación o configuración habilitadas en este alcance." />}
        </article>

        <article className="admin-dashboard-panel admin-dashboard-quality-panel">
          <div className="admin-dashboard-panel-heading"><div><h2>Contexto activo</h2><p>Resumen del ámbito con el que estás trabajando.</p></div></div>
          <div className="admin-dashboard-quality-copy"><small>Alcance seleccionado</small><strong>{activeScopeLabel}</strong><span>{roles.length} rol{roles.length === 1 ? '' : 'es'} activo{roles.length === 1 ? '' : 's'} para tu cuenta</span></div>
          <dl className="admin-dashboard-quality-list"><div><dt>Tipo de alcance</dt><dd>{activeScope?.type ?? 'Sin alcance'}</dd></div><div><dt>Indicadores visibles</dt><dd>{kpiGroups.reduce((total, group) => total + group.items.length, 0)}</dd></div><div><dt>Fuente global</dt><dd>{includeGlobalMetrics ? 'Habilitada' : 'Bloqueada'}</dd></div></dl>
        </article>
      </section>

      {canVisit('/admin/actividad') && (
        <section className="admin-dashboard-panel admin-dashboard-activity-panel">
          <div className="admin-dashboard-panel-heading"><div><h2>Actividad reciente</h2><p>Últimos cambios registrados en el sistema administrativo.</p></div><a href="/admin/actividad" onClick={(event) => forceNavigation(event, '/admin/actividad')}>Ver toda la actividad</a></div>
          {activities.length > 0 ? <DataTable caption="Última actividad administrativa"><DataTableHeader><tr><DataTableHead>Registro</DataTableHead><DataTableHead>Acción</DataTableHead><DataTableHead>Usuario</DataTableHead><DataTableHead>Fecha</DataTableHead><DataTableHead>Estado</DataTableHead></tr></DataTableHeader><DataTableBody>{activities.map((activity) => <DataTableRow key={activity.id}><DataTableCell><strong>{activityTarget(activity)}</strong></DataTableCell><DataTableCell>{formatAction(activity.action)}</DataTableCell><DataTableCell>{activity.actor_name}</DataTableCell><DataTableCell>{formatDate(activity.created_at)}</DataTableCell><DataTableCell><StatusBadge tone="info" dot>{activityStatus(activity)}</StatusBadge></DataTableCell></DataTableRow>)}</DataTableBody></DataTable> : <EmptyState compact title="Sin actividad registrada" description="Los cambios administrativos auditados aparecerán aquí cuando se realice la primera operación." />}
        </section>
      )}
    </div>
  )
}
