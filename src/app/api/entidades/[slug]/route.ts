import { NextRequest } from 'next/server'
import { GET as getEntityByQuery } from '../route'

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params
  const url = new URL(request.url)

  url.pathname = '/api/entidades'
  url.search = ''
  url.searchParams.set('slug', slug)

  return getEntityByQuery(new NextRequest(url, {
    headers: request.headers,
  }))
}
