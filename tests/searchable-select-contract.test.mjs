import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const searchableSelect = await readFile('src/components/admin/SearchableSelect.tsx', 'utf8')
const fieldContract = await readFile('src/features/importaciones/domain/import-row-field-contract.ts', 'utf8')
const fieldEditor = await readFile('src/features/importaciones/admin/ImportRowFieldEditor.tsx', 'utf8')

test('searchable select exposes an accessible combobox contract', () => {
  assert.match(searchableSelect, /role="combobox"/)
  assert.match(searchableSelect, /aria-autocomplete="list"/)
  assert.match(searchableSelect, /aria-controls=/)
  assert.match(searchableSelect, /aria-describedby=/)
  assert.match(searchableSelect, /aria-expanded=/)
  assert.match(searchableSelect, /aria-haspopup="listbox"/)
  assert.match(searchableSelect, /role="listbox"/)
  assert.match(searchableSelect, /role="option"/)
  assert.match(searchableSelect, /aria-activedescendant=/)
  assert.match(searchableSelect, /tabIndex=\{-1\}/)
  assert.match(searchableSelect, /role="status"/)
  assert.match(searchableSelect, /id=\{helpId\}/)
  assert.match(searchableSelect, /Escape/)
})

test('canonical import references use the searchable reference field kind', () => {
  assert.match(fieldContract, /ImportReferenceType/)
  assert.match(fieldContract, /kind: 'reference'/)
  assert.match(fieldContract, /referenceType: 'person'/)
  assert.match(fieldContract, /referenceType: 'entity'/)
  assert.match(fieldContract, /referenceType: 'office'/)
  assert.match(fieldContract, /referenceType: 'event_type'/)
  assert.match(fieldEditor, /SearchableSelect/)
  assert.match(fieldEditor, /allowCustomValue/)
})
