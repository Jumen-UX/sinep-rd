import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('package scripts expose migration documentation impact and selective E2E automation', async () => {
  const packageJson = JSON.parse(await readRepoFile('package.json'))
  const scripts = packageJson.scripts

  assert.equal(scripts['audit:migrations'], 'node scripts/audit-supabase-migrations.mjs')
  assert.equal(scripts['docs:affected'], 'node scripts/report-affected-documentation.mjs')
  assert.equal(scripts['docs:terminology'], 'node scripts/check-documentation-terminology.mjs')
  assert.equal(scripts['e2e:affected'], 'node scripts/select-affected-e2e.mjs')
  assert.match(scripts['check:affected'], /docs:affected/)
  assert.match(scripts['check:affected'], /audit:migrations/)
  assert.match(scripts.check, /audit:migrations/)
})

test('migration audit protects naming security definer and public execution boundaries', async () => {
  const audit = await readRepoFile('scripts/audit-supabase-migrations.mjs')

  assert.match(audit, /\^\(\\d\{14\}\)_/)
  assert.match(audit, /SECURITY DEFINER sin SET search_path/)
  assert.match(audit, /deepAuditStart/)
  assert.match(audit, /allowedLegacyNames/)
  assert.match(audit, /\(\?:=\|to\)/)
  assert.match(audit, /anon\|public/)
  assert.match(audit, /Timestamp de migración duplicado/)
})

test('affected automation maps code changes to documentation and E2E suites', async () => {
  const docs = await readRepoFile('scripts/report-affected-documentation.mjs')
  const e2e = await readRepoFile('scripts/select-affected-e2e.mjs')

  assert.match(docs, /supabase\\\/migrations/)
  assert.match(docs, /active_sprint/)
  assert.match(e2e, /admin:mutation/)
  assert.match(e2e, /test:e2e:/)
  assert.match(e2e, /--run/)
})

test('automation guide requires affected checks before task completion', async () => {
  const guide = await readRepoFile('docs/operations/AUTOMATIZACION_DOCUMENTAL.md')

  assert.match(guide, /pnpm check:affected/)
  assert.match(guide, /pnpm e2e:affected/)
  assert.match(guide, /pnpm check` antes de marcar la tarea como completada/)
})
