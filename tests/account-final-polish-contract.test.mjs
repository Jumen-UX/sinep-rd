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

test('dashboard actions preserve focus visibility motion preferences and responsive clearance', async () => {
  const styles = await read('src/features/account/account-dashboard.module.css')

  assert.match(styles, /\.quickActionsGrid a:focus-visible/)
  assert.match(styles, /padding:22px 50px 22px 22px!important/)
  assert.match(styles, /\.profileTask>a\{[^}]*min-height:48px!important/s)
  assert.match(styles, /\.heroAvatar,\.heroAvatarFallback\{[^}]*border-radius:50%!important/s)
  assert.match(styles, /@media\(max-width:800px\)/)
  assert.match(styles, /@media\(max-width:600px\)/)
  assert.match(styles, /@media\(max-width:480px\)/)
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/)
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

test('sidebar identity stays readable on desktop and yields space on compact navigation', async () => {
  const styles = await read('src/features/account/account-shell.module.css')

  assert.match(styles, /grid-template-columns:52px minmax\(0,1fr\)/)
  assert.match(styles, /\.avatar,\.fallback\{[^}]*border-radius:50%/s)
  assert.match(styles, /-webkit-line-clamp:2/)
  assert.match(styles, /@media\(max-width:900px\)\{\.identity\{display:none\}\}/)
})

test('access help is progressively disclosed after primary authorization content', async () => {
  const source = await read('src/app/(account)/cuenta/accesos/page.tsx')

  assert.match(source, /<details className=\{styles\.informationPanel\}>/)
  assert.match(source, /<summary><strong>Más información sobre roles y ámbitos<\/strong><\/summary>/)
  assert.match(source, /Solicitar un cambio/)
})
