import { readdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const integrationFiles = new Set([
  'admin-audit-p1-phase3.test.mjs',
  'admin-permissions-p1.test.mjs',
  'admin-rpc-p1-phase2.test.mjs',
  'admin-rpc-position-assignments.test.mjs',
  'position-assignments.test.mjs',
])

const mode = process.argv[2] ?? 'unit'
const testsDirectory = path.resolve('tests')
const discovered = (await readdir(testsDirectory))
  .filter((file) => file.endsWith('.test.mjs'))
  .sort()

const selected = discovered.filter((file) => {
  if (mode === 'integration') return integrationFiles.has(file)
  if (mode === 'all') return true
  return !integrationFiles.has(file)
})

if (selected.length === 0) {
  console.error(`No test files found for mode: ${mode}`)
  process.exit(1)
}

if (mode === 'integration') {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey || url.includes('example.supabase.co')) {
    console.error('Integration tests require a real NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }
}

const result = spawnSync(
  process.execPath,
  ['--test', ...selected.map((file) => path.join('tests', file))],
  { stdio: 'inherit', env: process.env },
)

process.exit(result.status ?? 1)
