import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabasePublishableKey, getSupabaseUrl } from './lib/supabase/config'
import { resolveAdminRouteDecision, type AdminAccessState } from './lib/admin/accessPolicy'

const ADMIN_PREFIX = '/admin'
const ADMIN_LOGIN_PATH = '/admin/login'
const ADMIN_ONBOARDING_PATH = '/admin/onboarding'
const ADMIN_RECOVERY_PREFIX = '/admin/recuperar'
const ADMIN_ACCESS_PATH = '/admin/acceso'

type SupabaseCookieToSet = {
  name: string
  value: string
  options: CookieOptions
}

function decorateAdminResponse(response: NextResponse, request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (pathname.startsWith(ADMIN_PREFIX)) {
    response.headers.set('cache-control', 'no-store, max-age=0')
    response.headers.set('x-sinep-admin-pathname', pathname)
    response.headers.set('x-sinep-admin-search', search || '')
  }

  return response
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = ADMIN_LOGIN_PATH
  url.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`)
  return decorateAdminResponse(NextResponse.redirect(url), request)
}

function redirectToAdmin(request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = ADMIN_PREFIX
  url.search = ''
  return decorateAdminResponse(NextResponse.redirect(url), request)
}

function redirectToOnboarding(request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = ADMIN_ONBOARDING_PATH
  url.search = ''
  return decorateAdminResponse(NextResponse.redirect(url), request)
}

function redirectToAccessStatus(request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = ADMIN_ACCESS_PATH
  url.search = ''
  return decorateAdminResponse(NextResponse.redirect(url), request)
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  let response = NextResponse.next({ request })

  const supabase = createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: SupabaseCookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { data, error } = await supabase.auth.getUser()
  const user = error ? null : data.user

  const entryResult = user ? await supabase.rpc('get_my_admin_entry_context') : null
  const accessState: AdminAccessState = entryResult?.error
    ? 'blocked'
    : entryResult?.data?.access_state as AdminAccessState

  const decision = resolveAdminRouteDecision({
    pathname,
    authenticated: Boolean(user),
    accessState,
  })

  if (decision.action === 'redirect') {
    if (decision.destination === ADMIN_LOGIN_PATH) return redirectToLogin(request)
    if (decision.destination === ADMIN_ONBOARDING_PATH) return redirectToOnboarding(request)
    if (decision.destination === ADMIN_ACCESS_PATH) return redirectToAccessStatus(request)
    return redirectToAdmin(request)
  }

  return decorateAdminResponse(response, request)
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
