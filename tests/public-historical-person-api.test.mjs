import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const routePath = new URL('../src/app/api/personas/route.ts', import.meta.url)

test('public people API includes historical public statuses in lists and detail', async () => {
  const source = await readFile(routePath, 'utf8')

  assert.match(source, /const publicHistoricalStatuses = 'in\.\(active,retired,emeritus,deceased,transferred\)'/)
  assert.match(source, /status: publicHistoricalStatuses/)
  assert.equal((source.match(/status: publicHistoricalStatuses/g) ?? []).length, 2)
  assert.doesNotMatch(source, /status:\s*'eq\.active'/)
})

test('active directory filter remains a living-person filter', async () => {
  const source = await readFile(routePath, 'utf8')

  assert.match(source, /if \(tipo === 'active'\)/)
  assert.match(source, /filters\.death_date = 'is\.null'/)
  assert.match(source, /visibility: 'eq\.public'/)
})
