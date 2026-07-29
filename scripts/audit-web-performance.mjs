import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import process from 'node:process'

const root = process.cwd()
const srcRoot = join(root, 'src')
const strict = process.argv.includes('--strict')
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx'])
const knownRawImageAllowlist = new Set([
  'src/features/personas/PersonDetailServerView.tsx',
  'src/features/personas/admin/PersonDetailPage.tsx',
])

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const absolute = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(absolute))
    else if (sourceExtensions.has(extname(entry.name))) files.push(absolute)
  }
  return files
}

const files = await walk(srcRoot)
const findings = []
const publicClientComponents = []
const publicPollingComponents = []

for (const absolutePath of files) {
  const path = relative(root, absolutePath).replaceAll('\\', '/')
  const source = await readFile(absolutePath, 'utf8')
  const isPublicSource = path.includes('/app/(public)/') || path.includes('/features/public/')

  if (source.includes('<img')) {
    const severity = knownRawImageAllowlist.has(path) ? 'known' : 'new'
    findings.push({ rule: 'raw-img', severity, path })
  }

  if (isPublicSource && /^['"]use client['"]/m.test(source)) {
    publicClientComponents.push(path)
  }

  if (isPublicSource && (source.includes('setInterval(') || source.includes('new MutationObserver('))) {
    publicPollingComponents.push(path)
    findings.push({ rule: 'public-dom-polling', severity: 'new', path })
  }
}

const rootLayout = await readFile(join(srcRoot, 'app', 'layout.tsx'), 'utf8')
const dashboardService = await readFile(join(srcRoot, 'lib', 'public', 'dashboard.ts'), 'utf8')

if (!rootLayout.includes("from 'next/font/")) {
  findings.push({ rule: 'next-font-required', severity: 'new', path: 'src/app/layout.tsx' })
}

if (rootLayout.includes("features/public/components")) {
  findings.push({ rule: 'global-public-client-hydration', severity: 'new', path: 'src/app/layout.tsx' })
}

if (!dashboardService.includes('unstable_cache')) {
  findings.push({ rule: 'public-dashboard-cache-required', severity: 'new', path: 'src/lib/public/dashboard.ts' })
}

const newFindings = findings.filter((finding) => finding.severity === 'new')
const report = {
  rawImages: findings.filter((finding) => finding.rule === 'raw-img'),
  publicClientComponentCount: publicClientComponents.length,
  publicClientComponents,
  publicPollingComponents,
  findings,
}

console.log(JSON.stringify(report, null, 2))

if (newFindings.length > 0) {
  console.error(`Se detectaron ${newFindings.length} regresiones de rendimiento en el código fuente.`)
  process.exitCode = 1
} else if (strict && findings.length > 0) {
  console.error('La auditoría estricta exige eliminar también los usos heredados de <img>.')
  process.exitCode = 1
}
