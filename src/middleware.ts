Exit code: 0
Wall time: 0.4 seconds
Output:
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabasePublishableKey, getSupabaseUrl } from './lib/supabase/config'

const ADMIN_PREFIX = '/admin'
const ADMIN_LOGIN_PATH = '/admin/login'
const ADMIN_ONBOARDING_PATH = '/admin/onboarding'

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

  const profileResponse = user
    ? await supabase
        .from('profiles')
        .select('onboarding_completed_at')
        .eq('id', user.id)
        .maybeSingle()
    : null
  const needsOnboarding = Boolean(
    user
    && !profileResponse?.error
    && !profileResponse?.data?.onboarding_completed_at,
  )

  if (pathname === ADMIN_LOGIN_PATH) {
    if (!user) return decorateAdminResponse(response, request)
    return needsOnboarding ? redirectToOnboarding(request) : redirectToAdmin(request)
  }

  if (!pathname.startsWith(ADMIN_PREFIX)) return response
  if (!user) return redirectToLogin(request)
  if (pathname === ADMIN_ONBOARDING_PATH) return decorateAdminResponse(response, request)
  if (needsOnboarding) return redirectToOnboarding(request)

  const rpcResult = await supabase.rpc('current_user_has_admin_role')
  let hasAdminRole = rpcResult.data === true

  if (rpcResult.error || !hasAdminRole) {
    const { count, error: assignmentError } = await supabase
      .from('user_role_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'active')
      .or(`starts_at.is.null,starts_at.lte.${new Date().toISOString().slice(0, 10)}`)
      .or(`ends_at.is.null,ends_at.gte.${new Date().toISOString().slice(0, 10)}`)

    if (assignmentError) {
      console.warn('[sinep-admin-role-check]', {
        userId: user.id,
        rpcError: rpcResult.error?.message ?? null,
        assignmentError: assignmentError.message,
      })
    } else {
      hasAdminRole = (count ?? 0) > 0
    }
  }

  if (!hasAdminRole) {
    return pathname === ADMIN_PREFIX ? decorateAdminResponse(response, request) : redirectToAdmin(request)
  }

  return decorateAdminResponse(response, request)
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}

