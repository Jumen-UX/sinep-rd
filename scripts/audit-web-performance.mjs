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
const legacyPublicDashboardModules = [
  'src/features/public/PublicDashboardClient.tsx',
  'src/features/public/PublicPeoplePastoralViews.tsx',
  'src/features/public/PublicOrganizationViews.tsx',
]
const secondaryDashboardViewModules = [
  'PublicPeopleView',
  'PublicPastoralView',
  'PublicAdministrativeView',
  'PublicCollegialView',
]
const dashboardRouteStyles = [
  'public-combobox.css',
  'public-dashboard.css',
  'public-territorial.css',
]

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
const dashboardExplorerStyles = await readFile(join(srcRoot, 'features', 'public', 'PublicDashboardExplorer.module.css'), 'utf8')
const dashboardModel = await readFile(join(srcRoot, 'features', 'public', 'usePublicDashboardModel.ts'), 'utf8')
const dashboardUrlState = await readFile(join(srcRoot, 'features', 'public', 'PublicDashboardUrlState.ts'), 'utf8')
const dashboardThemeControl = await readFile(join(srcRoot, 'features', 'public', 'PublicDashboardThemeControl.tsx'), 'utf8')
const globalThemeControl = await readFile(join(srcRoot, 'components', 'theme', 'ThemeControl.tsx'), 'utf8')
const themePreferenceHook = await readFile(join(srcRoot, 'components', 'theme', 'useThemePreference.ts'), 'utf8')
const personMetadataLayout = await readFile(join(srcRoot, 'app', '(public)', 'personas', '[slug]', 'layout.tsx'), 'utf8')
const personPhotoSource = await readFile(join(srcRoot, 'features', 'personas', 'person-photo-source.ts'), 'utf8')

if (!rootLayout.includes("from 'next/font/")) {
  findings.push({ rule: 'next-font-required', severity: 'new', path: 'src/app/layout.tsx' })
}

if (rootLayout.includes('features/public/components')) {
  findings.push({ rule: 'global-public-client-hydration', severity: 'new', path: 'src/app/layout.tsx' })
}

const dashboardStylesInRoot = dashboardRouteStyles.filter((style) => rootLayout.includes(`./${style}`))
const missingDashboardPageStyles = dashboardRouteStyles.filter((style) => !dashboardPage.includes(`../${style}`))
if (dashboardStylesInRoot.length > 0 || missingDashboardPageStyles.length > 0) {
  findings.push({
    rule: 'public-dashboard-route-scoped-css',
    severity: 'new',
    path: 'src/app/(public)/page.tsx',
    dashboardStylesInRoot,
    missingDashboardPageStyles,
  })
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

if (dashboardShell.includes('@/components/theme/ThemeControl')
  || !dashboardShell.includes('PublicDashboardThemeControl')
  || !dashboardThemeControl.includes('@/components/theme/useThemePreference')
  || !globalThemeControl.includes("from './useThemePreference'")
  || !themePreferenceHook.includes('export function useThemePreference')) {
  findings.push({ rule: 'public-dashboard-theme-chunk-boundary', severity: 'new', path: 'src/features/public/PublicDashboardShell.tsx' })
}

if (!/^[\'"]use client[\'"]/m.test(dashboardExplorer) || !dashboardExplorer.includes('usePublicDashboardModel')) {
  findings.push({ rule: 'public-dashboard-explorer-boundary', severity: 'new', path: 'src/features/public/PublicDashboardExplorer.tsx' })
}

if (!dashboardExplorer.includes("import { PublicTerritorialView } from './PublicTerritorialView'")) {
  findings.push({ rule: 'public-dashboard-territorial-initial-view', severity: 'new', path: 'src/features/public/PublicDashboardExplorer.tsx' })
}

if (!/import\s*\{\s*lazy,\s*Suspense\s*\}\s*from\s*['"]react['"]/.test(dashboardExplorer)
  || dashboardExplorer.includes('next/dynamic')) {
  findings.push({ rule: 'public-dashboard-react-lazy-boundary', severity: 'new', path: 'src/features/public/PublicDashboardExplorer.tsx' })
}

for (const moduleName of secondaryDashboardViewModules) {
  const staticImport = new RegExp(`from ['"]\\./${moduleName}['"]`)
  const lazyImport = new RegExp(`lazy\\(\\(\\) => import\\(['"]\\./${moduleName}['"]\\)\\)`)
  if (staticImport.test(dashboardExplorer) || !lazyImport.test(dashboardExplorer)) {
    findings.push({ rule: 'public-dashboard-secondary-view-lazy-load', severity: 'new', path: 'src/features/public/PublicDashboardExplorer.tsx', module: moduleName })
  }
}

const suspenseBoundaryCount = dashboardExplorer.match(/<Suspense fallback=/g)?.length ?? 0
if (suspenseBoundaryCount !== secondaryDashboardViewModules.length) {
  findings.push({ rule: 'public-dashboard-secondary-view-suspense', severity: 'new', path: 'src/features/public/PublicDashboardExplorer.tsx', expected: secondaryDashboardViewModules.length, actual: suspenseBoundaryCount })
}

if (dashboardExplorer.includes('ssr: false')) {
  findings.push({ rule: 'public-dashboard-lazy-view-ssr-disabled', severity: 'new', path: 'src/features/public/PublicDashboardExplorer.tsx' })
}

if (!dashboardExplorer.includes('aria-busy="true"') || !dashboardExplorer.includes('role="status" aria-live="polite"')) {
  findings.push({ rule: 'public-dashboard-lazy-view-accessibility', severity: 'new', path: 'src/features/public/PublicDashboardExplorer.tsx' })
}

if (!dashboardExplorer.includes('styles.loadingPanel') || !/\.loadingPanel\s*\{[\s\S]*min-height:/.test(dashboardExplorerStyles)) {
  findings.push({ rule: 'public-dashboard-lazy-view-stability', severity: 'new', path: 'src/features/public/PublicDashboardExplorer.module.css' })
}

const scopeParameters = ['vista', 'pais', 'provincia', 'jurisdiccion']
if (scopeParameters.some((parameter) => !dashboardPage.includes(`params.${parameter}`))
  || !dashboardPage.includes('initialCountry={initialCountry}')
  || !dashboardPage.includes('initialJurisdictionId={initialJurisdictionId}')) {
  findings.push({ rule: 'public-dashboard-url-scope-validation', severity: 'new', path: 'src/app/(public)/page.tsx' })
}

if (!dashboardModel.includes('buildPublicDashboardSearch(window.location.search')
  || !dashboardModel.includes('window.history.replaceState')
  || /router\.replace|fetch\(/.test(dashboardModel)) {
  findings.push({ rule: 'public-dashboard-url-state-sync', severity: 'new', path: 'src/features/public/usePublicDashboardModel.ts' })
}

if (scopeParameters.some((parameter) => !dashboardUrlState.includes(`setOptionalParam(params, '${parameter}'`))
  || /window\.|document\./.test(dashboardUrlState)) {
  findings.push({ rule: 'public-dashboard-url-state-purity', severity: 'new', path: 'src/features/public/PublicDashboardUrlState.ts' })
}

if (!dashboardModel.includes('useMemo<PersonCard[]>')
  || !dashboardModel.includes('const { administrativeUnits, collegialUnits } = useMemo')) {
  findings.push({ rule: 'public-dashboard-derived-data-memoization', severity: 'new', path: 'src/features/public/usePublicDashboardModel.ts' })
}

if (!personPhotoSource.includes("url.hostname === 'placehold.co'")
  || !personPhotoSource.includes('}/png`')
  || !personMetadataLayout.includes('normalizePersonPhotoSource(person.photo_url)')
  || !personMetadataLayout.includes('image,')) {
  findings.push({ rule: 'public-person-social-image-normalization', severity: 'new', path: 'src/app/(public)/personas/[slug]/layout.tsx' })
}

for (const path of legacyPublicDashboardModules) {
  if (sourcePaths.has(path)) {
    findings.push({ rule: 'legacy-public-dashboard-module', severity: 'new', path })
  }
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
    themeControl: 'src/features/public/PublicDashboardThemeControl.tsx',
    sharedThemeHook: 'src/components/theme/useThemePreference.ts',
    routeStyles: dashboardRouteStyles,
    initialView: 'PublicTerritorialView',
    lazyStrategy: 'React.lazy + Suspense',
    lazyModules: secondaryDashboardViewModules,
    loadingStyles: 'src/features/public/PublicDashboardExplorer.module.css',
    shareableScopeParameters: scopeParameters,
    urlState: 'src/features/public/PublicDashboardUrlState.ts',
  },
  personImageContract: {
    sourceNormalizer: 'src/features/personas/person-photo-source.ts',
    metadataLayout: 'src/app/(public)/personas/[slug]/layout.tsx',
  },
  findings,
}

console.log(JSON.stringify(report, null, 2))

if (newFindings.length > 0) {
  console.error(`Se detectaron ${newFindings.length} regresiones de rendimiento en el código fuente.`)
  process.exitCode = 1
}
