import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import process from 'node:process'

const root = process.cwd()
const srcRoot = join(root, 'src')
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx'])
const serverRenderedPublicDetailRoutes = new Set([
  'src/app/(public)/personas/[slug]/page.tsx',
  'src/app/(public)/entidades/[slug]/page.tsx',
  'src/app/(public)/pastoral/[slug]/page.tsx',
  'src/app/(public)/oficinas/[id]/page.tsx',
  'src/app/(public)/organismos/[id]/page.tsx',
  'src/app/(public)/provincias-eclesiasticas/[slug]/page.tsx',
])
const legacyPublicDashboardClient = 'src/features/public/PublicDashboardClient.tsx'

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
const sourcePaths = new Set(files.map((absolutePath) => relative(root, absolutePath).replaceAll('\\', '/')))

for (const absolutePath of files) {
  const path = relative(root, absolutePath).replaceAll('\\', '/')
  const source = await readFile(absolutePath, 'utf8')
  const isPublicSource = path.includes('/app/(public)/') || path.includes('/features/public/')
  const isClientComponent = /^[\'"]use client[\'"]/m.test(source)

  if (source.includes('<img')) {
    findings.push({ rule: 'raw-img', severity: 'new', path })
  }

  if (isPublicSource && isClientComponent) {
    publicClientComponents.push(path)
  }

  if (serverRenderedPublicDetailRoutes.has(path)) {
    if (isClientComponent) {
      findings.push({ rule: 'public-detail-client-page', severity: 'new', path })
    }
    if (/fetch\(\s*['"`]\/api\//.test(source)) {
      findings.push({ rule: 'public-detail-self-api-fetch', severity: 'new', path })
    }
  }

  if (isPublicSource && (source.includes('setInterval(') || source.includes('new MutationObserver('))) {
    publicPollingComponents.push(path)
    findings.push({ rule: 'public-dom-polling', severity: 'new', path })
  }
}

const rootLayout = await readFile(join(srcRoot, 'app', 'layout.tsx'), 'utf8')
const dashboardService = await readFile(join(srcRoot, 'lib', 'public', 'dashboard.ts'), 'utf8')
const dashboardPage = await readFile(join(srcRoot, 'app', '(public)', 'page.tsx'), 'utf8')
const dashboardShell = await readFile(join(srcRoot, 'features', 'public', 'PublicDashboardShell.tsx'), 'utf8')
const dashboardExplorer = await readFile(join(srcRoot, 'features', 'public', 'PublicDashboardExplorer.tsx'), 'utf8')

if (!rootLayout.includes("from 'next/font/")) {
  findings.push({ rule: 'next-font-required', severity: 'new', path: 'src/app/layout.tsx' })
}

if (rootLayout.includes('features/public/components')) {
  findings.push({ rule: 'global-public-client-hydration', severity: 'new', path: 'src/app/layout.tsx' })
}

if (!dashboardService.includes('unstable_cache')) {
  findings.push({ rule: 'public-dashboard-cache-required', severity: 'new', path: 'src/lib/public/dashboard.ts' })
}

if (!dashboardPage.includes('PublicDashboardShell') || dashboardPage.includes('PublicDashboardClient')) {
  findings.push({ rule: 'public-dashboard-server-shell-required', severity: 'new', path: 'src/app/(public)/page.tsx' })
}

if (/^[\'"]use client[\'"]/m.test(dashboardShell) || /onClick=|onChange=/.test(dashboardShell)) {
  findings.push({ rule: 'public-dashboard-shell-hydration', severity: 'new', path: 'src/features/public/PublicDashboardShell.tsx' })
}

if (!/^[\'"]use client[\'"]/m.test(dashboardExplorer) || !dashboardExplorer.includes('usePublicDashboardModel')) {
  findings.push({ rule: 'public-dashboard-explorer-boundary', severity: 'new', path: 'src/features/public/PublicDashboardExplorer.tsx' })
}

if (sourcePaths.has(legacyPublicDashboardClient)) {
  findings.push({ rule: 'legacy-public-dashboard-client', severity: 'new', path: legacyPublicDashboardClient })
}

const newFindings = findings.filter((finding) => finding.severity === 'new')
const report = {
  rawImages: findings.filter((finding) => finding.rule === 'raw-img'),
  publicClientComponentCount: publicClientComponents.length,
  publicClientComponents,
  publicPollingComponents,
  serverRenderedPublicDetailRoutes: [...serverRenderedPublicDetailRoutes],
  dashboardBoundary: {
    shell: 'src/features/public/PublicDashboardShell.tsx',
    explorer: 'src/features/public/PublicDashboardExplorer.tsx',
  },
  findings,
}

console.log(JSON.stringify(report, null, 2))

if (newFindings.length > 0) {
  console.error(`Se detectaron ${newFindings.length} regresiones de rendimiento en el código fuente.`)
  process.exitCode = 1
}
