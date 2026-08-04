import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const pagePath = 'src/app/(account)/cuenta/solicitudes/page.tsx'
const managerPath = 'src/features/account/AccountRequestManager.tsx'
const servicePath = 'src/features/account/services/account-service.ts'
const stylePath = 'src/features/account/account-request.module.css'

test('personal requests create resend and cancel only through authenticated RPC services', async () => {
  const [page, manager, service] = await Promise.all([
    readFile(pagePath, 'utf8'),
    readFile(managerPath, 'utf8'),
    readFile(servicePath, 'utf8'),
  ])

  assert.match(page, /AccountRequestManager/)
  assert.match(page, /roles=\{roles\}/)
  assert.match(manager, /submitMyAccessRequest/)
  assert.match(manager, /cancelMyAccessRequest/)
  assert.match(manager, /information_required/)
  assert.match(service, /submit_my_access_request/)
  assert.match(service, /cancel_my_access_request/)
  assert.doesNotMatch(manager, /\.from\s*\(/)
  assert.doesNotMatch(manager, /admin_review_access_request/)
})

test('personal request form excludes unsafe person linkage and exposes explicit lifecycle actions', async () => {
  const manager = await readFile(managerPath, 'utf8')

  assert.match(manager, /Solicitar acceso inicial/)
  assert.match(manager, /Solicitar cambio de rol/)
  assert.match(manager, /Solicitar cambio de ámbito/)
  assert.match(manager, /Solicitar cierre de cuenta/)
  assert.doesNotMatch(manager, /Solicitar vinculación con persona/)
  assert.match(manager, /Reenviar solicitud/)
  assert.match(manager, /Cancelar solicitud/)
})

test('personal request controls remain keyboard visible and mobile touch accessible', async () => {
  const css = await readFile(stylePath, 'utf8')

  assert.match(css, /min-height:46px/)
  assert.match(css, /focus-visible/)
  assert.match(css, /min-height:48px/)
  assert.match(css, /@media\(max-width:800px\)/)
  assert.match(css, /width:100%/)
})
