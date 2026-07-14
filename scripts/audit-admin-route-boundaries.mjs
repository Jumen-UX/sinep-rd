import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = path.resolve('src/app/(admin)/admin')
const strict = process.argv.includes('--strict')

const directIoPatterns = [
  ['createClient', /\bcreateClient\s*\(/],
  ['Supabase .from()', /\.from\s*\(/],
  ['Supabase .rpc()', /\.rpc\s*\(/],
  ['fetch()', /\bfetch\s*\(/],
]

async function collectPages(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const pages = []

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      pages.push(...await collectPages(absolutePath))
      continue
    }

    if (entry.isFile() && entry.name === 'page.tsx') pages.push(absolutePath)
  }

  return pages
}

function classify(source) {
  const directIo = directIoPatterns
    .filter(([, pattern]) => pattern.test(source))
    .map(([label]) => label)

  if (directIo.length > 0) return { category: 'direct-io', directIo }
  if (/from\s+['"]@\/features\//.test(source)) return { category: 'feature', directIo: [] }
  return { category: 'composition', directIo: [] }
}

const pageFiles = (await collectPages(root)).sort()
const rows = []

for (const absolutePath of pageFiles) {
  const source = await readFile(absolutePath, 'utf8')
  const relativePath = path.relative(process.cwd(), absolutePath).split(path.sep).join('/')
  const lineCount = source.split(/\r?\n/).length
  rows.push({ path: relativePath, lineCount, ...classify(source) })
}

const counts = rows.reduce(
  (summary, row) => {
    summary[row.category] += 1
    return summary
  },
  { feature: 0, composition: 0, 'direct-io': 0 },
)

console.log('Inventario de límites de rutas administrativas')
console.log(`Rutas: ${rows.length} · feature: ${counts.feature} · composición: ${counts.composition} · I/O directo: ${counts['direct-io']}`)

for (const row of rows) {
  const detail = row.directIo.length > 0 ? ` · ${row.directIo.join(', ')}` : ''
  console.log(`[${row.category}] ${row.path} · ${row.lineCount} líneas${detail}`)
}

if (strict && counts['direct-io'] > 0) {
  console.error(`La auditoría estricta detectó ${counts['direct-io']} ruta(s) con I/O directo.`)
  process.exitCode = 1
}
