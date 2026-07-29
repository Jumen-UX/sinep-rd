import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { gzipSync } from 'node:zlib'

const root = process.cwd()
const nextRoot = join(root, '.next')
const manifestPath = join(nextRoot, 'app-build-manifest.json')
const budgetPath = join(root, 'config', 'web-performance-budgets.json')

const [manifestSource, budgetSource] = await Promise.all([
  readFile(manifestPath, 'utf8'),
  readFile(budgetPath, 'utf8'),
])

const manifest = JSON.parse(manifestSource)
const budgets = JSON.parse(budgetSource)
const pages = manifest.pages ?? {}
const routeResults = []
const findings = []
const forbiddenRouteChunks = {
  '/admin/login': [
    /(?:^|\/)app\/\(public\)\/page-[^/]+\.js$/,
    /(?:^|\/)app\/\(public\)\/layout-[^/]+\.js$/,
  ],
}
const auditedRoutes = Array.from(new Set([
  ...budgets.routes,
  ...Object.keys(forbiddenRouteChunks),
]))

function manifestKey(route) {
  return route === '/' ? '/page' : `${route}/page`
}

function routeBudget(route) {
  if (route.startsWith('/admin')) return budgets.javascript.adminInitialCompressedKb
  if (route.includes('[')) return budgets.javascript.publicDetailCompressedKb
  return budgets.javascript.publicInitialCompressedKb
}

async function compressedSize(file) {
  const source = await readFile(join(nextRoot, file))
  return gzipSync(source, { level: 9 }).byteLength
}

for (const route of auditedRoutes) {
  const key = manifestKey(route)
  const files = Array.from(new Set(pages[key] ?? []))

  if (files.length === 0) {
    findings.push({ rule: 'route-manifest-missing', route, key })
    continue
  }

  const chunks = await Promise.all(files.map(async (file) => ({
    file,
    compressedBytes: await compressedSize(file),
  })))
  const compressedBytes = chunks.reduce((sum, chunk) => sum + chunk.compressedBytes, 0)
  const compressedKb = Number((compressedBytes / 1024).toFixed(1))
  const budgetKb = routeBudget(route)
  const largestChunk = chunks.reduce(
    (largest, chunk) => chunk.compressedBytes > largest.compressedBytes ? chunk : largest,
    { file: '', compressedBytes: 0 },
  )
  const largestChunkKb = Number((largestChunk.compressedBytes / 1024).toFixed(1))
  const forbiddenPatterns = forbiddenRouteChunks[route] ?? []
  const forbiddenChunks = files.filter((file) => forbiddenPatterns.some((pattern) => pattern.test(file)))

  routeResults.push({
    route,
    manifestKey: key,
    compressedKb,
    budgetKb,
    largestChunk: largestChunk.file,
    largestChunkKb,
    chunkCount: chunks.length,
    forbiddenChunks,
  })

  if (compressedKb > budgetKb) {
    findings.push({
      rule: 'route-javascript-budget',
      route,
      actualKb: compressedKb,
      budgetKb,
    })
  }

  if (largestChunkKb > budgets.javascript.singleDependencyCompressedKb) {
    findings.push({
      rule: 'single-chunk-budget',
      route,
      file: largestChunk.file,
      actualKb: largestChunkKb,
      budgetKb: budgets.javascript.singleDependencyCompressedKb,
    })
  }

  if (forbiddenChunks.length > 0) {
    findings.push({
      rule: 'route-shell-chunk-leak',
      route,
      forbiddenChunks,
    })
  }
}

console.log(JSON.stringify({ routeResults, findings }, null, 2))

if (findings.length > 0) {
  console.error(`La auditoría de bundles detectó ${findings.length} incumplimientos.`)
  process.exitCode = 1
}
