import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (pathname.startsWith('/admin')) {
    console.info(`[sinep-admin-route] pathname=${pathname} search=${search || ''}`)

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-sinep-admin-pathname', pathname)
    requestHeaders.set('x-sinep-admin-search', search || '')

    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set('cache-control', 'no-store, max-age=0')
    response.headers.set('x-sinep-admin-pathname', pathname)
    response.headers.set('x-sinep-admin-search', search || '')
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
