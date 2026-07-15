import { readFile, readdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const repoRoot = process.cwd()
const testsDirectory = path.join(repoRoot, 'tests')

function gitChangedFiles() {
  const result = spawnSync('git', ['diff', '--name-only', 'HEAD^', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })

  if (result.status !== 0) return []
  return result.stdout.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)
}

const explicitFiles = process.argv.slice(2).filter(Boolean)
const changedFiles = explicitFiles.length > 0 ? explicitFiles : gitChangedFiles()

if (changedFiles.length === 0) {
  console.log('No se detectaron archivos modificados; se ejecutará la suite unitaria completa.')
  const result = spawnSync('pnpm', ['test'], { cwd: repoRoot, stdio: 'inherit', env: process.env })
  process.exit(result.status ?? 1)
}

const discoveredTests = (await readdir(testsDirectory))
  .filter((file) => file.endsWith('.test.mjs'))
  .sort()

const changedTestFiles = new Set(
  changedFiles
    .filter((file) => file.startsWith('tests/') && file.endsWith('.test.mjs'))
    .map((file) => path.basename(file)),
)

const sourceFiles = changedFiles.filter((file) => !file.startsWith('tests/'))
const sourceNeedles = new Set(
  sourceFiles.flatMap((file) => [
    file,
    path.basename(file),
    file.replace(/^src\//, ''),
  ]),
)

const selectedTests = []
for (const testFile of discoveredTests) {
  if (changedTestFiles.has(testFile)) {
    selectedTests.push(testFile)
    continue
  }

  const content = await readFile(path.join(testsDirectory, testFile), 'utf8')
  if ([...sourceNeedles].some((needle) => needle && content.includes(needle))) {
    selectedTests.push(testFile)
  }
}

if (selectedTests.length === 0) {
  console.log('No se localizaron contratos relacionados; se ejecutará la suite unitaria completa por seguridad.')
  const result = spawnSync('pnpm', ['test'], { cwd: repoRoot, stdio: 'inherit', env: process.env })
  process.exit(result.status ?? 1)
}

console.log(`Archivos modificados: ${changedFiles.length}`)
console.log(`Pruebas afectadas: ${selectedTests.length}`)
for (const testFile of selectedTests) console.log(`- tests/${testFile}`)

const result = spawnSync(
  process.execPath,
  ['--test', ...selectedTests.map((file) => path.join('tests', file))],
  { cwd: repoRoot, stdio: 'inherit', env: process.env },
)

process.exit(result.status ?? 1)
