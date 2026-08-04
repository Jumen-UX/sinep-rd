import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const pagePath = 'src/app/(account)/cuenta/seguridad/page.tsx'
const managerPath = 'src/features/account/AccountSecurityManager.tsx'
const shellPath = 'src/features/account/AccountShell.tsx'
const cssPath = 'src/features/account/account-security.module.css'

test('personal security route requires authentication and exposes real account controls', async () => {
  const [page, manager, shell] = await Promise.all([
    readFile(pagePath, 'utf8'),
    readFile(managerPath, 'utf8'),
    readFile(shellPath, 'utf8'),
  ])

  assert.match(page, /supabase\.auth\.getUser\(\)/)
  assert.match(page, /redirect\('\/admin\/login\?next=\/cuenta\/seguridad'\)/)
  assert.match(page, /email=\{user\.email \?\? 'Correo no disponible'\}/)
  assert.match(shell, /href: '\/cuenta\/seguridad'/)
  assert.match(manager, /supabase\.auth\.updateUser\(\{ password \}\)/)
  assert.match(manager, /supabase\.auth\.signOut\(\{ scope: 'others' \}\)/)
  assert.doesNotMatch(manager, /service_role|admin\.deleteUser|admin\.updateUserById/)
})

test('password change validates measurable criteria and prevents duplicate actions', async () => {
  const manager = await readFile(managerPath, 'utf8')

  assert.match(manager, /MIN_PASSWORD_LENGTH = 12/)
  assert.match(manager, /\[A-Z\]/)
  assert.match(manager, /\[a-z\]/)
  assert.match(manager, /\\d/)
  assert.match(manager, /\[\^A-Za-z0-9\]/)
  assert.match(manager, /password === confirmation/)
  assert.match(manager, /disabled=\{!passwordValid \|\| busy !== null\}/)
  assert.match(manager, /Completa todos los requisitos y confirma la contraseña/)
  assert.match(manager, /role="alert"/)
  assert.match(manager, /role="status"/)
})

test('security refinement exposes visible fields strength guidance and confirmation semantics', async () => {
  const [manager, css] = await Promise.all([
    readFile(managerPath, 'utf8'),
    readFile(cssPath, 'utf8'),
  ])

  assert.match(manager, /placeholder="Escribe una contraseña nueva"/)
  assert.match(manager, /placeholder="Repite la nueva contraseña"/)
  assert.match(manager, /function EyeIcon/)
  assert.match(manager, /Mostrar nueva contraseña/)
  assert.match(manager, /Ocultar nueva contraseña/)
  assert.match(manager, /aria-pressed=\{showPassword\}/)
  assert.match(manager, /className=\{styles\.strengthBadge\}/)
  assert.match(manager, /role="progressbar"/)
  assert.match(manager, /Fortaleza de la contraseña/)
  assert.match(manager, /Agrega un símbolo especial, por ejemplo:/)
  assert.match(manager, /Las contraseñas coinciden/)
  assert.match(manager, /Las contraseñas no coinciden/)
  assert.match(manager, /aria-describedby="password-strength password-requirements"/)
  assert.match(manager, /Consejos de seguridad/)
  assert.match(manager, /Esta sesión permanece activa/)
  assert.match(manager, /emailConfirmed \? 'Verificado' : 'Pendiente'/)
  assert.match(css, /:global\(html\[data-theme='light'\]\) \.securityStack/)
  assert.match(css, /\.inputGroup\{[^}]*position:relative/s)
  assert.match(css, /\.inputGroup\{[^}]*border:1px solid/s)
  assert.match(css, /\.inputGroup input\{[^}]*padding:0 118px 0 14px/s)
  assert.match(css, /\.visibilityButton\{[^}]*position:absolute/s)
  assert.match(css, /\.visibilityButton svg/)
  assert.match(css, /\.inputGroup:focus-within/)
  assert.match(css, /\.strengthBadge\[data-score='5'\]/)
  assert.match(css, /\.strengthTrack\{[^}]*height:12px/s)
  assert.match(css, /\.matchStatus\[data-error='true'\]/)
  assert.match(css, /max-width:680px/)
  assert.match(css, /\.statusGood/)
})

test('security workspace remains responsive touch-safe reduced-motion-aware and does not invent device inventory', async () => {
  const [manager, css] = await Promise.all([
    readFile(managerPath, 'utf8'),
    readFile(cssPath, 'utf8'),
  ])

  assert.match(manager, /Supabase no expone aquí un inventario confiable/)
  assert.match(manager, /Autenticación en dos pasos/)
  assert.match(css, /min-height:44px/)
  assert.match(css, /@media\(max-width:800px\)/)
  assert.match(css, /@media\(max-width:480px\)/)
  assert.match(css, /\.inputGroup input\{padding-right:92px\}/)
  assert.match(css, /\.visibilityButton\{min-width:76px/)
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/)
  assert.match(css, /grid-template-columns:1fr/)
})
