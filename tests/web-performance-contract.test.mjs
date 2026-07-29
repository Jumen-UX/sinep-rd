import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

const removedEnhancers = [
  'src/features/public/components/public-country-flag-enhancements.tsx',
  'src/features/public/components/public-dashboard-entity-cards.tsx',
  'src/features/public/components/public-jurisdiction-structure-navigation.tsx',
  'src/features/public/components/public-pastoral-enhancements.tsx',
  'src/features/public/components/scope-back-controls.tsx',
]

test('root layout uses next/font without hydrating obsolete public enhancers', async () => {
  const [layout, fonts] = await Promise.all([
    readRepoFile('src/app/layout.tsx'),
    readRepoFile('src/app/fonts.css'),
  ])

  assert.equal(layout.includes("from 'next/font/google'"), true)
  assert.equal(layout.includes('className={inter.variable}'), true)
  assert.equal(layout.includes("import './fonts.css'"), true)
  assert.equal(layout.includes('features/public/components'), false)
  assert.equal(fonts.includes('var(--font-sans)'), true)

  for (const path of removedEnhancers) {
    await assert.rejects(access(new URL(path, repoRoot)))
  }
})

test('person portraits use next image and approved raster sources', async () => {
  const [photo, publicDetail, adminDetail, audit, workspace, packageSource, nextConfig] = await Promise.all([
    readRepoFile('src/features/personas/components/PersonPhoto.tsx'),
    readRepoFile('src/features/personas/PersonDetailServerView.tsx'),
    readRepoFile('src/features/personas/admin/PersonDetailPage.tsx'),
    readRepoFile('scripts/audit-web-performance.mjs'),
    readRepoFile('pnpm-workspace.yaml'),
    readRepoFile('package.json'),
    readRepoFile('next.config.ts'),
  ])
  const packageJson = JSON.parse(packageSource)

  assert.equal(photo.includes("from 'next/image'"), true)
  assert.equal(photo.includes('priority'), true)
  assert.equal(photo.includes('sizes="(max-width: 640px) 100vw, 320px"'), true)
  assert.equal(photo.includes("url.hostname === 'placehold.co'"), true)
  assert.equal(photo.includes("}/png`"), true)
  assert.equal(photo.includes('dangerouslyAllowSVG'), false)
  assert.equal(publicDetail.includes('<PublicPersonPhoto'), true)
  assert.equal(adminDetail.includes('<AdminPersonPhoto'), true)
  assert.equal(publicDetail.includes('<img'), false)
  assert.equal(adminDetail.includes('<img'), false)
  assert.equal(audit.includes('knownRawImageAllowlist'), false)
  assert.equal(nextConfig.includes("hostname: '**.supabase.co'"), true)
  assert.equal(nextConfig.includes("pathname: '/storage/v1/object/**'"), true)
  assert.equal(nextConfig.includes("hostname: 'placehold.co'"), true)
  assert.equal(nextConfig.includes('dangerouslyAllowSVG'), false)
  assert.equal(packageJson.packageManager, 'pnpm@10.18.3')
  assert.match(workspace, /onlyBuiltDependencies:\s*\n\s*- sharp/)
  assert.equal(workspace.includes('allowBuilds:'), false)
})

test('public dashboard reads use tagged cache with authenticated invalidation', async () => {
  const [dashboard, cacheTags, revalidate, route, registryAdmin, registryHistory] = await Promise.all([
    readRepoFile('src/lib/public/dashboard.ts'),
    readRepoFile('src/lib/public/cache-tags.ts'),
    readRepoFile('src/lib/public/revalidate.ts'),
    readRepoFile('src/app/api/admin/public-cache/route.ts'),
    readRepoFile('src/features/ecclesial-registry/services/ecclesial-registry-admin-service.ts'),
    readRepoFile('src/features/ecclesial-registry/services/ecclesial-registry-history-service.ts'),
  ])

  assert.equal(dashboard.includes('unstable_cache'), true)
  assert.equal(dashboard.includes('PUBLIC_CACHE_REVALIDATE_SECONDS'), true)
  assert.equal(cacheTags.includes("registry: 'public:registry'"), true)
  assert.equal(revalidate.includes('revalidateTag'), true)
  assert.equal(revalidate.includes('revalidatePath'), true)
  assert.equal(route.includes("supabase.auth.getUser()"), true)
  assert.equal(route.includes("current_user_has_admin_role"), true)
  assert.equal(registryAdmin.includes("requestPublicCacheInvalidation('registry')"), true)
  assert.equal(registryHistory.includes("requestPublicCacheInvalidation('registry')"), true)
})

test('production build enforces route bundle budgets', async () => {
  const [packageSource, auditSource, budgetSource] = await Promise.all([
    readRepoFile('package.json'),
    readRepoFile('scripts/audit-next-bundles.mjs'),
    readRepoFile('config/web-performance-budgets.json'),
  ])
  const packageJson = JSON.parse(packageSource)
  const budgets = JSON.parse(budgetSource)

  assert.equal(packageJson.scripts['audit:bundles'], 'node scripts/audit-next-bundles.mjs')
  assert.match(packageJson.scripts.check, /pnpm build && pnpm audit:bundles$/)
  assert.equal(auditSource.includes('app-build-manifest.json'), true)
  assert.equal(auditSource.includes('gzipSync'), true)
  assert.equal(budgets.javascript.publicInitialCompressedKb > 0, true)
  assert.equal(budgets.javascript.publicDetailCompressedKb > 0, true)
  assert.equal(budgets.javascript.adminInitialCompressedKb > 0, true)
  assert.equal(budgets.routes.includes('/pastoral/[slug]'), true)
  assert.equal(budgets.routes.includes('/lugares/[slug]'), true)
  assert.equal(budgets.routes.includes('/instituciones/[slug]'), true)
})
