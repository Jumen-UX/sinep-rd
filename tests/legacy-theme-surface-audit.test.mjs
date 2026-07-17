import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function source(relativePath) {
  return readFile(new URL(relativePath, repoRoot), 'utf8')
}

const migratedFiles = [
  'src/app/home.css',
  'src/app/hierarchy.css',
  'src/app/web-standards.css',
  'src/app/public-combobox.css',
  'src/app/scope-back-controls.css',
]

test('migrated public layers no longer contain fixed light surfaces', async () => {
  for (const file of migratedFiles) {
    const styles = await source(file)
    assert.doesNotMatch(
      styles,
      /background\s*:\s*(?:#fff(?:fff)?|#fbf8f1|#f7fbff|white)\b/i,
      `${file} todavía contiene una superficie clara fija.`,
    )
  }
})

test('intentional print white remains isolated to print rules', async () => {
  const styles = await source('src/app/public-territorial.css')
  const printIndex = styles.indexOf('@media print')
  assert.ok(printIndex >= 0)
  assert.doesNotMatch(styles.slice(0, printIndex), /background\s*:\s*#fff(?:fff)?/i)
  assert.match(styles.slice(printIndex), /background:\s*#ffffff\s*!important/)
})

test('administrative structural surfaces are canonical and no longer need a final guard', async () => {
  const layout = await source('src/app/(admin)/layout.tsx')
  const structureIndex = layout.indexOf("import '@/styles/admin-structure-workflows.css'")
  const compatibilityIndex = layout.indexOf("import '@/styles/admin-theme-compatibility.css'")
  const styles = await source('src/styles/admin-structure-workflows.css')

  assert.ok(structureIndex >= 0)
  assert.ok(compatibilityIndex > structureIndex)
  assert.doesNotMatch(layout, /admin-embedded-theme-cleanup\.css/)
  assert.match(styles, /\.level-office-page select/)
  assert.match(styles, /\.level-office-row/)
  assert.match(styles, /\.level-office-summary/)
  assert.match(styles, /\.structure-selector-path/)
  assert.match(styles, /\.structure-selector select/)
  assert.match(styles, /background:\s*var\(--surface\)/)
  assert.match(styles, /background:\s*var\(--surface-subtle\)/)
  assert.doesNotMatch(styles, /!important/)
  assert.doesNotMatch(styles, /background\s*:\s*(?:#fff(?:fff)?|#fbf8f1|white)\b/i)
})
