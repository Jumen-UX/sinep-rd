import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const reflow = await readFile('src/styles/reflow-accessibility.css', 'utf8')
const layout = await readFile('src/app/layout.tsx', 'utf8')

test('global layout loads reflow safeguards after interface styles', () => {
  const accessibilityIndex = layout.indexOf("../styles/accessibility-tools.css")
  const reflowIndex = layout.indexOf("../styles/reflow-accessibility.css")

  assert.ok(accessibilityIndex >= 0)
  assert.ok(reflowIndex > accessibilityIndex)
})

test('reflow policy removes accidental minimum widths and wraps long content', () => {
  assert.match(reflow, /min-width:\s*0/)
  assert.match(reflow, /overflow-wrap:\s*anywhere/)
  assert.match(reflow, /max-width:\s*100%/)
  assert.match(reflow, /overscroll-behavior-inline:\s*contain/)
})

test('tables retain local scrolling while zoomed controls stack', () => {
  assert.match(reflow, /\.table-wrap/)
  assert.match(reflow, /overflow-x:\s*auto/)
  assert.match(reflow, /html\[data-text-scale='large'\]/)
  assert.match(reflow, /html\[data-text-scale='xlarge'\]/)
  assert.match(reflow, /grid-template-columns:\s*1fr\s*!important/)
  assert.match(reflow, /flex-direction:\s*column/)
})
