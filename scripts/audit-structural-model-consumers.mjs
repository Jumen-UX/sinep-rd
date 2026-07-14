import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'

const roots = ['src']
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs'])
const modelPatterns = {
  ecclesiastical_entities: /\becclesiastical_entities\b|\bpublic_ecclesiastical_entities\b|\bpublic_dioceses\b|\bpublic_parishes\b/g,
  structure_nodes: /\bstructure_nodes\b|\bstructure_node_edges\b|\bget_structure_tree\b|\bget_entity_descendants\b/g,
  organization_units: /\borganization_units\b|\bpublic_organization_units\b|\borganization_unit_id\b/g,
  organization_charts: /\borganization_charts\b|\borganization_chart_id\b/g,
}

function classifyPurpose(path) {
  if (path.includes('/public/') || path.includes('(public)') || path.includes('Public')) return 'presentación pública'
  if (path.includes('scope') || path.includes('permission') || path.includes('/users/') || path.includes('/usuarios/')) return 'permiso/alcance'
  if (path.includes('appointment') || path.includes('assignment') || path.includes('office')) return 'nombramiento/cargo'
  if (path.includes('event')) return 'evento'
  if (path.includes('organization') || path.includes('organizacion') || path.includes('organigram')) return 'organizativo'
  if (path.includes('structure') || path.includes('estructura') || path.includes('hierarchy')) return 'territorial'
  if (path.includes('entit') || path.includes('jurisdiction') || path.includes('parish') || path.includes('chapel')) return 'institucional'
  return 'transversal'
}

function sourceProjection(model) {
  if (model === 'ecclesiastical_entities') return ['identidad institucional', 'fuente']
  if (model === 'structure_nodes') return ['jerarquía territorial', 'fuente']
  if (model === 'organization_units' || model === 'organization_charts') return ['organización interna', 'fuente']
  return ['sin clasificar', 'ambiguo']
}

const rows = []

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

    const content = await readFile(path, 'utf8')
    const repoPath = relative(process.cwd(), path).replaceAll('\\', '/')
    for (const [model, pattern] of Object.entries(modelPatterns)) {
      pattern.lastIndex = 0
      const matches = content.match(pattern)
      if (!matches?.length) continue
      const [canonicalPurpose, role] = sourceProjection(model)
      rows.push({
        file: repoPath,
        model,
        purpose: classifyPurpose(repoPath),
        canonicalPurpose,
        role,
        references: matches.length,
      })
    }
  }
}

for (const root of roots) await walk(root)
rows.sort((a, b) => a.file.localeCompare(b.file) || a.model.localeCompare(b.model))

const ambiguous = rows.filter((row) => row.role === 'ambiguo')
const grouped = Object.keys(modelPatterns).map((model) => ({
  model,
  consumers: rows.filter((row) => row.model === model).length,
  references: rows.filter((row) => row.model === model).reduce((sum, row) => sum + row.references, 0),
}))

console.log('Inventario de consumidores de modelos estructurales')
console.table(grouped)
console.table(rows)
console.log(`Consumidores inventariados: ${rows.length}`)
console.log(`Consumidores con modelo fuente ambiguo: ${ambiguous.length}`)

if (process.argv.includes('--strict') && ambiguous.length > 0) process.exit(1)
