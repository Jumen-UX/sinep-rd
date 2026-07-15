import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const manifest = JSON.parse(await readFile('docs/DOCUMENTATION_MANIFEST.json', 'utf8'))
const base = process.env.DOCS_AFFECTED_BASE ?? 'HEAD^'
const result = spawnSync('git', ['diff', '--name-only', base, 'HEAD'], { encoding: 'utf8' })

if (result.status !== 0) {
  console.warn('⚠ No se pudo calcular el diff; se omite el reporte documental afectado.')
  process.exit(0)
}

const changed = result.stdout.split(/\r?\n/).filter(Boolean)
const rules = [
  { pattern: /^(?:package\.json|pnpm-lock\.yaml|\.nvmrc)/, docs: ['docs/operations/AUTOMATIZACION_DOCUMENTAL.md'], reason: 'stack, scripts o dependencias' },
  { pattern: /^\.github\/workflows\//, docs: ['docs/operations/AUTOMATIZACION_DOCUMENTAL.md'], reason: 'CI y operación' },
  { pattern: /^supabase\/migrations\//, docs: ['docs/architecture/', 'docs/operations/'], reason: 'esquema, permisos o contratos de datos' },
  { pattern: /^src\/features\/(?:clero|personas|vida-consagrada)\//, docs: [manifest.canonical_documents?.active_sprint], reason: 'flujos de personas y nombramientos' },
  { pattern: /^src\/features\/(?:appointments|structures|estructuras|organizacion)\//, docs: [manifest.canonical_documents?.active_sprint], reason: 'estructuras, cargos u organización' },
  { pattern: /^e2e\//, docs: ['docs/testing/'], reason: 'pruebas E2E' },
]

const findings = new Map()
for (const file of changed) {
  for (const rule of rules) {
    if (!rule.pattern.test(file)) continue
    for (const doc of rule.docs.filter(Boolean)) {
      const current = findings.get(doc) ?? new Set()
      current.add(`${file} (${rule.reason})`)
      findings.set(doc, current)
    }
  }
}

if (findings.size === 0) {
  console.log('No se detectaron documentos potencialmente afectados.')
  process.exit(0)
}

console.log('Documentación potencialmente afectada:')
for (const [doc, sources] of findings) {
  console.log(`- ${doc}`)
  for (const source of sources) console.log(`  · ${source}`)
}
