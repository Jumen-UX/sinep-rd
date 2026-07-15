import { access, readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const docsRoot = path.join(root, 'docs')
const testsRoot = path.join(root, 'tests')
const manifestPath = path.join(docsRoot, 'DOCUMENTATION_MANIFEST.json')

async function walk(directory, predicate = () => true) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(absolute, predicate))
    else if (predicate(absolute)) files.push(absolute)
  }
  return files
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join('/')
}

async function exists(target) {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

function markdownTargets(content) {
  const targets = []
  const pattern = /!?(?:\[[^\]]*\])\(([^)]+)\)/g
  for (const match of content.matchAll(pattern)) {
    const raw = match[1].trim().replace(/^<|>$/g, '')
    if (!raw || raw.startsWith('#') || /^(?:https?:|mailto:|tel:|data:)/i.test(raw)) continue
    targets.push(raw)
  }
  return targets
}

function normalizedStem(file) {
  return path.basename(file, '.md')
    .toLowerCase()
    .replace(/(?:^|[-_ ])(?:v|version|final|old|nuevo|actualizado)\d*$/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

const errors = []
const warnings = []
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const markdownFiles = await walk(docsRoot, (file) => file.endsWith('.md'))
const testFiles = await walk(testsRoot, (file) => file.endsWith('.mjs') || file.endsWith('.ts'))
const documentContents = new Map()

for (const file of markdownFiles) {
  documentContents.set(file, await readFile(file, 'utf8'))
}

for (const [name, documentPath] of Object.entries(manifest.canonical_documents ?? {})) {
  const absolute = path.join(root, documentPath)
  if (!await exists(absolute)) errors.push(`Documento canónico inexistente (${name}): ${documentPath}`)
}

for (const [file, content] of documentContents) {
  for (const target of markdownTargets(content)) {
    const clean = target.split('#')[0].split('?')[0]
    if (!clean) continue
    const absolute = path.resolve(path.dirname(file), decodeURIComponent(clean))
    if (!await exists(absolute)) errors.push(`Enlace interno roto en ${relative(file)}: ${target}`)
  }
}

for (const file of testFiles) {
  const content = await readFile(file, 'utf8')
  const referenced = new Set(content.match(/docs\/[A-Za-z0-9_./() áéíóúÁÉÍÓÚñÑ-]+\.md/g) ?? [])
  for (const documentPath of referenced) {
    if (!await exists(path.join(root, documentPath))) {
      errors.push(`Prueba con ruta documental inexistente en ${relative(file)}: ${documentPath}`)
    }
  }
}

const activeSprints = []
for (const [file, content] of documentContents) {
  if (/^>\s*Estado:\s*activo\s*$/im.test(content) && /docs\/sprints\//.test(relative(file))) {
    activeSprints.push(relative(file))
  }
}
if (manifest.policies?.single_active_sprint && activeSprints.length !== 1) {
  errors.push(`Debe existir exactamente un sprint activo; encontrados: ${activeSprints.length} (${activeSprints.join(', ') || 'ninguno'})`)
}
const canonicalSprint = manifest.canonical_documents?.active_sprint
if (canonicalSprint && activeSprints.length === 1 && activeSprints[0] !== canonicalSprint) {
  errors.push(`El sprint activo real (${activeSprints[0]}) no coincide con el manifiesto (${canonicalSprint}).`)
}

for (const [file, content] of documentContents) {
  const rel = relative(file)
  if (rel.startsWith(manifest.metadata?.archive_prefix ?? 'docs/archive/')) continue
  if (!/^>\s*Estado:/im.test(content)) warnings.push(`Documento sin metadata de estado: ${rel}`)
}

const duplicateGroups = new Map()
for (const file of markdownFiles) {
  const key = normalizedStem(file)
  if (!key || key === 'readme' || key === 'index') continue
  const group = duplicateGroups.get(key) ?? []
  group.push(relative(file))
  duplicateGroups.set(key, group)
}
for (const group of duplicateGroups.values()) {
  if (group.length > 1) warnings.push(`Posibles documentos duplicados: ${group.join(' | ')}`)
}

const referencedDocs = new Set(Object.values(manifest.canonical_documents ?? {}))
for (const [file, content] of documentContents) {
  for (const target of markdownTargets(content)) {
    const clean = target.split('#')[0].split('?')[0]
    if (!clean) continue
    const absolute = path.resolve(path.dirname(file), decodeURIComponent(clean))
    if (absolute.endsWith('.md')) referencedDocs.add(relative(absolute))
  }
}
for (const file of markdownFiles) {
  const rel = relative(file)
  if (rel.startsWith(manifest.metadata?.archive_prefix ?? 'docs/archive/')) continue
  if (path.basename(file).toLowerCase().startsWith('readme')) continue
  if (!referencedDocs.has(rel)) warnings.push(`Documento posiblemente huérfano: ${rel}`)
}

for (const warning of warnings) console.warn(`⚠ ${warning}`)
if (errors.length > 0) {
  for (const error of errors) console.error(`✖ ${error}`)
  process.exit(1)
}

console.log(`Documentación válida: ${markdownFiles.length} archivos Markdown, ${warnings.length} advertencia(s).`)
