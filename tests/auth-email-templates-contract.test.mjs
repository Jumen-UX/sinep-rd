import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(testDirectory, '..')
const templatesDirectory = path.join(repositoryRoot, 'supabase', 'templates')

const authenticationTemplates = [
  'confirmation.html',
  'invite.html',
  'magic_link.html',
  'email_change.html',
  'recovery.html',
  'reauthentication.html',
]

const securityNotificationTemplates = [
  'password_changed_notification.html',
  'email_changed_notification.html',
  'phone_changed_notification.html',
  'identity_linked_notification.html',
  'identity_unlinked_notification.html',
  'mfa_factor_enrolled_notification.html',
  'mfa_factor_unenrolled_notification.html',
]

const allTemplates = [
  ...authenticationTemplates,
  ...securityNotificationTemplates,
]

async function readTemplate(filename) {
  return readFile(path.join(templatesDirectory, filename), 'utf8')
}

test('auth email catalog contains every supported Supabase template', () => {
  assert.equal(authenticationTemplates.length, 6)
  assert.equal(securityNotificationTemplates.length, 7)
  assert.equal(allTemplates.length, 13)
})

test('every auth email follows the approved SINEP RD visual contract', async () => {
  for (const filename of allTemplates) {
    const template = await readTemplate(filename)

    assert.match(template, /<!doctype html>/i, filename)
    assert.match(template, /<html lang="es">/, filename)
    assert.match(template, /SINEP RD/, filename)
    assert.match(template, /Sistema de Información Eclesial/, filename)
    assert.match(template, /background-color:#111111/, filename)
    assert.match(template, /#ffbf00/, filename)
    assert.match(template, />SD</, filename)
    assert.match(template, /background-color:#f4f4f5/, filename)
    assert.doesNotMatch(
      template,
      /Your password was changed|Reset your password|You've been invited|Confirm your email address/,
      filename,
    )
  }
})

test('action templates use only the variables required by their flows', async () => {
  for (const filename of ['confirmation.html', 'invite.html', 'magic_link.html', 'recovery.html']) {
    assert.match(await readTemplate(filename), /{{ \.ConfirmationURL }}/, filename)
  }

  const emailChange = await readTemplate('email_change.html')
  assert.match(emailChange, /{{ \.ConfirmationURL }}/)
  assert.match(emailChange, /{{ \.NewEmail }}/)

  const reauthentication = await readTemplate('reauthentication.html')
  assert.match(reauthentication, /{{ \.Token }}/)
  assert.doesNotMatch(reauthentication, /{{ \.ConfirmationURL }}/)
})

test('security notifications include recovery navigation and event metadata', async () => {
  for (const filename of securityNotificationTemplates) {
    assert.match(await readTemplate(filename), /{{ \.SiteURL }}/, filename)
  }

  const emailChanged = await readTemplate('email_changed_notification.html')
  assert.match(emailChanged, /{{ \.OldEmail }}/)
  assert.match(emailChanged, /{{ \.Email }}/)

  const phoneChanged = await readTemplate('phone_changed_notification.html')
  assert.match(phoneChanged, /{{ \.OldPhone }}/)
  assert.match(phoneChanged, /{{ \.Phone }}/)

  for (const filename of ['identity_linked_notification.html', 'identity_unlinked_notification.html']) {
    assert.match(await readTemplate(filename), /{{ \.Provider }}/, filename)
  }

  for (const filename of ['mfa_factor_enrolled_notification.html', 'mfa_factor_unenrolled_notification.html']) {
    assert.match(await readTemplate(filename), /{{ \.FactorType }}/, filename)
  }
})
