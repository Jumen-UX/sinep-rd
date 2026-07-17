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

test('remaining embedded administrative styles are neutralized by a scoped structural guard', async () => {
  const layout = await source('src/app/(admin)/layout.tsx')
  const compatibilityIndex = layout.indexOf("import '@/styles/admin-theme-compatibility.css'")
  const cleanupIndex = layout.indexOf("import '@/styles/admin-embedded-theme-cleanup.css'")
  const cleanup = await source('src/styles/admin-embedded-theme-cleanup.css')

  assert.ok(compatibilityIndex >= 0)
  assert.ok(cleanupIndex > compatibilityIndex)
  assert.match(cleanup, /\.level-office-page\s+:is\(input, select, textarea\)\s*\{[^}]*background:\s*var\(--surface\)\s*!important/s)
  assert.match(cleanup, /\.level-office-row/)
  assert.match(cleanup, /\.level-office-summary/)
  assert.match(cleanup, /\.structure-selector-path/)
  assert.match(cleanup, /\.structure-selector select\s*\{[^}]*background:\s*var\(--surface\)\s*!important/s)
  assert.doesNotMatch(cleanup, /\.events-page|\.event-assistant-page|\.pending-events-page|\.mini-badge/)
})
