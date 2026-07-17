export type AdminKpiDimension = 'territorial' | 'pastoral' | 'administrative' | 'collegial'

export type AdminKpiValueKind = 'count' | 'percentage' | 'duration_days'

export type AdminKpiDefinition = {
  id: string
  dimension: AdminKpiDimension
  label: string
  description: string
  valueKind: AdminKpiValueKind
  permissionKeys: readonly string[]
  allowedScopeTypes: readonly string[]
  destination?: string
}

const territorialScopes = ['global', 'national', 'diocese', 'vicariate', 'zone', 'parish', 'entity'] as const
const pastoralScopes = ['global', 'national', 'diocese', 'vicariate', 'zone', 'parish', 'pastoral_area', 'organization_unit'] as const
const administrativeScopes = ['global', 'national', 'diocese', 'vicariate', 'zone', 'parish', 'pastoral_area', 'organization_unit', 'entity'] as const
const collegialScopes = ['global', 'national', 'diocese', 'vicariate', 'zone', 'parish', 'organization_unit', 'entity'] as const

export const adminKpiDefinitions: readonly AdminKpiDefinition[] = [
  {
    id: 'territorial.active_entities',
    dimension: 'territorial',
    label: 'Entidades activas',
    description: 'Entidades eclesiales activas dentro del alcance seleccionado.',
    valueKind: 'count',
    permissionKeys: ['entities.view'],
    allowedScopeTypes: territorialScopes,
    destination: '/admin/jurisdicciones',
  },
  {
    id: 'territorial.active_parishes',
    dimension: 'territorial',
    label: 'Parroquias activas',
    description: 'Parroquias y cuasiparroquias activas dentro del alcance seleccionado.',
    valueKind: 'count',
    permissionKeys: ['entities.view'],
    allowedScopeTypes: territorialScopes,
    destination: '/admin/jurisdicciones',
  },
  {
    id: 'territorial.active_people',
    dimension: 'territorial',
    label: 'Personas activas',
    description: 'Personas activas vinculadas al alcance territorial seleccionado.',
    valueKind: 'count',
    permissionKeys: ['people.view'],
    allowedScopeTypes: territorialScopes,
    destination: '/admin/personas',
  },
  {
    id: 'pastoral.active_areas',
    dimension: 'pastoral',
    label: 'Áreas pastorales activas',
    description: 'Áreas pastorales activas dentro del alcance seleccionado.',
    valueKind: 'count',
    permissionKeys: ['pastorals.view'],
    allowedScopeTypes: pastoralScopes,
    destination: '/admin/organizacion',
  },
  {
    id: 'pastoral.active_units',
    dimension: 'pastoral',
    label: 'Unidades pastorales activas',
    description: 'Unidades organizativas de naturaleza pastoral dentro del alcance seleccionado.',
    valueKind: 'count',
    permissionKeys: ['pastorals.view'],
    allowedScopeTypes: pastoralScopes,
    destination: '/admin/organizacion',
  },
  {
    id: 'pastoral.active_agents',
    dimension: 'pastoral',
    label: 'Agentes pastorales activos',
    description: 'Personas con asignaciones pastorales vigentes dentro del alcance seleccionado.',
    valueKind: 'count',
    permissionKeys: ['people.view', 'appointments.view'],
    allowedScopeTypes: pastoralScopes,
    destination: '/admin/personas',
  },
  {
    id: 'administrative.active_assignments',
    dimension: 'administrative',
    label: 'Nombramientos activos',
    description: 'Nombramientos vigentes dentro del alcance seleccionado.',
    valueKind: 'count',
    permissionKeys: ['appointments.view'],
    allowedScopeTypes: administrativeScopes,
    destination: '/admin/asignaciones',
  },
  {
    id: 'administrative.pending_reviews',
    dimension: 'administrative',
    label: 'Pendientes de revisión',
    description: 'Solicitudes pendientes de revisión dentro del alcance seleccionado.',
    valueKind: 'count',
    permissionKeys: ['change_requests.view'],
    allowedScopeTypes: administrativeScopes,
    destination: '/admin/revision',
  },
  {
    id: 'administrative.data_completeness',
    dimension: 'administrative',
    label: 'Completitud de datos',
    description: 'Porcentaje de registros obligatorios completos dentro del alcance seleccionado.',
    valueKind: 'percentage',
    permissionKeys: ['reports.view'],
    allowedScopeTypes: administrativeScopes,
  },
  {
    id: 'collegial.active_bodies',
    dimension: 'collegial',
    label: 'Órganos colegiados activos',
    description: 'Consejos, comisiones y colegios activos dentro del alcance seleccionado.',
    valueKind: 'count',
    permissionKeys: ['entities.view'],
    allowedScopeTypes: collegialScopes,
    destination: '/admin/organizacion',
  },
  {
    id: 'collegial.current_memberships',
    dimension: 'collegial',
    label: 'Membresías vigentes',
    description: 'Integraciones vigentes en órganos colegiados dentro del alcance seleccionado.',
    valueKind: 'count',
    permissionKeys: ['appointments.view'],
    allowedScopeTypes: collegialScopes,
    destination: '/admin/asignaciones',
  },
  {
    id: 'collegial.vacant_positions',
    dimension: 'collegial',
    label: 'Posiciones colegiales vacantes',
    description: 'Posiciones configuradas sin titular vigente dentro del alcance seleccionado.',
    valueKind: 'count',
    permissionKeys: ['appointments.view'],
    allowedScopeTypes: collegialScopes,
    destination: '/admin/asignaciones',
  },
]

export function getAdminKpiDefinition(id: string) {
  return adminKpiDefinitions.find((definition) => definition.id === id) ?? null
}
