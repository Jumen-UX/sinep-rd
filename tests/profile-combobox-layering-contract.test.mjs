import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const componentPath = 'src/features/account/ProfileCombobox.tsx'
const cssPath = 'src/features/account/profile-combobox.module.css'

test('profile combobox restores focus and keeps the active popover above adjacent sections', async () => {
  const [component, css] = await Promise.all([readFile(componentPath, 'utf8'), readFile(cssPath, 'utf8')])
  assert.match(component, /triggerRef/)
  assert.match(component, /closeAndRestoreFocus/)
  assert.match(component, /scrollIntoView\(\{ block: 'nearest' \}\)/)
  assert.match(component, /styles\.rootOpen/)
  assert.match(component, /data-searchable=\{searchable\}/)
  assert.match(css, /\.rootOpen\{z-index:140!important\}/)
  assert.match(css, /\.popover\{[^}]*z-index:150!important/s)
  assert.match(css, /\.popover\[data-searchable='false'\]/)
  assert.match(css, /max-height:210px!important/)
  assert.match(css, /@media\(max-width:700px\)/)
})
