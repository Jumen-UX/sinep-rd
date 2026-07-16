import { spawnSync } from 'node:child_process'

const base = process.env.E2E_AFFECTED_BASE ?? 'HEAD^'
const run = process.argv.includes('--run')
const diff = spawnSync('git', ['diff', '--name-only', base, 'HEAD'], { encoding: 'utf8' })

if (diff.status !== 0) {
  console.warn('⚠ No se pudo calcular el diff; se recomienda ejecutar pnpm test:e2e.')
  process.exit(run ? 1 : 0)
}

const files = diff.stdout.split(/\r?\n/).filter(Boolean)
const suites = new Set()

for (const file of files) {
  if (/^(?:src\/app\/(?!\(admin\))|src\/features\/public\/|src\/lib\/public\/|src\/components\/Public)/.test(file)) suites.add('public')
  if (/^(?:src\/features\/importaciones\/|src\/app\/\(admin\)\/admin\/importar\/|src\/app\/api\/admin\/import)/.test(file)) suites.add('admin')
  if (/^(?:src\/features\/(?:access|admin\/navigation)\/|src\/app\/\(admin\)\/admin\/(?:AdminShell\.tsx|login|acceso|usuarios|onboarding|recuperar)(?:\/|$)|src\/middleware)/.test(file)) suites.add('access')
  if (/^(?:supabase\/migrations\/|src\/features\/(?:clero|personas|vida-consagrada)\/)/.test(file)) suites.add('admin:mutation')
  if (/^(?:playwright\.config|e2e\/|package\.json)/.test(file)) {
    suites.add('public')
    suites.add('admin')
    suites.add('access')
    suites.add('admin:mutation')
  }
}

if (suites.size === 0) {
  console.log('No se detectaron suites E2E afectadas.')
  process.exit(0)
}

const commands = [...suites].sort().map((suite) => `pnpm test:e2e:${suite}`)
console.log('Suites E2E afectadas:')
for (const command of commands) console.log(`- ${command}`)

if (!run) process.exit(0)
for (const suite of [...suites].sort()) {
  const result = spawnSync('pnpm', [`test:e2e:${suite}`], { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
