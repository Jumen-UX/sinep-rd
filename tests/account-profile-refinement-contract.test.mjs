import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const formPath = new URL('../src/features/account/AccountProfileForm.tsx', import.meta.url)
const pagePath = new URL('../src/app/(account)/cuenta/perfil/page.tsx', import.meta.url)
const stylesPath = new URL('../src/features/account/account-profile.module.css', import.meta.url)

async function read(path) {
  return readFile(path, 'utf8')
}

test('profile workspace exposes identity completion preferences and photo sections', async () => {
  const [form, page] = await Promise.all([read(formPath), read(pagePath)])

  assert.match(page, /<AccountProfileForm profile=\{profile\}/)
  assert.doesNotMatch(page, /className=\{styles\.panel\}/)
  assert.match(form, /profile-identity-title/)
  assert.match(form, /profile-completion-title/)
  assert.match(form, /identity-contact-title/)
  assert.match(form, /preferences-title/)
  assert.match(form, /photo-title/)
  assert.match(form, /La vinculación con una ficha eclesial es opcional/)
})

test('profile form validates direct https images and detects unsaved changes', async () => {
  const form = await read(formPath)

  assert.match(form, /IMAGE_PATH_PATTERN/)
  assert.match(form, /parsed\.protocol !== 'https:'/)
  assert.match(form, /La URL debe apuntar directamente a una imagen/)
  assert.match(form, /const isDirty = useMemo/)
  assert.match(form, /const canSubmit = isDirty && !saving/)
  assert.match(form, /disabled=\{!canSubmit\}/)
  assert.match(form, /Tienes cambios sin guardar/)
  assert.match(form, /No hay cambios pendientes/)
})

test('profile preferences use controlled locale and IANA timezone suggestions', async () => {
  const form = await read(formPath)

  assert.match(form, /TIMEZONE_OPTIONS/)
  assert.match(form, /list="account-timezones"/)
  assert.match(form, /<datalist id="account-timezones">/)
  assert.match(form, /America\/Santo_Domingo/)
  assert.match(form, /value=\{form\.preferredLocale\}/)
  assert.match(form, /value=\{form\.timezone\}/)
})

test('profile presentation is responsive theme-aware and reduced-motion safe', async () => {
  const styles = await read(stylesPath)

  assert.match(styles, /\.identityCard/)
  assert.match(styles, /\.completionCard/)
  assert.match(styles, /\.photoGrid/)
  assert.match(styles, /\.actions\{position:sticky/)
  assert.match(styles, /@media\(max-width:800px\)/)
  assert.match(styles, /@media\(max-width:480px\)/)
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/)
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}/i)
})
