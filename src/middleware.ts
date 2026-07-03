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

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = ADMIN_LOGIN_PATH
  url.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`)
  return NextResponse.redirect(url)
}

function redirectToAdmin(request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = ADMIN_PREFIX
  url.search = ''
  return NextResponse.redirect(url)
}

export async function middleware(request: NextRequest) {
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
  const pathname = request.nextUrl.pathname

  if (pathname === ADMIN_LOGIN_PATH) {
    return user ? redirectToAdmin(request) : response
  }

  if (!pathname.startsWith(ADMIN_PREFIX)) {
    return response
  }

  if (!user) {
    return redirectToLogin(request)
  }

  const { data: roles, error: roleError } = await supabase
    .from('user_role_assignments')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)

  if (roleError || !roles?.length) {
    return pathname === ADMIN_PREFIX ? response : redirectToAdmin(request)
  }

  return response
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
