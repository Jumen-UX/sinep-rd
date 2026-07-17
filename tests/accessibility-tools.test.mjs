import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function source(relativePath) {
  return readFile(new URL(relativePath, repoRoot), 'utf8')
}

test('root layout bootstraps and mounts the shared accessibility tools', async () => {
  const layout = await source('src/app/layout.tsx')

  assert.match(layout, /import \{ AccessibilityTools \}/)
  assert.match(layout, /import '\.\.\/styles\/accessibility-tools\.css'/)
  assert.match(layout, /id="accessibility-bootstrap" strategy="beforeInteractive"/)
  assert.match(layout, /localStorage\.getItem\('sinep-accessibility'\)/)
  assert.match(layout, /root\.dataset\.textScale/)
  assert.match(layout, /root\.dataset\.contrast = 'high'/)
  assert.match(layout, /root\.dataset\.reduceMotion = 'true'/)
  assert.match(layout, /root\.dataset\.underlineLinks = 'true'/)
  assert.match(layout, /<AccessibilityTools \/>/)
})

test('floating tools expose persistent keyboard-operable preferences', async () => {
  const component = await source('src/components/accessibility/AccessibilityTools.tsx')

  assert.match(component, /const ACCESSIBILITY_STORAGE_KEY = 'sinep-accessibility'/)
  assert.match(component, /type TextScale = 'default' \| 'large' \| 'xlarge'/)
  assert.match(component, /role="dialog"/)
  assert.match(component, /aria-modal="false"/)
  assert.match(component, /aria-controls=\{panelId\}/)
  assert.match(component, /aria-expanded=\{open\}/)
  assert.match(component, /event\.key !== 'Escape'/)
  assert.match(component, /triggerRef\.current\?\.focus\(\)/)
  assert.match(component, /aria-pressed=\{preferences\.textScale === value\}/)
  assert.match(component, /Alto contraste/)
  assert.match(component, /Reducir movimiento/)
  assert.match(component, /Subrayar enlaces/)
  assert.match(component, /Restablecer preferencias/)
  assert.match(component, /aria-live="polite"/)
  assert.match(component, /window\.localStorage\.setItem/)
  assert.match(component, /window\.localStorage\.removeItem/)
  assert.match(component, /catch \{[\s\S]*El cambio solo estará activo durante esta sesión/s)
})

test('accessibility presentation supports contrast text motion links and mobile admin offset', async () => {
  const styles = await source('src/styles/accessibility-tools.css')

  assert.match(styles, /html\[data-text-scale='large'\]\s*\{[^}]*font-size:\s*112\.5%/s)
  assert.match(styles, /html\[data-text-scale='xlarge'\]\s*\{[^}]*font-size:\s*125%/s)
  assert.match(styles, /html\[data-theme='light'\]\[data-contrast='high'\]/)
  assert.match(styles, /html\[data-theme='dark'\]\[data-contrast='high'\]/)
  assert.match(styles, /html\[data-underline-links='true'\] a\[href\]/)
  assert.match(styles, /html\[data-reduce-motion='true'\] \*/)
  assert.match(styles, /\.accessibility-tools\s*\{[^}]*position:\s*fixed/s)
  assert.match(styles, /\.accessibility-tools__trigger\s*\{[^}]*min-height:\s*3rem/s)
  assert.match(styles, /\.accessibility-tools__panel\s*\{[^}]*max-height:/s)
  assert.match(styles, /body:has\(\.admin-area\) \.accessibility-tools\s*\{[^}]*bottom:\s*calc\(5\.5rem/s)
})
