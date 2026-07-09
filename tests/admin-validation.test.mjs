import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

async function importValidationModule() {
  const source = await readFile(new URL('../src/lib/admin/validation.ts', import.meta.url), 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  })
  const encoded = Buffer.from(transpiled.outputText, 'utf8').toString('base64')
  return import(`data:text/javascript;base64,${encoded}`)
}

const validation = await importValidationModule()

test('requiredEmail trims and normalizes valid email', () => {
  assert.equal(validation.requiredEmail('  PERSONA@EXAMPLE.ORG  '), 'persona@example.org')
})

test('requiredEmail rejects invalid email', () => {
  assert.throws(() => validation.requiredEmail('sin-arroba'), validation.ValidationError)
})

test('oneOf returns allowed values and rejects unknown values', () => {
  const allowed = ['persons', 'ecclesiastical_entities']
  assert.equal(validation.oneOf('persons', allowed, 'tabla'), 'persons')
  assert.throws(() => validation.oneOf('profiles', allowed, 'tabla'), /tabla no permitido/)
})

test('requiredUuid accepts canonical UUID and rejects malformed IDs', () => {
  const id = '7a3fc7d0-0d51-4d3d-a1a3-0f83d4f09f11'
  assert.equal(validation.requiredUuid(id), id)
  assert.throws(() => validation.requiredUuid('not-a-uuid'), validation.ValidationError)
})

test('optionalUrl accepts http URLs and rejects unsafe protocols', () => {
  assert.equal(validation.optionalUrl('https://example.org/fuente'), 'https://example.org/fuente')
  assert.equal(validation.optionalUrl(''), '')
  assert.throws(() => validation.optionalUrl('javascript:alert(1)'), validation.ValidationError)
})
