import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/admin/authorization'

export async function GET(request: NextRequest) {
  const auth = await requireAdminAccess()
  if (!auth.ok) return auth.response
  const status = request.nextUrl.searchParams.get('status') ?? 'open'
  const { data, error } = await auth.supabase.rpc('admin_list_assignment_canonical_incompatibilities', {
    p_status: status,
    p_limit: 300,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminAccess()
  if (!auth.ok) return auth.response
  const payload = await request.json()
  const { data, error } = await auth.supabase.rpc('admin_resolve_assignment_canonical_incompatibility', { payload })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
