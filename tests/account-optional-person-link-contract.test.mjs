import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('account completion never requires an ecclesial person link', async () => {
  const source = await read('src/features/account/AccountHomePage.tsx')

  const completionFunction = source.match(/function calculateProfileCompletion[\s\S]*?\n}\n/)?.[0] ?? ''

  assert.match(completionFunction, /profile\.email/)
  assert.match(completionFunction, /profile\.full_name/)
  assert.match(completionFunction, /profile\.preferred_locale/)
  assert.match(completionFunction, /profile\.timezone/)
  assert.doesNotMatch(completionFunction, /person_id/)
  assert.doesNotMatch(source, /Falta vincular una ficha eclesial/)
})

test('person linkage is shown only when it actually exists', async () => {
  const source = await read('src/features/account/AccountHomePage.tsx')

  assert.match(source, /profile\.person_id \? <p/)
  assert.match(source, /vinculación personal verificada/)
  assert.doesNotMatch(source, /Sin vincular/)
})

test('optional profile enrichment is separate from required completion', async () => {
  const [source, styles] = await Promise.all([
    read('src/features/account/AccountHomePage.tsx'),
    read('src/features/account/account-dashboard.module.css'),
  ])

  assert.match(source, /Mejoras opcionales/)
  assert.match(source, /Agregar un teléfono de contacto/)
  assert.match(source, /Agregar una fotografía/)
  assert.match(styles, /\.profileSuggestions\{/)
  assert.match(styles, /\.progressTrack\{/)
})
