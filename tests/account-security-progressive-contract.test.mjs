import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const managerPath = 'src/features/account/AccountSecurityManager.tsx'
const lowerCssPath = 'src/features/account/account-security-lower.module.css'

test('password form starts collapsed and expands only after an explicit action', async () => {
  const manager = await readFile(managerPath, 'utf8')
  assert.match(manager, /const \[passwordExpanded, setPasswordExpanded\] = useState\(false\)/)
  assert.match(manager, /Cambiar contraseña/)
  assert.match(manager, /aria-controls="password-change-form"/)
  assert.match(manager, /aria-expanded="false"/)
  assert.match(manager, /passwordExpanded \? \(/)
  assert.match(manager, /id="password-change-form"/)
})

test('cancelling or completing password change clears sensitive values', async () => {
  const manager = await readFile(managerPath, 'utf8')
  assert.match(manager, /function resetPasswordForm\(\)/)
  assert.match(manager, /setPassword\(''\)/)
  assert.match(manager, /setConfirmation\(''\)/)
  assert.match(manager, /setShowPassword\(false\)/)
  assert.match(manager, /setShowConfirmation\(false\)/)
  assert.match(manager, /function closePasswordForm\(\)/)
  assert.match(manager, /resetPasswordForm\(\)\s*\n\s*setPasswordExpanded\(false\)/)
  assert.match(manager, /Tu contraseña fue actualizada correctamente/)
})

test('progressive security panel remains responsive and visually distinct', async () => {
  const css = await readFile(lowerCssPath, 'utf8')
  assert.match(css, /section\[aria-labelledby='password-title'\]/)
  assert.match(css, /#password-change-form/)
  assert.match(css, /border-top:1px solid var\(--security-border\)/)
  assert.match(css, /grid-template-columns:auto minmax\(0,1fr\) auto/)
  assert.match(css, /@media\(max-width:800px\)/)
  assert.match(css, /width:100%!important/)
})
