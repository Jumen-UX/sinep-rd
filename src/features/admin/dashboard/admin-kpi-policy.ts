import {
  adminKpiDefinitions,
  type AdminKpiDefinition,
  type AdminKpiDimension,
} from './admin-kpi-contract'

export type AdminKpiAvailability = 'available' | 'not_applicable' | 'hidden'

export type AdminKpiPolicyContext = {
  accessState: 'ready' | 'onboarding' | 'no_role' | 'blocked'
  permissionKeys: readonly string[]
  activeScopeType: string | null
  isUnrestricted: boolean
}

export type ResolvedAdminKpi = AdminKpiDefinition & {
  availability: Exclude<AdminKpiAvailability, 'hidden'>
}

function hasAnyPermission(required: readonly string[], granted: ReadonlySet<string>) {
  if (required.length === 0) return true
  return required.some((permission) => granted.has(permission))
}

export function getAdminKpiAvailability(
  definition: AdminKpiDefinition,
  context: AdminKpiPolicyContext,
): AdminKpiAvailability {
  if (context.accessState !== 'ready') return 'hidden'

  const granted = new Set(context.permissionKeys)
  if (!hasAnyPermission(definition.permissionKeys, granted)) return 'hidden'

  if (context.isUnrestricted) return 'available'
  if (!context.activeScopeType) return 'not_applicable'

  return definition.allowedScopeTypes.includes(context.activeScopeType)
    ? 'available'
    : 'not_applicable'
}

export function getVisibleAdminKpis(
  context: AdminKpiPolicyContext,
  dimension?: AdminKpiDimension,
): ResolvedAdminKpi[] {
  return adminKpiDefinitions.flatMap((definition) => {
    if (dimension && definition.dimension !== dimension) return []

    const availability = getAdminKpiAvailability(definition, context)
    if (availability === 'hidden') return []

    return [{ ...definition, availability }]
  })
}

export function groupAdminKpisByDimension(context: AdminKpiPolicyContext) {
  const dimensions: readonly AdminKpiDimension[] = [
    'territorial',
    'pastoral',
    'administrative',
    'collegial',
  ]

  return dimensions.map((dimension) => ({
    dimension,
    items: getVisibleAdminKpis(context, dimension),
  })).filter((group) => group.items.length > 0)
}
