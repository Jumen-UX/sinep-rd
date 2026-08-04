import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('dashboard presents human-readable preferences and contextual pending actions', async () => {
  const source = await read('src/features/account/AccountHomePage.tsx')

  assert.match(source, /Español latinoamericano/)
  assert.match(source, /timezoneLabel/)
  assert.match(source, /profile-phone-input/)
  assert.match(source, /profile-photo-input/)
  assert.match(source, /nextProfileTask\.href/)
  assert.doesNotMatch(source, /href="\/cuenta\/perfil#profile-photo-input">\{incompleteProfileItems\[0\]\.label\}/)
})

test('dashboard actions preserve focus visibility and content clearance', async () => {
  const styles = await read('src/features/account/account-dashboard.module.css')

  assert.match(styles, /\.quickActionsGrid a:focus-visible/)
  assert.match(styles, /padding:20px 48px 20px 20px!important/)
  assert.match(styles, /\.srOnly\{/)
})

test('security overview avoids duplicate metric cards and exposes honest controls', async () => {
  const [page, styles] = await Promise.all([
    read('src/app/(account)/cuenta/seguridad/page.tsx'),
    read('src/features/account/account-security-overview.module.css'),
  ])

  assert.match(page, /Protección disponible/)
  assert.match(page, /Correo de recuperación/)
  assert.match(page, /Control de sesiones/)
  assert.match(page, /Autenticación en dos pasos/)
  assert.doesNotMatch(page, /styles\.summaryGrid/)
  assert.match(styles, /\.overview\{/)
  assert.match(styles, /@media\(max-width:800px\)/)
})
