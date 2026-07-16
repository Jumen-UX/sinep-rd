export type AdminNavigationSectionKey = 'home' | 'manage' | 'directories' | 'work' | 'system'

export type AdminNavigationPermissionMode = 'any' | 'all'

export type AdminNavigationItem = {
  id: string
  href: string
  icon: string
  label: string
  sublabel: string
  section: AdminNavigationSectionKey
  entryPermissions: readonly string[]
  operationPermissions?: readonly string[]
  permissionMode?: AdminNavigationPermissionMode
  allowedScopeTypes?: readonly string[]
  mobilePriority: number
  alwaysAvailable?: boolean
}

export type AdminNavigationSection = {
  key: AdminNavigationSectionKey
  label: string
  order: number
}

export const adminNavigationSections: readonly AdminNavigationSection[] = [
  { key: 'home', label: 'Inicio', order: 10 },
  { key: 'manage', label: 'Crear y gestionar', order: 20 },
  { key: 'directories', label: 'Directorios', order: 30 },
  { key: 'work', label: 'Centro de trabajo', order: 40 },
  { key: 'system', label: 'Sistema y control', order: 50 },
]

const proposalPermissions = [
  'people.create_proposal',
  'entities.create_proposal',
  'pastorals.create_proposal',
  'appointments.create_proposal',
  'events.create_proposal',
] as const

const nationalScopeTypes = ['global', 'national'] as const

export const adminNavigationItems: readonly AdminNavigationItem[] = [
  {
    id: 'home',
    href: '/admin',
    icon: '⌂',
    label: 'Inicio',
    sublabel: 'Resumen del alcance activo',
    section: 'home',
    entryPermissions: [],
    mobilePriority: 100,
    alwaysAvailable: true,
  },
  {
    id: 'create',
    href: '/admin/nuevo',
    icon: '＋',
    label: 'Agregar ficha',
    sublabel: 'Asistentes permitidos',
    section: 'manage',
    entryPermissions: proposalPermissions,
    operationPermissions: proposalPermissions,
    mobilePriority: 80,
  },
  {
    id: 'imports',
    href: '/admin/importar',
    icon: '⇪',
    label: 'Importaciones',
    sublabel: 'Preparar, revisar y aplicar lotes',
    section: 'manage',
    entryPermissions: ['imports.prepare', 'imports.review', 'imports.apply'],
    operationPermissions: ['imports.prepare', 'imports.review', 'imports.apply'],
    mobilePriority: 70,
  },
  {
    id: 'jurisdictions',
    href: '/admin/jurisdicciones',
    icon: '▥',
    label: 'Jurisdicciones',
    sublabel: 'Diócesis, provincias y territorios',
    section: 'directories',
    entryPermissions: ['entities.view'],
    operationPermissions: [
      'entities.create_proposal',
      'entities.update_proposal',
      'entities.archive_proposal',
      'entities.approve',
      'entities.publish',
    ],
    mobilePriority: 60,
  },
  {
    id: 'organization',
    href: '/admin/organizacion',
    icon: '◇',
    label: 'Organización',
    sublabel: 'Pastorales, curia y unidades',
    section: 'directories',
    entryPermissions: ['pastorals.view', 'entities.view'],
    operationPermissions: [
      'pastorals.create_proposal',
      'pastorals.update_proposal',
      'pastorals.approve',
      'pastorals.publish',
    ],
    mobilePriority: 55,
  },
  {
    id: 'people',
    href: '/admin/personas',
    icon: '◉',
    label: 'Personas',
    sublabel: 'Clero y agentes pastorales',
    section: 'directories',
    entryPermissions: ['people.view'],
    operationPermissions: [
      'people.create_proposal',
      'people.update_proposal',
      'people.approve',
      'people.publish',
    ],
    mobilePriority: 90,
  },
  {
    id: 'appointments',
    href: '/admin/asignaciones',
    icon: '▣',
    label: 'Nombramientos',
    sublabel: 'Cargos, vigencia y sucesión',
    section: 'directories',
    entryPermissions: ['appointments.view'],
    operationPermissions: [
      'appointments.create_proposal',
      'appointments.update_proposal',
      'appointments.close_proposal',
      'appointments.approve',
      'appointments.publish',
    ],
    mobilePriority: 75,
  },
  {
    id: 'events',
    href: '/admin/eventos',
    icon: '◷',
    label: 'Eventos e historial',
    sublabel: 'Efemérides, fuentes y vigencia',
    section: 'directories',
    entryPermissions: ['events.view'],
    operationPermissions: [
      'events.create_proposal',
      'events.update_proposal',
      'events.archive_proposal',
      'events.approve',
      'events.publish',
      'events.apply',
    ],
    mobilePriority: 50,
  },
  {
    id: 'review',
    href: '/admin/revision',
    icon: '!',
    label: 'Pendientes',
    sublabel: 'Solicitudes por revisar',
    section: 'work',
    entryPermissions: ['change_requests.view'],
    operationPermissions: [
      'change_requests.review',
      'change_requests.approve',
      'change_requests.reject',
      'change_requests.publish',
    ],
    mobilePriority: 85,
  },
  {
    id: 'canonical-incompatibilities',
    href: '/admin/incompatibilidades-canonicas',
    icon: '⚠',
    label: 'Incompatibilidades',
    sublabel: 'Nombramientos y reglas canónicas',
    section: 'work',
    entryPermissions: ['appointments.view'],
    operationPermissions: ['appointments.approve', 'appointments.publish'],
    mobilePriority: 65,
  },
  {
    id: 'structure',
    href: '/admin/estructura',
    icon: '▦',
    label: 'Estructura',
    sublabel: 'Plantillas, niveles y nodos',
    section: 'system',
    entryPermissions: ['structures.manage'],
    operationPermissions: ['structures.manage'],
    mobilePriority: 45,
  },
  {
    id: 'activity',
    href: '/admin/actividad',
    icon: '◌',
    label: 'Actividad',
    sublabel: 'Trazabilidad administrativa',
    section: 'system',
    entryPermissions: ['audit.view'],
    mobilePriority: 35,
  },
  {
    id: 'users',
    href: '/admin/usuarios',
    icon: '♙',
    label: 'Usuarios',
    sublabel: 'Roles, accesos y onboarding',
    section: 'system',
    entryPermissions: ['users.view'],
    operationPermissions: ['users.manage', 'users.assign_roles'],
    mobilePriority: 30,
  },
  {
    id: 'countries',
    href: '/admin/paises',
    icon: '◎',
    label: 'Países ISO',
    sublabel: 'Banderas y visibilidad',
    section: 'system',
    entryPermissions: ['security.view'],
    operationPermissions: ['security.manage'],
    allowedScopeTypes: nationalScopeTypes,
    mobilePriority: 20,
  },
  {
    id: 'settings',
    href: '/admin/configuracion',
    icon: '⚙',
    label: 'Configuración',
    sublabel: 'Catálogos y reglas globales',
    section: 'system',
    entryPermissions: ['security.view'],
    operationPermissions: ['security.manage'],
    allowedScopeTypes: nationalScopeTypes,
    mobilePriority: 25,
  },
]
