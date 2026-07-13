import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const editorPath = new URL('../src/features/importaciones/admin/ImportRowFieldEditor.tsx', import.meta.url)
const stylesPath = new URL('../src/app/globals.css', import.meta.url)

test('reference editor distinguishes canonical provisional loading and error states', async () => {
  const editor = await readFile(editorPath, 'utf8')
  const styles = await readFile(stylesPath, 'utf8')

  assert.match(editor, /data-reference-state=\{referenceState\}/)
  assert.match(editor, /selectedCanonicalOption/)
  assert.match(editor, /Referencia canónica seleccionada/)
  assert.match(editor, /Referencia textual provisional/)
  assert.match(editor, /Cargando opciones disponibles/)
  assert.match(editor, /Reintentar catálogo/)
  assert.match(editor, /setRetryToken\(\(current\) => current \+ 1\)/)
  assert.match(editor, /aria-live="polite"/)

  assert.match(styles, /data-reference-state="canonical"/)
  assert.match(styles, /data-reference-state="provisional"/)
  assert.match(styles, /data-reference-state="error"/)
})
