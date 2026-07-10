import { NextResponse } from 'next/server'
import { recordAdminAudit } from '@/lib/admin/audit'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { isJsonObject } from '@/lib/admin/validation'

const PHOTO_BUCKET = 'person-photos'
const DEFAULT_LIMIT = 100
const MINIMUM_AGE = '1 hour'

function extractPhotoPaths(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((row) => {
    if (!isJsonObject(row) || typeof row.photo_path !== 'string') return []
    const path = row.photo_path.trim()
    return path ? [path] : []
  })
}

export async function POST() {
  try {
    const auth = await requireAdminAccess({
      permissionKey: 'people.update_proposal',
      forbiddenMessage: 'No autorizado para limpiar fotografías huérfanas.',
    })
    if (!auth.ok) return auth.response

    const { data: orphanRows, error: listError } = await auth.supabase.rpc(
      'admin_list_orphan_person_photos',
      {
        p_older_than: MINIMUM_AGE,
        p_limit: DEFAULT_LIMIT,
      },
    )

    if (listError) {
      console.error('Failed to list orphan person photos', listError)
      return NextResponse.json({ error: 'No se pudieron revisar las fotografías huérfanas.' }, { status: 400 })
    }

    const photoPaths = extractPhotoPaths(orphanRows)
    if (photoPaths.length === 0) {
      return NextResponse.json({ found: 0, deleted: 0 })
    }

    const { data: deletedRows, error: deleteError } = await auth.supabase.storage
      .from(PHOTO_BUCKET)
      .remove(photoPaths)

    if (deleteError) {
      console.error('Failed to remove orphan person photos', deleteError)
      return NextResponse.json({ error: 'Se detectaron fotografías huérfanas, pero no pudieron eliminarse.' }, { status: 400 })
    }

    const deletedCount = Array.isArray(deletedRows) ? deletedRows.length : 0

    await recordAdminAudit(auth.supabase, {
      action: 'storage.person_photos.cleanup',
      targetTable: 'storage.objects',
      targetId: null,
      metadata: {
        bucket: PHOTO_BUCKET,
        found: photoPaths.length,
        deleted: deletedCount,
      },
    })

    return NextResponse.json({
      found: photoPaths.length,
      deleted: deletedCount,
    })
  } catch (error) {
    console.error('Unexpected orphan person photo cleanup error', error)
    return NextResponse.json({ error: 'No se pudo completar la limpieza de fotografías.' }, { status: 500 })
  }
}
