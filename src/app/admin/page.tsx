'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>

type Profile = { full_name: string | null; email: string | null }
type RoleInfo = { key: string; name: string }
type RoleRow = { scope_type: string | null; status: string; roles: RoleInfo[] | RoleInfo | null }
type Summary = { active_entities: number; active_dioceses: number; active_pastoral_areas: number; pending_change_requests: number }
type ModuleStatus = 'active' | 'planned' | 'config'
type ModuleCard = { href: string; icon: string; type: string; title: string; description: string; status?: ModuleStatus; items?: string[] }
type ModuleGroup = { id: string; icon: string; eyebrow: string; title: string; description: string; modules: ModuleCard[] }

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

const quickActions: ModuleCard[] = [
  { href: '/admin/nuevo/jurisdiccion', icon: '⛪', type: 'Gobierno', title: 'Nueva jurisdicción', description: 'Provincia, arquidiócesis, diócesis u ordinariato.' },
  { href: '/admin/nuevo/parroquia', icon: '✚', type: 'Territorio', title: 'Nueva parroquia', description: 'Crear parroquia con país y estructura flexible.' },
  { href: '/admin/nuevo/capilla', icon: '⌂', type: 'Territorio', title: 'Nueva capilla', description: 'Vincular capilla a parroquia o entidad superior.' },
  { href: '/admin/nuevo/sacerdote', icon: '●', type: 'Clero', title: 'Registrar sacerdote', description: 'Alta clerical con datos privados y ministeriales.' },
  { href: '/admin/asignaciones', icon: '▣', type: 'Cargos', title: 'Cargos y nombramientos', description: 'Nombramientos, vacantes y sucesiones.' },
  { href: '/admin/paises', icon: '◎', type: 'Catálogo', title: 'Países ISO', description: 'Habilitar país, bandera y visibilidad pública.' },
]

const moduleGroups: ModuleGroup[] = [
  {
    id: 'gobierno',
    icon: '▥',
    eyebrow: 'Gobierno eclesial',
    title: 'Jurisdicciones y relaciones canónicas',
    description: 'Iglesia, provincias eclesiásticas, arquidiócesis, diócesis, ordinariatos y relaciones vigentes o históricas.',
    modules: [
      { href: '/admin/jurisdicciones', icon: '▥', type: 'Activo', title: 'Jurisdicciones', description: 'Ver y administrar jurisdicciones canónicas.', items: ['Provincias eclesiásticas', 'Arquidiócesis y diócesis', 'Ordinariatos'] },
      { href: '/admin/nuevo/jurisdiccion', icon: '＋', type: 'Asistente', title: 'Nueva jurisdicción', description: 'Crear jurisdicción desde país habilitado y relación jerárquica.', items: ['País ISO', 'Dependencia', 'Ficha pública'] },
      { href: '/admin/jurisdicciones?vista=relaciones', icon: '↔', type: 'Próximo', title: 'Relaciones canónicas', description: 'Auditar sufraganeidad, sede metropolitana y dependencia.', status: 'planned', items: ['Historial', 'Relaciones', 'Validación'] },
    ],
  },
  {
    id: 'estructura',
    icon: '▦',
    eyebrow: 'Territorio y estructura',
    title: 'Organización interna flexible',
    description: 'Vicarías, zonas pastorales, decanatos, sectores, parroquias, capillas y comunidades según cada diócesis.',
    modules: [
      { href: '/admin/estructura?kind=territorial', icon: '▦', type: 'Activo', title: 'Estructura interna', description: 'Configurar niveles y jerarquías internas por diócesis.', items: ['Vicarías', 'Zonas', 'Sectores'] },
      { href: '/admin/nuevo/parroquia', icon: '✚', type: 'Asistente', title: 'Nueva parroquia', description: 'Crear parroquia con selector territorial dinámico.', items: ['País', 'Diócesis', 'Nivel padre'] },
      { href: '/admin/nuevo/capilla', icon: '⌂', type: 'Asistente', title: 'Nueva capilla', description: 'Crear capilla y vincularla a parroquia o sector.', items: ['Parroquia madre', 'Comunidad', 'Fuente'] },
      { href: '/admin/estructura/eventos', icon: '◷', type: 'Activo', title: 'Evolución estructural', description: 'Registrar creación, división, fusión o supresión.', items: ['Eventos', 'Fechas', 'Fuentes'] },
    ],
  },
  {
    id: 'personas',
    icon: '◉',
    eyebrow: 'Personas y ministerios',
    title: 'Personas, cargos y nombramientos',
    description: 'Obispos, presbíteros, diáconos, religiosos y laicos con responsabilidad registrada.',
    modules: [
      { href: '/admin/personas', icon: '◉', type: 'Activo', title: 'Personas', description: 'Buscar y administrar fichas personales.', items: ['Clero', 'Religiosos', 'Laicos'] },
      { href: '/admin/nuevo/sacerdote', icon: '●', type: 'Asistente', title: 'Registrar sacerdote', description: 'Crear sacerdote nuevo o completar desde diácono.', items: ['Perfil clerical', 'Ordenación', 'Cargo rápido'] },
      { href: '/admin/nuevo/obispo', icon: '◍', type: 'Asistente', title: 'Registrar obispo', description: 'Completar perfil episcopal y jurisdicción.', items: ['Sacerdote base', 'Ordenación', 'Oficio'] },
      { href: '/admin/asignaciones', icon: '▣', type: 'Activo', title: 'Nombramientos', description: 'Registrar cargos vigentes, vacantes, reemplazos e historial.', items: ['Cargos', 'Sucesión', 'Historial limpio'] },
    ],
  },
  {
    id: 'historia',
    icon: '◷',
    eyebrow: 'Eventos históricos',
    title: 'Hechos, fuentes y trazabilidad',
    description: 'Todo cambio relevante debe quedar como hecho verificable con fecha, fuente, participantes y estado de revisión.',
    modules: [
      { href: '/admin/eventos', icon: '◷', type: 'Activo', title: 'Registro de eventos', description: 'Explorar eventos históricos y hechos pendientes.', items: ['Hechos', 'Cronología', 'Evidencia'] },
      { href: '/admin/eventos/nuevo', icon: '＋', type: 'Carga', title: 'Registrar hecho', description: 'Cargar erecciones, nombramientos, cambios y estados importados.', items: ['Fecha efectiva', 'Fuente', 'Impacto'] },
      { href: '/admin/eventos/pendientes', icon: '!', type: 'Revisión', title: 'Eventos pendientes', description: 'Revisar, aprobar, devolver o cancelar eventos.', items: ['Aprobación', 'Corrección', 'Aplicación'] },
    ],
  },
  {
    id: 'territorio',
    icon: '◎',
    eyebrow: 'Territorio y mapas',
    title: 'Límites civiles, pastorales y canónicos',
    description: 'Separar división civil, delimitación pastoral y territorio eclesiástico sin forzar que coincidan.',
    modules: [
      { href: '/admin/paises', icon: '◎', type: 'Activo', title: 'Países ISO', description: 'Habilitar países, banderas y visibilidad pública.', items: ['ISO2', 'ISO3', 'Banderas'] },
      { href: '/admin/territorio', icon: '▤', type: 'Próximo', title: 'División civil', description: 'Países, provincias, municipios, distritos y barrios.', status: 'planned', items: ['ISO 3166-2', 'Municipios', 'Sectores'] },
      { href: '/admin/territorio/mapas', icon: '⌖', type: 'Próximo', title: 'Mapas y delimitaciones', description: 'Dibujar o validar límites territoriales y canónicos.', status: 'planned', items: ['Mapas', 'Límites', 'Capas'] },
    ],
  },
  {
    id: 'usuarios',
    icon: '♙',
    eyebrow: 'Usuarios y acceso',
    title: 'Cuentas, roles, permisos y sesiones',
    description: 'Administración de usuarios del sistema, roles por alcance y auditoría de acceso.',
    modules: [
      { href: '/admin/usuarios', icon: '♙', type: 'Activo', title: 'Usuarios del sistema', description: 'Crear, activar, suspender y vincular usuarios.', items: ['Usuarios', 'Personas vinculadas', 'Estado'] },
      { href: '/admin/usuarios', icon: '◇', type: 'Activo', title: 'Roles y permisos', description: 'Asignar roles por país, diócesis o módulo.', items: ['Alcance', 'Rol', 'Permisos'] },
      { href: '/admin/usuarios', icon: '◷', type: 'Activo', title: 'Auditoría de acceso', description: 'Consultar ingresos, sesiones y acciones sensibles disponibles.', items: ['Sesiones', 'Cambios', 'Seguridad'] },
    ],
  },
  {
    id: 'organismos',
    icon: '◇',
    eyebrow: 'Organismos y administración',
    title: 'Curia, oficinas, consejos y servicios pastorales',
    description: 'Estructuras no territoriales que pueden ser administrativas, pastorales u orgánicas.',
    modules: [
      { href: '/admin/estructura?kind=administrative', icon: '▣', type: 'Activo', title: 'Curia y oficinas', description: 'Configurar departamentos, oficinas y dependencias.', items: ['Curia', 'Oficinas', 'Dependencias'] },
      { href: '/admin/estructura?kind=pastoral', icon: '✦', type: 'Activo', title: 'Comisiones y servicios', description: 'Áreas pastorales, comisiones, movimientos y servicios.', items: ['Pastoral', 'Comisiones', 'Equipos'] },
      { href: '/admin/estructura?kind=organic', icon: '◇', type: 'Activo', title: 'Consejos y organismos', description: 'Consejos, comités y estructuras transversales.', items: ['Consejos', 'Comités', 'Coordinación'] },
    ],
  },
  {
    id: 'configuracion',
    icon: '⚙',
    eyebrow: 'Configuración',
    title: 'Catálogos, reglas y validaciones',
    description: 'Listas controladas, estándares oficiales, tipos canónicos, cargos, estados y comprobaciones del sistema.',
    modules: [
      { href: '/admin/configuracion', icon: '⚙', type: 'Activo', title: 'Centro de configuración', description: 'Configurar cargos, estructuras, catálogos y reglas editoriales.', items: ['Catálogos', 'Reglas', 'Ajustes'] },
      { href: '/admin/configuracion/catalogos', icon: '▤', type: 'Próximo', title: 'Catálogos oficiales', description: 'Listas ISO, tipos canónicos, cargos, fuentes y categorías.', status: 'planned', items: ['ISO', 'Tipos', 'Fuentes'] },
      { href: '/admin/estructura/eventos/verificacion', icon: '✓', type: 'Activo', title: 'Verificación estructural', description: 'Comprobar flujo de evolución estructural.', items: ['Impacto', 'Contrato', 'Aplicación'] },
    ],
  },
]

function StatusBadge({ status }: { status?: ModuleStatus }) {
  if (status === 'planned') return <span className="admin-status-pill planned">Próximo</span>
  if (status === 'config') return <span className="admin-status-pill config">Configurar</span>
  return <span className="admin-status-pill active">Activo</span>
}

function QuickActionCard({ module }: { module: ModuleCard }) {
  return (
    <a className="admin-quick-card" href={module.href}>
      <span className="admin-card-icon">{module.icon}</span>
      <span>
        <strong>{module.title}</strong>
        <small>{module.type}</small>
      </span>
      <span className="admin-card-arrow" aria-hidden="true">→</span>
    </a>
  )
}

function ModuleCardView({ module }: { module: ModuleCard }) {
  const isPlanned = module.status === 'planned'
  const className = `admin-module-card ${isPlanned ? 'is-planned' : 'is-active'}`

  const content = (
    <>
      <div className="admin-module-card-head">
        <span className="admin-module-icon">{module.icon}</span>
        <StatusBadge status={module.status} />
      </div>
      <p className="entity-type">{module.type}</p>
      <h3>{module.title}</h3>
      <p className="meta">{module.description}</p>
      {module.items && module.items.length > 0 && (
        <ul>
          {module.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
      <span className={`admin-module-action ${isPlanned ? 'disabled' : ''}`}>{isPlanned ? 'Pendiente' : 'Abrir módulo'} <span aria-hidden="true">→</span></span>
    </>
  )

  if (isPlanned) return <article className={className}>{content}</article>
  return <a className={className} href={module.href}>{content}</a>
}

export default function AdminPage() {
  const router = useRouter()
  const [client, setClient] = useState<SupabaseClient | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [activeAssignments, setActiveAssignments] = useState<number | null>(null)
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

      const [{ data: summaryData }, assignmentCountResponse] = await Promise.all([
        supabase.from('admin_dashboard_summary').select('active_entities,active_dioceses,active_pastoral_areas,pending_change_requests').maybeSingle(),
        supabase.from('position_assignments').select('id', { count: 'exact', head: true }).eq('is_current', true).eq('assignment_status', 'active'),
      ])

      setProfile((profileData as Profile | null) ?? { full_name: userData.user.email ?? null, email: userData.user.email ?? null })
      setRoles((roleData ?? []) as unknown as RoleRow[])
      setSummary((summaryData as Summary | null) ?? null)
      setActiveAssignments(assignmentCountResponse.error ? null : assignmentCountResponse.count ?? 0)
      setLoading(false)
    }

    loadAdmin()
  }, [router])

  async function handleSignOut() {
    const supabase = client ?? createClient()
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

  return (
    <div id="top">
      <header className="admin-top-header">
        <div className="admin-top-title">
          <span className="admin-mini-mark">SINEP RD</span>
          <strong>Portal administrativo</strong>
        </div>
        <div className="admin-top-actions">
          <a className="button button-secondary" href="/">Ver sitio público</a>
          <div className="admin-user-chip">
            <span className="admin-user-avatar">{getInitials(profile)}</span>
            <span>
              <strong>{profile?.full_name ?? profile?.email}</strong>
              <small>Administrador</small>
            </span>
          </div>
          <button className="button button-secondary" onClick={handleSignOut} type="button">Salir</button>
        </div>
      </header>

      <section className="admin-welcome-panel">
        <div>
          <p className="eyebrow">Bienvenido</p>
          <h1>{profile?.full_name ?? profile?.email}</h1>
          <p className="lead">Gestiona la información eclesial, pastoral y territorial desde un flujo ordenado, seguro y verificable.</p>
          <div className="role-list admin-role-list">
            {roles.map((role) => {
              const roleInfo = getRoleInfo(role)
              return <span className="role-pill" key={`${roleInfo?.key ?? 'rol'}-${role.scope_type}`}>{roleInfo?.name ?? roleInfo?.key ?? 'Rol'} · {role.scope_type}</span>
            })}
          </div>
        </div>
        <div className="admin-welcome-illustration" aria-hidden="true">♰</div>
      </section>

      <section className="admin-action-panel card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Acciones rápidas</p>
            <h2>Trabajo frecuente</h2>
          </div>
          <a className="admin-section-top-link" href="/admin/nuevo">Ver todos</a>
        </div>
        <div className="admin-quick-grid">{quickActions.map((module) => <QuickActionCard module={module} key={module.href} />)}</div>
      </section>

      {summary && (
        <section className="admin-stat-strip" aria-label="Resumen administrativo">
          <a href="/admin/jurisdicciones"><span>▥</span><strong>{summary.active_dioceses}</strong><small>Jurisdicciones registradas</small></a>
          <a href="/admin/estructura?kind=territorial"><span>▦</span><strong>{summary.active_entities}</strong><small>Entidades eclesiales</small></a>
          <a href="/admin/personas"><span>◉</span><strong>{summary.active_pastoral_areas}</strong><small>Áreas pastorales</small></a>
          <a href="/admin/asignaciones"><span>▣</span><strong>{activeAssignments ?? '—'}</strong><small>Nombramientos activos</small></a>
          <a href="/admin/eventos/pendientes"><span>!</span><strong>{summary.pending_change_requests}</strong><small>Pendientes de validación</small></a>
        </section>
      )}

      <section className="admin-main-modules">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Módulos principales</p>
            <h2>Centro de administración</h2>
          </div>
        </div>

        {moduleGroups.map((group) => (
          <article className="admin-module-group" id={group.id} key={group.id}>
            <div className="admin-group-heading">
              <span>{group.icon}</span>
              <div>
                <p className="eyebrow">{group.eyebrow}</p>
                <h2>{group.title}</h2>
                <p className="meta">{group.description}</p>
              </div>
              <a href="#top">Subir</a>
            </div>
            <div className="admin-module-grid">{group.modules.map((module) => <ModuleCardView module={module} key={`${module.href}-${module.title}`} />)}</div>
          </article>
        ))}
      </section>

      <section className="admin-bottom-grid">
        <article className="card admin-activity-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Actividad reciente</p>
              <h2>Últimos movimientos</h2>
            </div>
            <a className="admin-section-top-link" href="/admin/eventos">Ver todas</a>
          </div>
          <ul>
            <li><span>▦</span><strong>Nueva estructura territorial actualizada</strong><small>Registro administrativo reciente</small></li>
            <li><span>▣</span><strong>Regla de nombramientos protegida</strong><small>Historial de cargos sin duplicados actuales</small></li>
            <li><span>◎</span><strong>Catálogo de países habilitado</strong><small>Países públicos solo con datos registrados</small></li>
          </ul>
        </article>

        <article className="card admin-system-card">
          <p className="eyebrow">Estado del sistema</p>
          <h2>Servicios principales</h2>
          <div><span>Base de datos</span><strong>Operativo</strong></div>
          <div><span>Catálogos</span><strong>Activo</strong></div>
          <div><span>Validación histórica</span><strong>Activo</strong></div>
          <a href="/admin/configuracion">Ver estado completo →</a>
        </article>
      </section>
    </div>
  )
}
