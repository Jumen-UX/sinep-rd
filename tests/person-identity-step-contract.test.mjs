import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const componentPath = 'src/features/personas/shared/components/PersonIdentityStep.tsx'

test('shared person identity step requires an explicit existing or new choice', async () => {
  const source = await readFile(componentPath, 'utf8')

  assert.match(source, /export type PersonIdentityMode = 'existing' \| 'new'/)
  assert.match(source, /aria-pressed=\{mode === 'existing'\}/)
  assert.match(source, /aria-pressed=\{mode === 'new'\}/)
  assert.match(source, /onSelectedPersonChange\(''\)/)
  assert.match(source, /Busca y reutiliza una ficha existente antes de crear una identidad nueva/)
})

test('shared person identity step exposes an accessible person selector', async () => {
  const source = await readFile(componentPath, 'utf8')

  assert.match(source, /aria-labelledby="person-identity-step-title"/)
  assert.match(source, /role="group"/)
  assert.match(source, /aria-label="Origen de la identidad"/)
  assert.match(source, /aria-live="polite"/)
  assert.match(source, /people\.map/)
})
