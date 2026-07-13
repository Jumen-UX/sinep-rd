import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'

const roots = ['src', 'tests']
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'])
const patterns = [/pastoral_entity/i, /pastoralentit/i]
const findings = []

async function walk(directory) {
  let entries

  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return
    throw error
  }

  for (const entry of entries) {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      await walk(path)
      continue
    }

    if (!extensions.has(extname(entry.name))) continue

    const lines = (await readFile(path, 'utf8')).split(/\r?\n/)
    lines.forEach((line, index) => {
      if (patterns.some((pattern) => pattern.test(line))) {
        findings.push(`${relative(process.cwd(), path)}:${index + 1}: ${line.trim()}`)
      }
    })
  }
}

for (const root of roots) await walk(root)

if (findings.length > 0) {
  console.error('Se encontraron referencias al modelo pastoral heredado:')
  findings.forEach((finding) => console.error(`- ${finding}`))
  process.exit(1)
}

console.log('Sin referencias al modelo pastoral heredado en código activo.')
