import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function source(relativePath) {
  return readFile(new URL(relativePath, repoRoot), 'utf8')
}

test('global web standards expose focus for semantic and custom controls', async () => {
  const styles = await source('src/app/web-standards.css')

  assert.match(styles, /summary, \[tabindex\]\):focus-visible/)
  assert.match(styles, /\.clickable-table-row[\s\S]*:focus-within/)
  assert.match(styles, /border-color:\s*var\(--gold\)\s*!important/)
  assert.match(styles, /box-shadow:\s*var\(--focus-ring\)\s*!important/)
  assert.match(styles, /@media \(pointer: coarse\)[\s\S]*min-height:\s*44px/s)
})

test('public combobox replaces removed native outline with visible keyboard states', async () => {
  const styles = await source('src/app/public-combobox.css')

  assert.match(styles, /\.public-combobox-input:focus-visible[\s\S]*box-shadow:\s*var\(--focus-ring\)/s)
  assert.match(styles, /\.public-combobox-option:focus-visible/)
  assert.match(styles, /\.public-combobox-toggle:focus-visible/)
  assert.match(styles, /min-height:\s*44px/)
  assert.doesNotMatch(styles, /\.public-combobox-option[^}]*outline:\s*none/s)
})
