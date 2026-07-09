import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabasePublishableKey, getSupabaseUrl } from './lib/supabase/config'

const ADMIN_PREFIX = '/admin'
const ADMIN_LOGIN_PATH = '/admin/login'

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
  const response = NextResponse.redirect(url)
  return decorateAdminResponse(response, request)
}

function redirectToAdmin(request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = ADMIN_PREFIX
  url.search = ''
  const response = NextResponse.redirect(url)
  return decorateAdminResponse(response, request)
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const search = request.nextUrl.search

  if (pathname.startsWith(ADMIN_PREFIX)) {
    console.warn(`[sinep-admin-route] pathname=${pathname} search=${search || ''}`)
  }

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

  if (pathname === ADMIN_LOGIN_PATH) {
    return user ? redirectToAdmin(request) : decorateAdminResponse(response, request)
  }

  if (!pathname.startsWith(ADMIN_PREFIX)) {
    return response
  }

  if (!user) {
    return redirectToLogin(request)
  }

  const { data: hasAdminRole, error: roleError } = await supabase.rpc('current_user_has_admin_role')

  if (roleError) {
    console.warn(`[sinep-admin-role-check] user=${user.id} error=${roleError.message}`)
  }

  if (roleError || hasAdminRole !== true) {
    return pathname === ADMIN_PREFIX ? decorateAdminResponse(response, request) : redirectToAdmin(request)
  }

  return decorateAdminResponse(response, request)
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
