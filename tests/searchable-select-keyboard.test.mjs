import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const componentPath = new URL('../src/components/admin/SearchableSelect.tsx', import.meta.url)
const stylesPath = new URL('../src/app/globals.css', import.meta.url)

test('searchable select exposes active option semantics and complete keyboard navigation', async () => {
  const component = await readFile(componentPath, 'utf8')
  const styles = await readFile(stylesPath, 'utf8')

  assert.match(component, /aria-activedescendant=\{activeOptionId\}/)
  assert.match(component, /event\.key === 'ArrowDown'/)
  assert.match(component, /event\.key === 'ArrowUp'/)
  assert.match(component, /event\.key === 'Home'/)
  assert.match(component, /event\.key === 'End'/)
  assert.match(component, /event\.key === 'Escape'/)
  assert.match(component, /event\.key === 'Tab'/)
  assert.match(component, /selectOption\(activeOption\)/)
  assert.match(component, /className=\{index === activeIndex \? 'is-active' : undefined\}/)
  assert.match(component, /onMouseEnter=\{\(\) => setActiveIndex\(index\)\}/)
  assert.match(styles, /button\.is-active/)
  assert.match(styles, /box-shadow: inset 3px 0 0 var\(--gold\)/)
})
