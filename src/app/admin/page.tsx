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

type ModuleCard = {
  href: string
  type: string
  title: string
  description: string
}

type ModuleGroup = {
  eyebrow: string
  title: string
  description: string
  modules: ModuleCard[]
}

function getRoleInfo(role: RoleRow): RoleInfo | null {
  if (!role.roles) return null
  if (Array.isArray(role.roles)) return role.roles[0] ?? null
  return role.roles
}

const featuredAdminActions: ModuleCard[] = [
  {
    href: '/admin/eventos',
    type: 'Motor histórico',
    title: 'Registro de eventos',
    description: 'Reconstruye la historia inicial y prepara eventos nuevos con documentos, entidades, fechas y nivel de evidencia.',
  },
  {
    href: '/admin/jurisdicciones',
    type: 'Vista canónica',
    title: 'Explorar jurisdicciones',
    description: 'Valida el árbol Iglesia sui iuris → provincia eclesiástica → sede metropolitana y jurisdicciones sufragáneas.',
  },
  {
    href: '/admin/estructura?kind=territorial',
    type: 'Motor flexible',
    title: 'Configurar estructura interna',
    description: 'Define niveles propios por diócesis: vicarías, zonas pastorales, parroquias, sectores, capillas y comunidades.',
  },
]

const structureCatalogShortcuts: ModuleCard[] = [
  {
    href: '/admin/estructura?kind=territorial',
    type: 'Territorial',
    title: 'Territorial-canónico',
    description: 'Organiza el árbol operativo de diócesis, vicarías, zonas, parroquias, sectores, capillas y comunidades.',
  },
  {
    href: '/admin/estructura?kind=pastoral',
    type: 'Pastoral',
    title: 'Pastoral-operativo',
    description: 'Configura áreas pastorales, comisiones, movimientos, comunidades, servicios y equipos de misión.',
  },
  {
    href: '/admin/estructura?kind=administrative',
    type: 'Administrativo',
    title: 'Administrativo',
    description: 'Define curia, oficinas, departamentos, dependencias internas, procesos y unidades de soporte.',
  },
  {
    href: '/admin/estructura?kind=organic',
    type: 'Orgánico',
    title: 'Orgánico / organigrama',
    description: 'Prepara líneas de responsabilidad, unidades internas y estructura para organigramas visuales.',
  },
]

const moduleGroups: ModuleGroup[] = [
  {
    eyebrow: 'Trabajo diario',
    title: 'Revisar y mantener información',
    description: 'Acciones frecuentes para revisar cambios, completar fichas y mantener datos actualizados.',
    modules: [
      {
        href: '/admin/personas',
        type: 'Personas',
        title: 'Administrar personas',
        description: 'Buscar personas registradas y abrir acciones administrativas como marcar fallecimiento.',
      },
      {
        href: '/admin/alertas',
        type: 'Alertas',
        title: 'Parroquias sin responsable',
        description: 'Ver parroquias sin párroco ni administrador parroquial activo y asignar responsable.',
      },
      {
        href: '/admin/fallecimiento',
        type: 'Estado de persona',
        title: 'Marcar fallecimiento',
        description: 'Registrar el deceso de una persona y cerrar sus cargos activos sin borrar historial.',
      },
      {
        href: '/admin/solicitudes',
        type: 'Revisión',
        title: 'Solicitudes pendientes',
        description: 'Aprobar, rechazar o pedir cambios antes de publicar información.',
      },
      {
        href: '/admin/estado-fichas',
        type: 'Calidad de datos',
        title: 'Fichas incompletas',
        description: 'Ver qué datos faltan y marcar información como no identificada o no aplicable.',
      },
      {
        href: '/admin/asignaciones',
        type: 'Nombramientos',
        title: 'Asignar cargos',
        description: 'Registrar nombramientos, traslados, vacantes y cargos internos o públicos.',
      },
    ],
  },
  {
    eyebrow: 'Motor histórico-documental',
    title: 'Eventos, historia y fuentes',
    description: 'El sistema se alimenta desde eventos: primero carga histórica; luego eventos nuevos con fuente y validación.',
    modules: [
      {
        href: '/admin/eventos',
        type: 'Eventos',
        title: 'Registro de eventos',
        description: 'Ver eventos históricos, fechas derivadas, fuentes y datos pendientes de documento.',
      },
      {
        href: '/admin/eventos',
        type: 'Carga histórica',
        title: 'Reconstruir historia',
        description: 'Cargar hechos pasados como eventos documentados, parciales o importados vigentes.',
      },
      {
        href: '/admin/eventos',
        type: 'Evento nuevo',
        title: 'Registrar cambio nuevo',
        description: 'Preparar cambios futuros para revisión, aprobación y aplicación al estado actual.',
      },
    ],
  },
  {
    eyebrow: 'Agregar o completar datos',
    title: 'Crear fichas y registros',
    description: 'Entradas guiadas para agregar nuevas personas, jurisdicciones, parroquias o capillas.',
    modules: [
      {
        href: '/admin/nuevo',
        type: 'Asistente',
        title: 'Agregar nueva ficha',
        description: 'Crear obispo, sacerdote, jurisdicción, parroquia o capilla mediante pasos guiados.',
      },
      {
        href: '/admin/asignaciones',
        type: 'Cargo o vacante',
        title: 'Agregar nombramiento',
        description: 'Asignar una persona a un cargo o registrar una vacante cuando no hay responsable.',
      },
    ],
  },
  {
    eyebrow: 'Estructura eclesial',
    title: 'Ver y organizar la Iglesia',
    description: 'Herramientas para separar la jerarquía territorial-canónica de la organización pastoral, administrativa y colegial.',
    modules: [
      {
        href: '/admin/jurisdicciones',
        type: 'Jurisdicciones',
        title: 'Jurisdicciones eclesiásticas',
        description: 'Ver el árbol Iglesia sui iuris → provincia eclesiástica → sede metropolitana y diócesis sufragáneas.',
      },
      {
        href: '/admin/estructura?kind=territorial',
        type: 'Estructura interna',
        title: 'Estructura pastoral / administrativa',
        description: 'Organizar vicarías, zonas, parroquias, sectores, capillas y unidades internas de cada diócesis.',
      },
      {
        href: '/admin/organigramas',
        type: 'Organigrama',
        title: 'Organigramas visuales',
        description: 'Ver unidades, responsables actuales y áreas sin responsable asignado.',
      },
    ],
  },
  {
    eyebrow: 'Configuración',
    title: 'Ajustes del sistema',
    description: 'Todo lo que define cómo funciona el sistema queda agrupado en un solo lugar.',
    modules: [
      {
        href: '/admin/configuracion',
        type: 'Ajustes',
        title: 'Centro de configuración',
        description: 'Configurar cargos, organigramas, estructura y reglas editoriales desde un solo lugar.',
      },
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
          <p className="lead">Elige qué necesitas hacer. Cada sección agrupa acciones relacionadas para evitar pantallas técnicas dispersas.</p>
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
            <p className="eyebrow">Prioridad operativa</p>
            <h2>Motor histórico-documental</h2>
            <p className="meta">Primero se reconstruye la historia. Después el sistema queda vivo y se alimenta por eventos nuevos.</p>
          </div>
        </div>
        <div className="grid admin-modules">
          {featuredAdminActions.map((module) => (
            <article className="entity-card admin-module" key={module.href}>
              <p className="entity-type">{module.type}</p>
              <h2>{module.title}</h2>
              <p className="meta">{module.description}</p>
              <Link className="button button-primary" href={module.href}>Abrir</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="card admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Motor flexible</p>
            <h2>Accesos rápidos por tipo de catálogo</h2>
            <p className="meta">Cada catálogo abre el mismo configurador con un contexto distinto. Úsalo para no mezclar organización territorial, pastoral, administrativa y orgánica.</p>
          </div>
        </div>
        <div className="grid admin-modules">
          {structureCatalogShortcuts.map((module) => (
            <article className="entity-card admin-module" key={module.href}>
              <p className="entity-type">{module.type}</p>
              <h2>{module.title}</h2>
              <p className="meta">{module.description}</p>
              <Link className="button button-primary" href={module.href}>Abrir catálogo</Link>
            </article>
          ))}
        </div>
      </section>

      {moduleGroups.map((group) => (
        <section className="card admin-section" key={group.title}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">{group.eyebrow}</p>
              <h2>{group.title}</h2>
              <p className="meta">{group.description}</p>
            </div>
          </div>
          <div className="grid admin-modules">
            {group.modules.map((module) => (
              <article className="entity-card admin-module" key={`${module.href}-${module.title}`}>
                <p className="entity-type">{module.type}</p>
                <h2>{module.title}</h2>
                <p className="meta">{module.description}</p>
                <Link className="button button-primary" href={module.href}>Abrir</Link>
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
