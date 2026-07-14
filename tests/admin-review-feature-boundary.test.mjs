import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('review route delegates to the review feature', async () => {
  const source = await readFile('src/app/(admin)/admin/revision/page.tsx', 'utf8')

  assert.match(source, /from '@\/features\/review'/)
  assert.doesNotMatch(source, /fetch\s*\(/)
  assert.doesNotMatch(source, /createClient/)
  assert.doesNotMatch(source, /\.from\s*\(/)
  assert.doesNotMatch(source, /\.rpc\s*\(/)
})

test('review queue I/O stays behind the review feature service', async () => {
  const service = await readFile(
    'src/features/review/services/review-admin-service.ts',
    'utf8',
  )

  assert.match(service, /loadReviewQueue/)
  assert.match(service, /submitReviewDecision/)
  assert.match(service, /\/api\/admin\/revision/)
})
