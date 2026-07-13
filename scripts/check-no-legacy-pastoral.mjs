import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const roots = ['src', 'tests']
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs'])
const forbiddenPatterns = [
  /pastoral_entity/i,
  /PastoralEntity/,
  /pastoralEntities/,
  /public_pastoral_entities/i,
]
const findings = []

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      await walk(absolute)
      continue
    }

    if (!extensions.has(path.extname(entry.name))) continue

    const content = await readFile(absolute, 'utf8')
    content.split(/\r?\n/).forEach((line, index) => {
      if (forbiddenPatterns.some((pattern) => pattern.test(line))) {
        findings.push(`${absolute}:${index + 1}: ${line.trim()}`)
      }
    })
  }
}

for (const root of roots) {
  await walk(root)
}

if (findings.length > 0) {
  console.error('Se encontraron referencias al modelo organizativo eliminado:')
  findings.forEach((finding) => console.error(`- ${finding}`))
  process.exit(1)
}

console.log('No se encontraron referencias al modelo organizativo eliminado.')
