import { expect, test } from '@playwright/test'

const rawProfiles = process.env.E2E_ACCESS_PROFILES_JSON

function loadProfiles() {
  if (!rawProfiles) return []

  const profiles = JSON.parse(rawProfiles)
  if (!Array.isArray(profiles)) throw new Error('E2E_ACCESS_PROFILES_JSON debe contener un arreglo JSON.')

  return profiles.map((profile, index) => {
    const label = typeof profile.label === 'string' ? profile.label.trim() : ''
    const email = typeof profile.email === 'string' ? profile.email.trim() : ''
    const password = typeof profile.password === 'string' ? profile.password : ''
    const expectedState = profile.expectedState

    if (!label || !email || !password || !['ready', 'onboarding', 'no_role', 'blocked'].includes(expectedState)) {
      throw new Error(`El perfil operativo ${index + 1} estÃ¡ incompleto o tiene un estado no vÃ¡lido.`)
    }

    return {
      label,
      email,
      password,
      expectedState,
      ownEntityId: typeof profile.ownEntityId === 'string' ? profile.ownEntityId : null,
      forbiddenEntityId: typeof profile.forbiddenEntityId === 'string' ? profile.forbiddenEntityId : null,
      minimumVisibleDioceses: Number.isInteger(profile.minimumVisibleDioceses)
        ? profile.minimumVisibleDioceses
        : null,
    }
  })
}

const profiles = loadProfiles()
const destinationByState = {
  ready: /\/admin(?:\?.*)?$/,
  onboarding: /\/admin\/onboarding(?:\?.*)?$/,
  no_role: /\/admin\/acceso(?:\?.*)?$/,
  blocked: /\/admin\/acceso(?:\?.*)?$/,
}

test.describe('matriz operativa de acceso administrativo', () => {
  test.skip(profiles.length === 0, 'Requiere E2E_ACCESS_PROFILES_JSON con cuentas no productivas dedicadas.')

  for (const profile of profiles) {
    test(`${profile.label}: aplica estado y alcance esperados`, async ({ browser }) => {
      const context = await browser.newContext()
      const page = await context.newPage()

      try {
        await page.goto('/admin/login?next=/admin', { waitUntil: 'domcontentloaded' })
        await page.getByLabel('Correo electrÃ³nico').fill(profile.email)
        await page.getByLabel('ContraseÃ±a').fill(profile.password)
        await page.getByRole('button', { name: 'Entrar' }).click()
        await expect(page).toHaveURL(destinationByState[profile.expectedState], { timeout: 30_000 })

        if (profile.expectedState !== 'ready') return

        const response = await context.request.get('/api/admin/dioceses-filtered?include_children=true&limit=500')
        expect(response.ok()).toBeTruthy()
        const payload = await response.json()
        const visibleIds = new Set((payload.dioceses ?? []).map((entity) => entity.id))

        if (profile.ownEntityId) expect(visibleIds.has(profile.ownEntityId)).toBeTruthy()
        if (profile.forbiddenEntityId) expect(visibleIds.has(profile.forbiddenEntityId)).toBeFalsy()
        if (profile.minimumVisibleDioceses !== null) {
          expect(visibleIds.size).toBeGreaterThanOrEqual(profile.minimumVisibleDioceses)
        }
      } finally {
        await context.close()
      }
    })
  }
})

