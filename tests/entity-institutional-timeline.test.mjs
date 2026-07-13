import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('public entity profile exposes a unified institutional timeline from one detail request', async () => {
  const [page, detail, timeline] = await Promise.all([
    readRepoFile('src/app/(public)/entidades/[slug]/page.tsx'),
    readRepoFile('src/features/entidades/EntityDetailPage.tsx'),
    readRepoFile('src/features/entidades/EntityInstitutionalTimeline.tsx'),
  ])

  assert.match(page, /EntityDetailPageView/)
  assert.doesNotMatch(page, /EntityInstitutionalTimeline/)
  assert.match(detail, /fetch\(`\/api\/entidades\/\$\{slug\}`\)/)
  assert.equal((detail.match(/fetch\(/g) ?? []).length, 1)
  assert.match(detail, /<EntityInstitutionalTimeline/)
  assert.match(detail, /evolution_events: data\.evolution_events/)
  assert.match(detail, /appointment_history: data\.appointment_history/)
  assert.doesNotMatch(timeline, /fetch\(/)
  assert.match(timeline, /buildEntityInstitutionalTimeline/)
  assert.match(timeline, /evolution_events/)
  assert.match(timeline, /appointment_history/)
  assert.match(timeline, /authorityOfficeKeys/)
  assert.match(timeline, /entity-erection-fallback/)
  assert.match(timeline, /right\.date\.localeCompare\(left\.date\)/)
  assert.match(timeline, /href=\{`\/personas\/\$\{item\.personSlug\}`\}/)
  assert.match(timeline, /href=\{`\/entidades\/\$\{item\.relatedSlug\}`\}/)
  assert.match(timeline, /aria-labelledby="entity-institutional-timeline-title"/)
})
