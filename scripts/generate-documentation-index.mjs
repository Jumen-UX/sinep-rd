import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const docsRoot = path.join(root, 'docs')
const outputPath = path.join(docsRoot, 'INDEX.generated.md')
const checkOnly = process.argv.includes('--check')

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(absolute))
    else if (entry.name.endsWith('.md') && absolute !== outputPath) files.push(absolute)
  }
  return files
}

function relative(file) {
  return path.relative(docsRoot, file).split(path.sep).join('/')
}

function titleOf(content, file) {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? path.basename(file, '.md')
}

function statusOf(content, file) {
  if (relative(file).startsWith('archive/')) return 'archivado'
  return content.match(/^>\s*Estado:\s*(.+)$/im)?.[1]?.trim() ?? 'sin clasificar'
}

const rows = []
for (const file of await walk(docsRoot)) {
  const content = await readFile(file, 'utf8')
  const rel = relative(file)
  rows.push({
    section: rel.includes('/') ? rel.split('/')[0] : 'raíz',
    title: titleOf(content, file),
    status: statusOf(content, file),
    rel,
  })
}
rows.sort((left, right) => left.section.localeCompare(right.section) || left.title.localeCompare(right.title))

const sections = new Map()
for (const row of rows) {
  const group = sections.get(row.section) ?? []
  group.push(row)
  sections.set(row.section, group)
}

const lines = [
  '# Índice documental generado',
  '',
  '> Estado: generado',
  '',
  '> Generado automáticamente por `pnpm docs:index`. No editar manualmente.',
  '',
]
for (const [section, documents] of sections) {
  lines.push(`## ${section}`, '')
  for (const document of documents) {
    lines.push(`- [${document.title}](./${document.rel}) — ${document.status}`)
  }
  lines.push('')
}
const generated = `${lines.join('\n').trim()}\n`

if (checkOnly) {
  let current = ''
  try {
    current = await readFile(outputPath, 'utf8')
  } catch {
    console.error('Falta docs/INDEX.generated.md. Ejecuta pnpm docs:index.')
    process.exit(1)
  }
  if (current !== generated) {
    console.error('El índice documental está desactualizado. Ejecuta pnpm docs:index.')
    process.exit(1)
  }
  console.log(`Índice documental actualizado: ${rows.length} documentos.`)
} else {
  await writeFile(outputPath, generated)
  console.log(`Índice documental generado con ${rows.length} documentos.`)
}
