import { NextResponse } from 'next/server'
import { PUBLIC_CACHE_TAGS, type PublicCacheScope } from '@/lib/public/cache-tags'
import { revalidatePublicCache } from '@/lib/public/revalidate'
import { createClient } from '@/lib/supabase/server'

const allowedScopes = new Set<PublicCacheScope>([
  ...Object.keys(PUBLIC_CACHE_TAGS) as Array<keyof typeof PUBLIC_CACHE_TAGS>,
  'all',
])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Autenticación requerida.' }, { status: 401 })
  }

  const { data: hasAdminRole, error: roleError } = await supabase.rpc('current_user_has_admin_role')
  if (roleError || hasAdminRole !== true) {
    return NextResponse.json({ error: 'No tienes permisos para invalidar la caché pública.' }, { status: 403 })
  }

  let scope: PublicCacheScope = 'all'
  try {
    const payload = await request.json() as { scope?: string }
    if (payload.scope && allowedScopes.has(payload.scope as PublicCacheScope)) {
      scope = payload.scope as PublicCacheScope
    }
  } catch {
    // Empty bodies intentionally fall back to a full public invalidation.
  }

  revalidatePublicCache(scope)
  return NextResponse.json({ revalidated: true, scope })
}
