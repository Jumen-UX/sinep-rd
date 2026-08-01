import { expect, test } from '@playwright/test'
import { expectNoBlockingAccessibilityViolations } from './accessibility.mjs'
import { parseAccessProfiles } from './support/access-profile-matrix.mjs'

const profiles = parseAccessProfiles(process.env.E2E_ACCESS_PROFILES_JSON)
const readyProfiles = profiles.filter((profile) => profile.expectedState === 'ready')

async function login(page, profile) {
  await page.goto('/admin/login?next=/admin', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Correo electrónico').fill(profile.email)
  await page.getByLabel('Contraseña').fill(profile.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin(?:\?.*)?$/, { timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Resumen administrativo' })).toBeVisible()
}

test.describe('accesibilidad administrativa autenticada', () => {
  test.skip(readyProfiles.length === 0, 'Requiere perfiles ready en E2E_ACCESS_PROFILES_JSON.')

  for (const profile of readyProfiles) {
    test(`${profile.label}: dashboard sin violaciones bloqueantes y navegación por teclado`, async ({ browser }, testInfo) => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } })
      const page = await context.newPage()

      try {
        await login(page, profile)
        const sidebar = page.locator('aside.admin-sidebar')
        await expect(sidebar).toBeVisible()
        await expect(sidebar.locator('.admin-scope-control')).toContainText(profile.expectedScopeLabel)
        expect(await page.locator('h1').count(), 'El dashboard debe tener un único encabezado principal.').toBe(1)
        expect(await page.locator('img:not([alt])').count(), 'Las imágenes deben declarar texto alternativo.').toBe(0)

        await page.keyboard.press('Tab')
        expect(
          await page.evaluate(() => document.activeElement?.tagName ?? 'BODY'),
          'El teclado debe mover el foco fuera del body.',
        ).not.toBe('BODY')

        await expectNoBlockingAccessibilityViolations({ page, expect, testInfo })
      } finally {
        await context.close()
      }
    })
  }

  test('administrador: menú móvil gestiona foco, Escape y retorno al disparador', async ({ browser }, testInfo) => {
    const profile = readyProfiles.find((candidate) => candidate.navigationRole === 'administrator')
    test.skip(!profile, 'Requiere un perfil administrador ready.')

    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()

    try {
      await login(page, profile)
      const trigger = page.getByRole('button', { name: 'Más' })
      await expect(trigger).toBeVisible()
      await trigger.focus()
      await trigger.press('Enter')

      const dialog = page.getByRole('dialog', { name: 'Todos los módulos administrativos' })
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Cerrar' })).toBeFocused()
      await expectNoBlockingAccessibilityViolations({ page, expect, testInfo })

      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      await expect(trigger).toBeFocused()
    } finally {
      await context.close()
    }
  })
})
