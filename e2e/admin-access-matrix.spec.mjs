import { expect, test } from '@playwright/test'
import { parseAccessProfiles } from './support/access-profile-matrix.mjs'

const profiles = parseAccessProfiles(process.env.E2E_ACCESS_PROFILES_JSON)
const destinationByState = {
  ready: /\/admin(?:\?.*)?$/,
  onboarding: /\/admin\/onboarding(?:\?.*)?$/,
  no_role: /\/admin\/acceso(?:\?.*)?$/,
  blocked: /\/admin\/acceso(?:\?.*)?$/,
}

function routeLocator(navigation, href) {
  return navigation.locator(`a[href="${href}"]`)
}

test.describe('matriz operativa de acceso administrativo', () => {
  test.skip(profiles.length === 0, 'Requiere E2E_ACCESS_PROFILES_JSON con cuentas no productivas dedicadas.')

  for (const profile of profiles) {
    test(`${profile.label}: aplica estado, navegación y alcance esperados`, async ({ browser }) => {
      const context = await browser.newContext()
      const page = await context.newPage()

      try {
        await page.goto('/admin/login?next=/admin', { waitUntil: 'domcontentloaded' })
        await page.getByLabel('Correo electrónico').fill(profile.email)
        await page.getByLabel('Contraseña').fill(profile.password)
        await page.getByRole('button', { name: 'Entrar' }).click()
        await expect(page).toHaveURL(destinationByState[profile.expectedState], { timeout: 30_000 })

        if (profile.expectedState !== 'ready') return

        const sidebar = page.locator('aside.admin-sidebar')
        const navigation = sidebar.locator('nav.admin-sidebar-nav')
        const scopeControl = sidebar.locator('.admin-scope-control')
        await expect(sidebar).toBeVisible()
        await expect(scopeControl).toContainText(profile.expectedScopeLabel)

        for (const href of profile.expectedNavigation.visible) {
          await expect(routeLocator(navigation, href), `${href} debe estar visible para ${profile.label}`).toHaveCount(1)
        }
        for (const href of profile.expectedNavigation.hidden) {
          await expect(routeLocator(navigation, href), `${href} debe permanecer oculta para ${profile.label}`).toHaveCount(0)
        }
        for (const href of profile.expectedNavigation.readOnly) {
          await expect(routeLocator(navigation, href), `${href} debe identificarse como consulta para ${profile.label}`).toContainText('Consulta')
        }

        const response = await context.request.get('/api/admin/dioceses-filtered?include_children=true&limit=500')
        expect(response.ok()).toBeTruthy()
        const payload = await response.json()
        const visibleIds = new Set((payload.dioceses ?? []).map((entity) => entity.id))

        expect(visibleIds.has(profile.ownEntityId), `${profile.label} debe ver su entidad propia`).toBeTruthy()
        expect(visibleIds.has(profile.forbiddenEntityId), `${profile.label} no debe ver la entidad prohibida`).toBeFalsy()
        if (profile.minimumVisibleDioceses !== null) {
          expect(visibleIds.size).toBeGreaterThanOrEqual(profile.minimumVisibleDioceses)
        }
      } finally {
        await context.close()
      }
    })
  }
})
