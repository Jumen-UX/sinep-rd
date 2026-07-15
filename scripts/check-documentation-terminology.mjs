import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const docsRoot = path.join(root, 'docs')
const strict = process.argv.includes('--strict')
const forbidden = [
  { pattern: /legacy_pastoral_structure/gi, replacement: 'organization_units' },
  { pattern: /legacy_diocese_structure/gi, replacement: 'structure_nodes / ecclesiastical_entities' },
  { pattern: /personas\.person_type/gi, replacement: 'estado eclesial canónico derivado' },
]

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(absolute))
    else if (entry.name.endsWith('.md')) files.push(absolute)
  }
  return files
}

const findings = []
for (const file of await walk(docsRoot)) {
  const relative = path.relative(root, file).split(path.sep).join('/')
  if (relative.startsWith('docs/archive/')) continue
  const content = await readFile(file, 'utf8')
  for (const rule of forbidden) {
    const matches = [...content.matchAll(rule.pattern)]
    if (matches.length > 0) findings.push(`${relative}: ${matches.length} referencia(s); usar ${rule.replacement}.`)
  }
}

for (const finding of findings) console.warn(`⚠ ${finding}`)
if (strict && findings.length > 0) process.exit(1)
console.log(`Terminología documental revisada: ${findings.length} advertencia(s).`)
