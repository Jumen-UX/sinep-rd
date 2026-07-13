import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('person detail exposes assignments inside the unified canonical timeline', async () => {
  const [detail, timeline, assignments, service] = await Promise.all([
    readRepoFile('src/features/personas/admin/PersonDetailPage.tsx'),
    readRepoFile('src/features/personas/admin/PersonCanonicalTimeline.tsx'),
    readRepoFile('src/features/personas/admin/PersonAssignmentHistory.tsx'),
    readRepoFile('src/features/personas/services/person-admin-service.ts'),
  ])

  assert.match(detail, /href="#historial"/)
  assert.match(detail, /onItemsChange=\{setAssignments\}/)
  assert.match(detail, /<PersonCanonicalTimeline person=\{person\} assignments=\{assignments\}/)
  assert.match(detail, /Hitos de trayectoria/)

  assert.match(timeline, /ordination_history\.map/)
  assert.match(timeline, /clerical_history\.map/)
  assert.match(timeline, /assignments\.map/)
  assert.match(timeline, /category: 'Nombramiento'/)
  assert.match(timeline, /assignmentEntityTarget/)
  assert.match(timeline, /\.\.\.appointments/)
  assert.match(timeline, /localeCompare/)
  assert.match(timeline, /aria-labelledby="person-canonical-timeline-title"/)

  assert.match(assignments, /export type AssignmentHistoryItem/)
  assert.match(assignments, /onItemsChange\?:/)
  assert.match(assignments, /onItemsChange\?\.\(nextItems\)/)
  assert.match(assignments, /public_position_assignments_with_hierarchy/)

  assert.match(service, /person_public_ordination_history/)
  assert.match(service, /person_public_clerical_history/)
})
