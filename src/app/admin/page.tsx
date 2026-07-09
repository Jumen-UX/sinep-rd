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
type ModuleCard = { href: string; type: string; title: string; description: string; status?: 'active' | 'planned' }
type ModuleGroup = { eyebrow: string; title: string; description: string; modules: ModuleCard[] }

function getRoleInfo(role: RoleRow): RoleInfo | null {
  if (!role.roles) return null
  if (Array.isArray(role.roles)) return role.roles[0] ?? null
  return role.roles
}

const quickActions: ModuleCard[] = [
  { href: '/admin/eventos/pendientes', type: 'Pendiente', title: 'Revisar eventos', description: 'Atender eventos pendientes antes de aprobar, planificar o contratar.' },
  { href: '/admin/eventos/nuevo', type: 'Carga', title: 'Registrar hecho histórico', description: 'Crear carga histórica, evento nuevo o foto inicial vigente.' },
  { href: '/admin/estructura/eventos', type: 'Cambio', title: 'Registrar evolución estructural', description: 'Preparar cambios de vicarías, zonas, parroquias, sectores o niveles.' },
  { href: '/admin/personas', type: 'Personas', title: 'Buscar persona', description: 'Abrir fichas de obispos, presbíteros, religiosos, diáconos o laicos responsables.' },
]

const moduleGroups: ModuleGroup[] = [
  {
    eyebrow: 'Registro histórico',
    title: 'Hechos, fuentes y trazabilidad',
    description: 'Todo cambio entra al sistema como hecho verificable, con fecha, fuente, participantes, impacto y estado de revisión.',
    modules: [
      { href: '/admin/eventos', type: 'Eventos', title: 'Registro de eventos', description: 'Explorar eventos históricos, fechas derivadas, eventos nuevos y evidencia pendiente.' },
      { href: '/admin/eventos/nuevo', type: 'Carga histórica', title: 'Registrar hecho', description: 'Cargar erecciones, elevaciones, divisiones, nombramientos, cambios y estados importados.' },
      { href: '/admin/eventos/pendientes', type: 'Revisión', title: 'Eventos pendientes', description: 'Revisar, aprobar, devolver o cancelar eventos antes de su aplicación controlada.' },
      { href: '/admin/fuentes', type: 'Fuentes', title: 'Fuentes y documentos', description: 'Administrar decretos, boletines, documentos oficiales y referencias externas.', status: 'planned' },
      { href: '/admin/eventos/verificacion', type: 'Verificación', title: 'Verificación del registro', description: 'Comprobar ciclo de revisión, plan de acciones, contrato y preparación técnica.' },
    ],
  },
  {
    eyebrow: 'Gobierno eclesial',
    title: 'Jurisdicciones y relaciones canónicas',
    description: 'Gobierno territorial-canónico: Iglesia, provincias, arquidiócesis, diócesis, ordinariatos y relaciones vigentes o históricas.',
    modules: [
      { href: '/admin/jurisdicciones', type: 'Jurisdicciones', title: 'Iglesia y jurisdicciones', description: 'Ver Iglesia sui iuris, provincias eclesiásticas, sedes metropolitanas y sufragáneas.' },
      { href: '/admin/jurisdicciones?tipo=provincia', type: 'Provincia', title: 'Provincias eclesiásticas', description: 'Organizar sede metropolitana, diócesis sufragáneas y pertenencia provincial.', status: 'planned' },
      { href: '/admin/jurisdicciones?tipo=diocesis', type: 'Diócesis', title: 'Arquidiócesis y diócesis', description: 'Administrar jurisdicciones diocesanas, categoría, sede, estado y dependencia.', status: 'planned' },
      { href: '/admin/jurisdicciones?tipo=ordinariato', type: 'Personal', title: 'Ordinariatos y jurisdicciones personales', description: 'Gestionar jurisdicciones personales, militares o inmediatamente sujetas.', status: 'planned' },
      { href: '/admin/jurisdicciones?vista=relaciones', type: 'Relaciones', title: 'Relaciones canónicas', description: 'Ver y auditar relaciones de pertenencia, sufraganeidad, sede metropolitana y dependencia.', status: 'planned' },
    ],
  },
  {
    eyebrow: 'Estructura pastoral y territorial',
    title: 'Organización interna flexible de cada diócesis',
    description: 'Vicarías, zonas, parroquias, sectores, capillas y comunidades según el esquema propio de cada jurisdicción.',
    modules: [
      { href: '/admin/estructura?kind=territorial', type: 'Estructura', title: 'Estructura interna', description: 'Configurar niveles y jerarquías internas: vicarías, zonas, parroquias, sectores y capillas.' },
      { href: '/admin/estructura/eventos', type: 'Evolución', title: 'Evolución estructural', description: 'Registrar creación, división, supresión, cambio de límite, dependencia o nivel.' },
      { href: '/admin/estructura?level=parish', type: 'Parroquias', title: 'Parroquias y comunidades', description: 'Gestionar parroquias, cuasiparroquias, capillas, comunidades y centros especiales.', status: 'planned' },
      { href: '/admin/estructura/eventos/verificacion', type: 'Verificación', title: 'Verificación estructural', description: 'Revisar impacto, plan, editor, conflictos y contrato de evolución estructural.' },
    ],
  },
  {
    eyebrow: 'Personas y ministerios',
    title: 'Personas, cargos y nombramientos',
    description: 'Obispos, presbíteros, diáconos, religiosos, laicos con responsabilidad y oficios eclesiásticos.',
    modules: [
      { href: '/admin/personas', type: 'Personas', title: 'Personas', description: 'Buscar y administrar personas registradas en el sistema.' },
      { href: '/admin/personas?tipo=clero', type: 'Clero', title: 'Clero', description: 'Presbíteros, diáconos, incardinación, estado ministerial y pertenencia.', status: 'planned' },
      { href: '/admin/personas?tipo=religiosos', type: 'Vida consagrada', title: 'Religiosos y religiosas', description: 'Institutos, casas religiosas, superiores y miembros con oficio registrado.', status: 'planned' },
      { href: '/admin/asignaciones', type: 'Nombramientos', title: 'Cargos y nombramientos', description: 'Registrar nombramientos, traslados, renuncias, vacantes y responsables.' },
      { href: '/admin/asignaciones?vista=vacantes', type: 'Vacantes', title: 'Vacantes', description: 'Ver cargos vacantes por jurisdicción, parroquia, curia u organismo.', status: 'planned' },
    ],
  },
  {
    eyebrow: 'Usuarios y acceso',
    title: 'Cuentas, roles, permisos y sesiones',
    description: 'Administración de usuarios del sistema. Una persona eclesial puede tener usuario, pero persona y usuario no son lo mismo.',
    modules: [
      { href: '/admin/usuarios', type: 'Usuarios', title: 'Usuarios del sistema', description: 'Crear, activar, suspender y vincular usuarios con personas registradas.', status: 'planned' },
      { href: '/admin/usuarios/roles', type: 'Roles', title: 'Roles y permisos', description: 'Asignar superadministrador, administrador nacional, diocesano, editor o validador según alcance.', status: 'planned' },
      { href: '/admin/usuarios/invitaciones', type: 'Invitaciones', title: 'Invitaciones y altas', description: 'Invitar usuarios, completar registro y definir primer rol administrativo.', status: 'planned' },
      { href: '/admin/usuarios/sesiones', type: 'Sesiones', title: 'Sesiones administrativas', description: 'Definir expiración por inactividad, vida máxima de sesión y cierre forzado.', status: 'planned' },
      { href: '/admin/usuarios/auditoria', type: 'Auditoría', title: 'Auditoría de acceso', description: 'Consultar ingresos, cierres de sesión, cambios de rol y acciones sensibles.', status: 'planned' },
    ],
  },
  {
    eyebrow: 'Territorio y mapas',
    title: 'Límites civiles, pastorales y canónicos',
    description: 'Separar división civil, delimitación pastoral y territorio eclesiástico sin forzar que coincidan.',
    modules: [
      { href: '/admin/paises', type: 'Países', title: 'Países ISO', description: 'Habilitar países desde catálogo ISO, gestionar banderas y controlar visibilidad pública.' },
      { href: '/admin/territorio', type: 'Civil', title: 'División civil', description: 'Países, provincias, municipios, distritos y barrios con listas oficiales.', status: 'planned' },
      { href: '/admin/territorio/mapas', type: 'Mapas', title: 'Mapas y delimitaciones', description: 'Dibujar o validar límites territoriales, pastorales y canónicos.', status: 'planned' },
      { href: '/admin/territorio/intersecciones', type: 'Cruces', title: 'Intersecciones territoriales', description: 'Ver qué municipios, barrios o sectores caen dentro de una estructura eclesial.', status: 'planned' },
    ],
  },
  {
    eyebrow: 'Organismos y administración',
    title: 'Curia, oficinas, consejos y servicios pastorales',
    description: 'Estructuras no territoriales que pueden ser administrativas, pastorales u orgánicas.',
    modules: [
      { href: '/admin/estructura?kind=administrative', type: 'Curia', title: 'Curia y oficinas', description: 'Configurar curia, departamentos, oficinas y dependencias internas.' },
      { href: '/admin/estructura?kind=pastoral', type: 'Pastoral', title: 'Comisiones y servicios', description: 'Áreas pastorales, comisiones, movimientos, servicios y equipos.' },
      { href: '/admin/estructura?kind=organic', type: 'Órganos', title: 'Consejos y organismos', description: 'Consejos, comités, equipos de coordinación y estructuras transversales.' },
    ],
  },
  {
    eyebrow: 'Configuración',
    title: 'Catálogos, reglas y validaciones',
    description: 'Listas controladas, estándares oficiales, tipos canónicos, cargos, estados y comprobaciones del sistema.',
    modules: [
      { href: '/admin/configuracion', type: 'Ajustes', title: 'Centro de configuración', description: 'Configurar cargos, estructuras, catálogos y reglas editoriales.' },
      { href: '/admin/configuracion/catalogos', type: 'Catálogos', title: 'Catálogos oficiales', description: 'Listas ISO, tipos canónicos, cargos, estados, fuentes y categorías.', status: 'planned' },
      { href: '/admin/eventos/verificacion', type: 'Verificación', title: 'Verificación del registro histórico', description: 'Comprobar el flujo histórico-documental.' },
      { href: '/admin/estructura/eventos/verificacion', type: 'Verificación', title: 'Verificación de evolución estructural', description: 'Comprobar el flujo de evolución estructural.' },
    ],
  },
]

function openModule(href: string) {
  if (typeof window !== 'undefined') {
    window.location.assign(href)
  }
}

function ModuleCardView({ module }: { module: ModuleCard }) {
  const isPlanned = module.status === 'planned'
  return (
    <article className="entity-card admin-module" key={`${module.href}-${module.title}`}>
      <p className="entity-type">{module.type}{isPlanned ? ' · Próximo' : ''}</p>
      <h2>{module.title}</h2>
      <p className="meta">{module.description}</p>
      {isPlanned ? (
        <span className="button button-secondary">Pendiente</span>
      ) : (
        <button className="button button-primary" onClick={() => openModule(module.href)} type="button">Abrir</button>
      )}
    </article>
  )
}

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
        <div><p className="eyebrow">Inicio</p><h1>Bienvenido, {profile?.full_name ?? profile?.email}</h1><p className="lead">Administra SINEP por áreas eclesiales: historia, gobierno, estructura, personas, usuarios, territorio y configuración.</p></div>
        <button className="button button-secondary" onClick={handleSignOut} type="button">Cerrar sesión</button>
      </div>
      <section className="card admin-section"><h2>Roles activos</h2><div className="role-list">{roles.map((role) => { const roleInfo = getRoleInfo(role); return <span className="role-pill" key={`${roleInfo?.key ?? 'rol'}-${role.scope_type}`}>{roleInfo?.name ?? roleInfo?.key ?? 'Rol'} · {role.scope_type}</span> })}</div></section>
      {summary && <section className="dashboard-grid"><div className="metric-card"><strong>{summary.active_dioceses}</strong><span>Diócesis y jurisdicciones</span></div><div className="metric-card"><strong>{summary.active_entities}</strong><span>Entidades activas</span></div><div className="metric-card"><strong>{summary.active_pastoral_areas}</strong><span>Áreas pastorales</span></div><div className="metric-card"><strong>{summary.pending_change_requests}</strong><span>Solicitudes pendientes</span></div></section>}
      <section className="card admin-section"><div className="section-heading"><div><p className="eyebrow">Acceso rápido</p><h2>Trabajo frecuente</h2><p className="meta">Acciones que normalmente se revisan o registran primero.</p></div></div><div className="grid admin-modules">{quickActions.map((module) => <ModuleCardView module={module} key={`${module.href}-${module.title}`} />)}</div></section>
      {moduleGroups.map((group) => <section className="card admin-section" key={group.title}><div className="section-heading"><div><p className="eyebrow">{group.eyebrow}</p><h2>{group.title}</h2><p className="meta">{group.description}</p></div></div><div className="grid admin-modules">{group.modules.map((module) => <ModuleCardView module={module} key={`${module.href}-${module.title}`} />)}</div></section>)}
    </main>
  )
}
