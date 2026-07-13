import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('person detail exposes a unified canonical timeline', async () => {
  const [detail, timeline, service] = await Promise.all([
    readRepoFile('src/features/personas/admin/PersonDetailPage.tsx'),
    readRepoFile('src/features/personas/admin/PersonCanonicalTimeline.tsx'),
    readRepoFile('src/features/personas/services/person-admin-service.ts'),
  ])

  assert.match(detail, /PersonCanonicalTimeline/)
  assert.match(detail, /href="#historial"/)
  assert.match(detail, /<PersonCanonicalTimeline person=\{person\}/)
  assert.match(timeline, /ordination_history\.map/)
  assert.match(timeline, /clerical_history\.map/)
  assert.match(timeline, /dimension_type/)
  assert.match(timeline, /localeCompare/)
  assert.match(timeline, /aria-labelledby="person-canonical-timeline-title"/)
  assert.match(service, /person_public_ordination_history/)
  assert.match(service, /person_public_clerical_history/)
})
