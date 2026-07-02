'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  full_name: string | null
  email: string | null
}

type RoleRow = {
  scope_type: string | null
  status: string
  roles: {
    key: string
    name: string
  } | null
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

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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
      setRoles((roleData ?? []) as RoleRow[])
      setSummary((summaryData as Summary | null) ?? null)
      setLoading(false)
    }

    loadAdmin()
  }, [router, supabase])

  async function handleSignOut() {
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
          <p className="lead">
            Tu cuenta existe, pero todavía no tiene un rol administrativo activo.
          </p>
          <button className="button button-secondary" onClick={handleSignOut} type="button">
            Cerrar sesión
          </button>
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
          <p className="lead">Gestión inicial de SINEP RD.</p>
        </div>
        <button className="button button-secondary" onClick={handleSignOut} type="button">
          Cerrar sesión
        </button>
      </div>

      <section className="card admin-section">
        <h2>Roles activos</h2>
        <div className="role-list">
          {roles.map((role) => (
            <span className="role-pill" key={`${role.roles?.key}-${role.scope_type}`}>
              {role.roles?.name ?? role.roles?.key} · {role.scope_type}
            </span>
          ))}
        </div>
      </section>

      {summary && (
        <section className="dashboard-grid">
          <div className="metric-card">
            <strong>{summary.active_dioceses}</strong>
            <span>Diócesis y jurisdicciones</span>
          </div>
          <div className="metric-card">
            <strong>{summary.active_entities}</strong>
            <span>Entidades activas</span>
          </div>
          <div className="metric-card">
            <strong>{summary.active_pastoral_areas}</strong>
            <span>Áreas pastorales</span>
          </div>
          <div className="metric-card">
            <strong>{summary.pending_change_requests}</strong>
            <span>Solicitudes pendientes</span>
          </div>
        </section>
      )}

      <section className="grid admin-modules">
        <Link className="entity-card admin-module" href="/diocesis">
          <p className="entity-type">Directorio</p>
          <h2>Diócesis</h2>
          <p className="meta">Ver directorio público conectado a Supabase.</p>
        </Link>
        <div className="entity-card admin-module muted-module">
          <p className="entity-type">Próximo</p>
          <h2>Solicitudes de cambio</h2>
          <p className="meta">Aprobación editorial y auditoría.</p>
        </div>
        <div className="entity-card admin-module muted-module">
          <p className="entity-type">Próximo</p>
          <h2>Personas y clero</h2>
          <p className="meta">Obispos, sacerdotes, diáconos y laicos.</p>
        </div>
      </section>
    </main>
  )
}
