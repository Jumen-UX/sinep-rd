import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('event correction UI separates record fixes from institutional changes', async () => {
  const page = await readRepoFile('src/features/events/admin/EventCorrectionPage.tsx')
  const route = await readRepoFile('src/app/(admin)/admin/eventos/[eventId]/corregir/page.tsx')

  assert.match(page, /Corrección administrativa/)
  assert.match(page, /No uses esta pantalla para cambios institucionales reales/)
  assert.match(page, /Guardar corrección/)
  assert.match(page, /Historial de revisiones/)
  assert.match(page, /Comparar antes y después/)
  assert.match(page, /loadCanonicalEventRevisions/)
  assert.match(page, /correctCanonicalEvent/)
  assert.match(route, /EventCorrectionPage/)
})

test('revision history reader remains scoped and unavailable to anonymous users', async () => {
  const migration = await readRepoFile('supabase/migrations/20260716033000_expose_event_revision_history.sql')

  assert.match(migration, /current_user_has_permission\('events\.approve'\)/)
  assert.match(migration, /current_user_can_manage_entity\('events\.approve'/)
  assert.match(migration, /revoke all on function public\.get_event_revision_history\(uuid\) from public, anon/i)
  assert.match(migration, /grant execute on function public\.get_event_revision_history\(uuid\) to authenticated/i)
})
