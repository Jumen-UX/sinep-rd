import { access, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const migrationsRoot = path.join(root, 'supabase', 'migrations')
const strict = process.argv.includes('--strict')

async function exists(target) {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

if (!await exists(migrationsRoot)) {
  console.log('No existe supabase/migrations; auditoría omitida.')
  process.exit(0)
}

const files = (await readdir(migrationsRoot))
  .filter((file) => file.endsWith('.sql'))
  .sort()

const errors = []
const warnings = []
const timestamps = new Map()

for (const file of files) {
  const match = file.match(/^(\d{14})_[a-z0-9_-]+\.sql$/i)
  if (!match) {
    errors.push(`Nombre de migración inválido: ${file}. Debe usar YYYYMMDDHHMMSS_descripcion.sql.`)
    continue
  }

  const group = timestamps.get(match[1]) ?? []
  group.push(file)
  timestamps.set(match[1], group)

  const sql = await readFile(path.join(migrationsRoot, file), 'utf8')
  const normalized = sql.replace(/--.*$/gm, '')

  const securityDefinerFunctions = [...normalized.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([\w."]+)[\s\S]*?security\s+definer[\s\S]*?(?=\n\s*create\s|\n\s*alter\s|\n\s*grant\s|\n\s*revoke\s|$)/gi)]
  for (const functionMatch of securityDefinerFunctions) {
    if (!/set\s+search_path\s*=/i.test(functionMatch[0])) {
      errors.push(`${file}: función SECURITY DEFINER sin SET search_path (${functionMatch[1]}).`)
    }
  }

  if (/grant\s+execute\s+on\s+function[\s\S]{0,250}\s+to\s+(?:anon|public)\b/i.test(normalized)) {
    errors.push(`${file}: ejecución de función concedida a anon/public.`)
  }

  if (/create\s+table[\s\S]*?references\s+[\w."]+/i.test(normalized) && !/create\s+(?:unique\s+)?index/i.test(normalized)) {
    warnings.push(`${file}: contiene claves foráneas y no declara índices en la misma migración; verificar cobertura.`)
  }

  if (/drop\s+(?:table|function|view|type)\b/i.test(normalized) && !/if\s+exists/i.test(normalized)) {
    warnings.push(`${file}: operación DROP sin IF EXISTS; revisar reversibilidad e idempotencia.`)
  }
}

for (const [timestamp, group] of timestamps) {
  if (group.length > 1) errors.push(`Timestamp de migración duplicado ${timestamp}: ${group.join(', ')}`)
}

for (const warning of warnings) console.warn(`⚠ ${warning}`)
if (errors.length > 0) {
  for (const error of errors) console.error(`✖ ${error}`)
  process.exit(1)
}
if (strict && warnings.length > 0) process.exit(1)

console.log(`Migraciones válidas: ${files.length} archivo(s), ${warnings.length} advertencia(s).`)
