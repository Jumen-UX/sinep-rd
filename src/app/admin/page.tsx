'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>

type Profile = {
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

type Summary = {
  active_entities: number
  active_dioceses: number
  active_parishes: number
  active_people: number
  active_priests: number
  active_deacons: number
  bishops_and_emeriti: number
  active_pastoral_areas: number
  active_pastoral_entities: number
  pending_change_requests: number
  pending_documents: number
}

function getRoleInfo(role: RoleRow): RoleInfo | null {
  if (!role.roles) return null
  if (Array.isArray(role.roles)) return role.roles[0] ?? null
  return role.roles
}

const adminModules = [
  {
    href: '/admin/nuevo',
    type: 'Asistente',
    title: 'Agregar nueva ficha',
    description: 'Crear nuevo obispo, sacerdote, jurisdicción, parroquia o capilla mediante pasos guiados.',
  },
  {
    href: '/admin/estado-fichas',
    type: 'Calidad de datos',
    title: 'Estado de fichas',
    description: 'Ver avance, datos faltantes y marcar campos como no identificados o no aplicables.',
  },
  {
    href: '/admin/estructura',
    type: 'Estructura',
    title: 'Estructura institucional',
    description: 'Administrar estructuras territorial, pastoral y administrativa por separado.',
  },
  {
    href: '/admin/asignaciones',
    type: 'Cargos',
    title: 'Asignaciones de cargos',
    description: 'Asignar clero, agentes y responsables a cargos, comisiones, entidades y períodos.',
  },
  {
    href: '/admin/configuracion/cargos',
    type: 'Configuración',
    title: 'Catálogo de cargos',
    description: 'Configurar cargos base, ámbitos, categorías y organigramas.',
  },
  {
    href: '/admin/solicitudes',
    type: 'Aprobaciones',
    title: 'Solicitudes de cambio',
    description: 'Revisar solicitudes pendientes y flujo editorial.',
  },
]

export default function AdminPage() {
  const router = useRouter()
  const [client, setClient] = useState<SupabaseClient | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    setClient(supabase)

    async function loadAdmin() {
      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (userError || !userData.user) {
        router.replace('/admin/login')
        return
      }

      const userId = userData.user.id

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name,email')
        .eq('id', userId)
        .maybeSingle()

      const { data: roleData, error: roleError } = await supabase
        .from('user_role_assignments')
        .select('scope_type,status,roles(key,name)')
        .eq('user_id', userId)
        .eq('status', 'active')

      if (roleError) {
        setError(roleError.message)
        setLoading(false)
        return
      }

      const { data: summaryData } = await supabase
        .from('admin_dashboard_summary')
        .select('*')
        .maybeSingle()

      setProfile((profileData as Profile | null) ?? {
        full_name: userData.user.email ?? null,
        email: userData.user.email ?? null,
      })
      setRoles((roleData ?? []) as unknown as RoleRow[])
      setSummary((summaryData as Summary | null) ?? null)
      setLoading(false)
    }

    loadAdmin()
  }, [router])

  async function handleSignOut() {
    const supabase = client ?? createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  if (loading) {
    return (
      <main className="container">
        <div className="empty-state">Cargando portal administrativo...</div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="container">
        <div className="error-box">{error}</div>
      </main>
    )
  }

  if (roles.length === 0) {
    return (
      <main className="container">
        <div className="card">
          <p className="eyebrow">Acceso pendiente</p>
          <h1>Usuario sin rol activo</h1>
          <p className="lead">Tu cuenta existe, pero todavía no tiene un rol administrativo activo.</p>
          <button className="button button-secondary" onClick={handleSignOut} type="button">Cerrar sesión</button>
        </div>
      </main>
    )
  }

  return (
    <main className="container admin-dashboard">
      <div className="admin-topbar">
        <div>
          <p className="eyebrow">Panel administrativo</p>
          <h1>Bienvenido, {profile?.full_name ?? profile?.email}</h1>
          <p className="lead">Gestiona SINEP RD desde botones y asistentes guiados.</p>
        </div>
        <button className="button button-secondary" onClick={handleSignOut} type="button">Cerrar sesión</button>
      </div>

      <section className="card admin-section">
        <h2>Roles activos</h2>
        <div className="role-list">
          {roles.map((role) => {
            const roleInfo = getRoleInfo(role)
            return <span className="role-pill" key={`${roleInfo?.key ?? 'rol'}-${role.scope_type}`}>{roleInfo?.name ?? roleInfo?.key ?? 'Rol'} · {role.scope_type}</span>
          })}
        </div>
      </section>

      {summary && (
        <section className="dashboard-grid">
          <div className="metric-card"><strong>{summary.active_dioceses}</strong><span>Diócesis y jurisdicciones</span></div>
          <div className="metric-card"><strong>{summary.active_entities}</strong><span>Entidades activas</span></div>
          <div className="metric-card"><strong>{summary.active_pastoral_areas}</strong><span>Áreas pastorales</span></div>
          <div className="metric-card"><strong>{summary.pending_change_requests}</strong><span>Solicitudes pendientes</span></div>
        </section>
      )}

      <section className="card admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Acciones principales</p>
            <h2>Administración guiada</h2>
          </div>
        </div>
        <div className="grid admin-modules">
          {adminModules.map((module) => (
            <Link className="entity-card admin-module" href={module.href} key={module.href}>
              <p className="entity-type">{module.type}</p>
              <h2>{module.title}</h2>
              <p className="meta">{module.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="card admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Directorios públicos</p>
            <h2>Consulta rápida</h2>
          </div>
        </div>
        <div className="grid admin-modules">
          <Link className="entity-card admin-module" href="/diocesis"><p className="entity-type">Directorio</p><h2>Diócesis</h2><p className="meta">Ver jurisdicciones y fichas públicas.</p></Link>
          <Link className="entity-card admin-module" href="/personas"><p className="entity-type">Directorio</p><h2>Clero y agentes</h2><p className="meta">Ver obispos, sacerdotes, diáconos, religiosos y laicos registrados.</p></Link>
        </div>
      </section>
    </main>
  )
}
