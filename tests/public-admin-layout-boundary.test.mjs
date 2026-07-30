import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('root layout stays infrastructure-only while route groups own their shells', async () => {
  const [rootLayout, publicLayout, adminLayout, accessibilityTools] = await Promise.all([
    readRepoFile('src/app/layout.tsx'),
    readRepoFile('src/app/(public)/layout.tsx'),
    readRepoFile('src/app/(admin)/layout.tsx'),
    readRepoFile('src/components/accessibility/AccessibilityTools.tsx'),
  ])

  assert.match(rootLayout, /<a className="skip-link" href="#contenido-principal">/)
  assert.match(rootLayout, /\{children\}/)
  assert.doesNotMatch(rootLayout, /next\/link|ThemeControl|site-shell|site-header|site-footer/)
  assert.doesNotMatch(rootLayout, /id="contenido-principal"/)

  assert.match(publicLayout, /from 'next\/link'/)
  assert.match(publicLayout, /className="site-shell"/)
  assert.match(publicLayout, /className="site-header"/)
  assert.match(publicLayout, /className="site-footer"/)
  assert.match(publicLayout, /id="contenido-principal"/)
  assert.doesNotMatch(publicLayout, /ThemeControl/)

  assert.match(adminLayout, /id="contenido-principal"/)
  assert.doesNotMatch(adminLayout, /next\/link|ThemeControl|site-shell|site-header|site-footer/)
  assert.match(accessibilityTools, /useThemePreference\(\)/)

  assert.equal((publicLayout.match(/id="contenido-principal"/g) ?? []).length, 1)
  assert.equal((adminLayout.match(/id="contenido-principal"/g) ?? []).length, 1)
})
