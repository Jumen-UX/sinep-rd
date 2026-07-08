'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>

type Profile = { full_name: string | null; email: string | null }
type RoleInfo = { key: string; name: string }
type RoleRow = { scope_type: string | null; status: string; roles: RoleInfo[] | RoleInfo | null }
type Summary = { active_entities: number; active_dioceses: number; active_pastoral_areas: number; pending_change_requests: number }
type ModuleCard = { href: string; type: string; title: string; description: string }
type ModuleGroup = { eyebrow: string; title: string; description: string; modules: ModuleCard[] }

function getRoleInfo(role: RoleRow): RoleInfo | null {
  if (!role.roles) return null
  if (Array.isArray(role.roles)) return role.roles[0] ?? null
  return role.roles
}

const quickActions: ModuleCard[] = [
  { href: '/admin/eventos/pendientes', type: 'Revisión', title: 'Cola de eventos', description: 'Atender eventos pendientes antes de aprobar, planificar o contratar.' },
  { href: '/admin/eventos/nuevo', type: 'Carga', title: 'Preparar evento', description: 'Crear carga histórica, evento nuevo o foto inicial vigente.' },
  { href: '/admin/estructura/eventos', type: 'Estructura', title: 'Cambios estructurales', description: 'Registrar cambios de vicarías, zonas, parroquias, sectores o niveles.' },
  { href: '/admin/solicitudes', type: 'Calidad', title: 'Solicitudes pendientes', description: 'Aprobar, rechazar o pedir correcciones antes de publicar datos.' },
]

const moduleGroups: ModuleGroup[] = [
  {
    eyebrow: 'Eventos y fuentes',
    title: 'Historia, evidencia y aplicación controlada',
    description: 'Todo cambio entra como evento verificable: primero se documenta, luego se revisa, planifica y contrata.',
    modules: [
      { href: '/admin/eventos', type: 'Registro', title: 'Registro de eventos', description: 'Ver eventos históricos, fechas derivadas, fuentes y datos pendientes.' },
      { href: '/admin/eventos/nuevo', type: 'Asistente', title: 'Preparar evento', description: 'Crear hechos históricos, eventos nuevos o estados vigentes importados.' },
      { href: '/admin/eventos/pendientes', type: 'Revisión', title: 'Cola de eventos', description: 'Revisar eventos antes de aprobar, devolver, planificar o contratar.' },
      { href: '/admin/eventos/verificacion', type: 'Control', title: 'Verificación del flujo', description: 'Comprobar ciclo, plan, contrato y preparación para prueba funcional.' },
    ],
  },
  {
    eyebrow: 'Estructura eclesial',
    title: 'Jurisdicción, organización interna y evolución',
    description: 'Separa jerarquía territorial-canónica de estructuras pastorales, administrativas y orgánicas.',
    modules: [
      { href: '/admin/jurisdicciones', type: 'Canónico', title: 'Jurisdicciones eclesiásticas', description: 'Ver Iglesia sui iuris, provincias, sedes metropolitanas y sufragáneas.' },
      { href: '/admin/estructura?kind=territorial', type: 'Territorial', title: 'Estructura interna', description: 'Organizar vicarías, zonas, parroquias, sectores, capillas y niveles flexibles.' },
      { href: '/admin/estructura/eventos', type: 'Evolución', title: 'Eventos estructurales', description: 'Registrar creación, división, supresión, límites, dependencia y cambio de nivel.' },
      { href: '/admin/estructura/eventos/verificacion', type: 'Control', title: 'Verificación estructural', description: 'Revisar impacto, plan, editor, conflictos y contrato del flujo estructural.' },
    ],
  },
  {
    eyebrow: 'Personas y ministerios',
    title: 'Personas, cargos y nombramientos',
    description: 'Gestión de personas eclesiales y responsabilidades pastorales o administrativas.',
    modules: [
      { href: '/admin/personas', type: 'Personas', title: 'Administrar personas', description: 'Buscar personas registradas y abrir acciones administrativas.' },
      { href: '/admin/asignaciones', type: 'Nombramientos', title: 'Asignar cargos', description: 'Registrar nombramientos, traslados, vacantes y responsables.' },
      { href: '/admin/solicitudes', type: 'Revisión', title: 'Solicitudes de datos', description: 'Atender correcciones o altas solicitadas por usuarios autorizados.' },
    ],
  },
  {
    eyebrow: 'Pastoral y administración',
    title: 'Estructuras no jurisdiccionales',
    description: 'Organización operativa que puede convivir con la jerarquía territorial sin confundirse con ella.',
    modules: [
      { href: '/admin/estructura?kind=pastoral', type: 'Pastoral', title: 'Áreas pastorales', description: 'Configurar comisiones, movimientos, servicios y equipos pastorales.' },
      { href: '/admin/estructura?kind=administrative', type: 'Administrativo', title: 'Curia y oficinas', description: 'Definir curia, oficinas, departamentos y dependencias internas.' },
      { href: '/admin/estructura?kind=organic', type: 'Orgánico', title: 'Organismos y consejos', description: 'Organizar consejos, comités, equipos y estructuras transversales.' },
    ],
  },
  {
    eyebrow: 'Configuración y control',
    title: 'Catálogos, reglas y preparación técnica',
    description: 'Parámetros del sistema, listas controladas, reglas editoriales y comprobaciones del flujo.',
    modules: [
      { href: '/admin/configuracion', type: 'Ajustes', title: 'Centro de configuración', description: 'Configurar cargos, estructuras, permisos, catálogos y reglas editoriales.' },
      { href: '/admin/eventos/verificacion', type: 'Eventos', title: 'Verificar flujo de eventos', description: 'Comprobar que el motor histórico-documental está listo para cierre funcional.' },
      { href: '/admin/estructura/eventos/verificacion', type: 'Estructura', title: 'Verificar flujo estructural', description: 'Comprobar que evolución estructural está lista para cierre funcional.' },
    ],
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

      const { data: profileData } = await supabase.from('profiles').select('full_name,email').eq('id', userData.user.id).maybeSingle()
      const { data: roleData, error: roleError } = await supabase.from('user_role_assignments').select('scope_type,status,roles(key,name)').eq('user_id', userData.user.id).eq('status', 'active')
      if (roleError) {
        setError(roleError.message)
        setLoading(false)
        return
      }

      const { data: summaryData } = await supabase.from('admin_dashboard_summary').select('active_entities,active_dioceses,active_pastoral_areas,pending_change_requests').maybeSingle()
      setProfile((profileData as Profile | null) ?? { full_name: userData.user.email ?? null, email: userData.user.email ?? null })
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

  if (loading) return <main className="container"><div className="empty-state">Cargando portal administrativo...</div></main>
  if (error) return <main className="container"><div className="error-box">{error}</div></main>

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
        <div><p className="eyebrow">Panel administrativo</p><h1>Bienvenido, {profile?.full_name ?? profile?.email}</h1><p className="lead">Elige el flujo de trabajo. Los módulos están agrupados por función operativa.</p></div>
        <button className="button button-secondary" onClick={handleSignOut} type="button">Cerrar sesión</button>
      </div>
      <section className="card admin-section"><h2>Roles activos</h2><div className="role-list">{roles.map((role) => { const roleInfo = getRoleInfo(role); return <span className="role-pill" key={`${roleInfo?.key ?? 'rol'}-${role.scope_type}`}>{roleInfo?.name ?? roleInfo?.key ?? 'Rol'} · {role.scope_type}</span> })}</div></section>
      {summary && <section className="dashboard-grid"><div className="metric-card"><strong>{summary.active_dioceses}</strong><span>Diócesis y jurisdicciones</span></div><div className="metric-card"><strong>{summary.active_entities}</strong><span>Entidades activas</span></div><div className="metric-card"><strong>{summary.active_pastoral_areas}</strong><span>Áreas pastorales</span></div><div className="metric-card"><strong>{summary.pending_change_requests}</strong><span>Solicitudes pendientes</span></div></section>}
      <section className="card admin-section"><div className="section-heading"><div><p className="eyebrow">Acciones inmediatas</p><h2>Trabajo pendiente</h2><p className="meta">Primero atiende lo que espera revisión o prepara el próximo evento verificable.</p></div></div><div className="grid admin-modules">{quickActions.map((module) => <article className="entity-card admin-module" key={`${module.href}-${module.title}`}><p className="entity-type">{module.type}</p><h2>{module.title}</h2><p className="meta">{module.description}</p><Link className="button button-primary" href={module.href}>Abrir</Link></article>)}</div></section>
      {moduleGroups.map((group) => <section className="card admin-section" key={group.title}><div className="section-heading"><div><p className="eyebrow">{group.eyebrow}</p><h2>{group.title}</h2><p className="meta">{group.description}</p></div></div><div className="grid admin-modules">{group.modules.map((module) => <article className="entity-card admin-module" key={`${module.href}-${module.title}`}><p className="entity-type">{module.type}</p><h2>{module.title}</h2><p className="meta">{module.description}</p><Link className="button button-primary" href={module.href}>Abrir</Link></article>)}</div></section>)}
    </main>
  )
}
