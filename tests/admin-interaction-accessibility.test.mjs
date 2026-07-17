import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const searchableSelect = await readFile('src/components/admin/SearchableSelect.tsx', 'utf8')
const wizardProgress = await readFile('src/components/admin/AdminWizardProgress.tsx', 'utf8')

test('searchable select keeps a single keyboard focus model', () => {
  assert.match(searchableSelect, /role="combobox"/)
  assert.match(searchableSelect, /aria-activedescendant=/)
  assert.match(searchableSelect, /aria-haspopup="listbox"/)
  assert.match(searchableSelect, /role="option"/)
  assert.match(searchableSelect, /tabIndex=\{-1\}/)
  assert.match(searchableSelect, /role="status"/)
  assert.match(searchableSelect, /aria-describedby=/)
})

test('wizard progress announces the active step and exposes navigable steps', () => {
  assert.match(wizardProgress, /aria-live="polite"/)
  assert.match(wizardProgress, /role="progressbar"/)
  assert.match(wizardProgress, /aria-valuetext=/)
  assert.match(wizardProgress, /aria-current=\{isCurrent \? 'step' : undefined\}/)
  assert.match(wizardProgress, /aria-label=\{`Ir al paso \$\{index \+ 1\}: \$\{step\.label\}`\}/)
})
