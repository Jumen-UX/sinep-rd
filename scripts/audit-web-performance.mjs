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

for (const absolutePath of files) {
  const path = relative(root, absolutePath).replaceAll('\\', '/')
  const source = await readFile(absolutePath, 'utf8')

  if (source.includes('<img')) {
    const severity = knownRawImageAllowlist.has(path) ? 'known' : 'new'
    findings.push({ rule: 'raw-img', severity, path })
  }

  if ((path.includes('/app/(public)/') || path.includes('/features/public/')) && /^['\"]use client['\"]/m.test(source)) {
    publicClientComponents.push(path)
  }
}

const newRawImages = findings.filter((finding) => finding.severity === 'new')
const report = {
  rawImages: findings,
  publicClientComponentCount: publicClientComponents.length,
  publicClientComponents,
}

console.log(JSON.stringify(report, null, 2))

if (newRawImages.length > 0) {
  console.error(`Se detectaron ${newRawImages.length} nuevos usos de <img> fuera de la lista temporal permitida.`)
  process.exitCode = 1
} else if (strict && findings.length > 0) {
  console.error('La auditoría estricta exige eliminar también los usos heredados de <img>.')
  process.exitCode = 1
}
