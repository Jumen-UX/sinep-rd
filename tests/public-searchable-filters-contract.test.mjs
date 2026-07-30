import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('territorial filters remain searchable and keyboard accessible', async () => {
  const [component, explorer, styles] = await Promise.all([
    read('src/features/public/PublicSearchableSelect.tsx'),
    read('src/features/public/PublicDashboardExplorer.tsx'),
    read('src/app/public-combobox.css'),
  ])

  assert.match(component, /role="combobox"/)
  assert.match(component, /role="listbox"/)
  assert.match(component, /role="option"/)
  assert.match(component, /aria-autocomplete="list"/)
  assert.match(component, /aria-activedescendant=/)
  assert.match(component, /event\.key === 'ArrowDown'/)
  assert.match(component, /event\.key === 'ArrowUp'/)
  assert.match(component, /event\.key === 'Enter'/)
  assert.match(component, /event\.key === 'Escape'/)
  assert.match(component, /normalize\('NFD'\)/)
  assert.match(component, /Sin resultados/)
  assert.match(component, /disabled=\{disabled\}/)

  assert.match(explorer, /label="País"/)
  assert.match(explorer, /label="Provincia eclesiástica"/)
  assert.match(explorer, /label="Jurisdicción"/)
  assert.match(explorer, /placeholder="Buscar país"/)
  assert.match(explorer, /placeholder=\{country \? 'Buscar provincia'/)
  assert.match(explorer, /placeholder="Buscar jurisdicción"/)
  assert.match(explorer, /\{ value: '', label: 'Todos los países' \}/)
  assert.match(explorer, /disabled=\{!country\}/)
  assert.match(explorer, /<select value=\{activeView\}/)

  assert.match(styles, /\.public-combobox-input/)
  assert.match(styles, /\.public-combobox-list/)
  assert.match(styles, /max-height: 292px/)
  assert.match(styles, /overflow: auto/)
})
