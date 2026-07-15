export type AdminAccessState = 'ready' | 'onboarding' | 'no_role' | 'blocked' | undefined

export type AdminRouteDecision =
  | { action: 'continue' }
  | { action: 'redirect'; destination: '/admin' | '/admin/login' | '/admin/onboarding' | '/admin/acceso' }

type AdminRouteContext = {
  pathname: string
  authenticated: boolean
  accessState: AdminAccessState
}

export function resolveAdminRouteDecision({
  pathname,
  authenticated,
  accessState,
}: AdminRouteContext): AdminRouteDecision {
  if (pathname === '/admin/login') {
    if (!authenticated) return { action: 'continue' }
    if (accessState === 'ready') return { action: 'redirect', destination: '/admin' }
    if (accessState === 'onboarding') return { action: 'redirect', destination: '/admin/onboarding' }
    return { action: 'redirect', destination: '/admin/acceso' }
  }

  if (pathname.startsWith('/admin/recuperar')) return { action: 'continue' }
  if (!pathname.startsWith('/admin')) return { action: 'continue' }
  if (!authenticated) return { action: 'redirect', destination: '/admin/login' }

  if (pathname === '/admin/acceso') {
    return accessState === 'ready'
      ? { action: 'redirect', destination: '/admin' }
      : { action: 'continue' }
  }

  if (pathname === '/admin/onboarding') {
    if (accessState === 'onboarding') return { action: 'continue' }
    return accessState === 'ready'
      ? { action: 'redirect', destination: '/admin' }
      : { action: 'redirect', destination: '/admin/acceso' }
  }

  if (accessState === 'onboarding') {
    return { action: 'redirect', destination: '/admin/onboarding' }
  }

  if (accessState !== 'ready') {
    return { action: 'redirect', destination: '/admin/acceso' }
  }

  return { action: 'continue' }
}
