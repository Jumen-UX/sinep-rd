import {
  adminNavigationItems,
  adminNavigationSections,
  type AdminNavigationItem,
  type AdminNavigationPermissionMode,
  type AdminNavigationSection,
} from './admin-navigation-contract'

export type AdminNavigationAccessState = 'ready' | 'onboarding' | 'no_role' | 'blocked'
export type AdminNavigationAvailability = 'available' | 'read_only' | 'hidden'

export type AdminNavigationPolicyContext = {
  accessState: AdminNavigationAccessState
  permissionKeys: readonly string[]
  activeScopeType: string | null
  isUnrestricted: boolean
}

export type ResolvedAdminNavigationItem = AdminNavigationItem & {
  availability: Exclude<AdminNavigationAvailability, 'hidden'>
}

export type ResolvedAdminNavigationSection = AdminNavigationSection & {
  items: ResolvedAdminNavigationItem[]
}

function matchesPermissions(
  requiredPermissions: readonly string[],
  permissionKeys: ReadonlySet<string>,
  mode: AdminNavigationPermissionMode = 'any',
) {
  if (requiredPermissions.length === 0) return true

  if (mode === 'all') {
    return requiredPermissions.every((permission) => permissionKeys.has(permission))
  }

  return requiredPermissions.some((permission) => permissionKeys.has(permission))
}

function isScopeAllowed(
  item: AdminNavigationItem,
  context: AdminNavigationPolicyContext,
) {
  if (!item.allowedScopeTypes?.length || context.isUnrestricted) return true
  if (!context.activeScopeType) return false
  return item.allowedScopeTypes.includes(context.activeScopeType)
}

function resolveAvailability(
  item: AdminNavigationItem,
  context: AdminNavigationPolicyContext,
  permissionKeys: ReadonlySet<string>,
): AdminNavigationAvailability {
  if (context.accessState !== 'ready') return 'hidden'
  if (!isScopeAllowed(item, context)) return 'hidden'

  if (item.alwaysAvailable) return 'available'

  const canEnter = matchesPermissions(
    item.entryPermissions,
    permissionKeys,
    item.permissionMode,
  )

  if (!canEnter) return 'hidden'

  if (!item.operationPermissions?.length) return 'available'

  return matchesPermissions(item.operationPermissions, permissionKeys, 'any')
    ? 'available'
    : 'read_only'
}

export function getAdminNavigationAvailability(
  item: AdminNavigationItem,
  context: AdminNavigationPolicyContext,
): AdminNavigationAvailability {
  return resolveAvailability(item, context, new Set(context.permissionKeys))
}

export function getVisibleAdminNavigationItems(
  context: AdminNavigationPolicyContext,
): ResolvedAdminNavigationItem[] {
  const permissionKeys = new Set(context.permissionKeys)

  return adminNavigationItems.flatMap((item) => {
    const availability = resolveAvailability(item, context, permissionKeys)
    if (availability === 'hidden') return []
    return [{ ...item, availability }]
  })
}

export function getVisibleAdminNavigationSections(
  context: AdminNavigationPolicyContext,
): ResolvedAdminNavigationSection[] {
  const visibleItems = getVisibleAdminNavigationItems(context)

  return adminNavigationSections
    .map((section) => ({
      ...section,
      items: visibleItems.filter((item) => item.section === section.key),
    }))
    .filter((section) => section.items.length > 0)
    .sort((first, second) => first.order - second.order)
}

export function getMobileAdminNavigationItems(
  context: AdminNavigationPolicyContext,
  totalDestinations = 3,
): ResolvedAdminNavigationItem[] {
  const visibleItems = getVisibleAdminNavigationItems(context)
  const home = visibleItems.find((item) => item.id === 'home')
  if (!home) return []

  const boundedTotal = Math.max(1, Math.min(3, Math.trunc(totalDestinations)))
  if (boundedTotal === 1) return [home]

  const prioritized = visibleItems
    .filter((item) => item.id !== 'home')
    .sort((first, second) => {
      if (second.mobilePriority !== first.mobilePriority) {
        return second.mobilePriority - first.mobilePriority
      }
      return first.label.localeCompare(second.label, 'es')
    })
    .slice(0, boundedTotal - 1)

  return [home, ...prioritized]
}

export function isActiveAdminNavigationItem(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}
