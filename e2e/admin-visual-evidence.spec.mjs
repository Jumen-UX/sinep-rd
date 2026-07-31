import { expect, test } from '@playwright/test'
import { parseAccessProfiles } from './support/access-profile-matrix.mjs'

const profiles = parseAccessProfiles(process.env.E2E_ACCESS_PROFILES_JSON)
const adminProfile = profiles.find((profile) => (
  profile.expectedState === 'ready' && profile.navigationRole === 'administrator'
))

const themes = ['light', 'dark']
const viewports = [
  { key: 'mobile', width: 390, height: 844 },
  { key: 'tablet', width: 768, height: 1024 },
  { key: 'desktop', width: 1440, height: 1200 },
]

async function prepareTheme(page, theme) {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
  await page.addInitScript((selectedTheme) => {
    window.localStorage.setItem('sinep-theme', selectedTheme)
    window.localStorage.removeItem('sinep-accessibility')
  }, theme)
}

async function signIn(page) {
  await page.goto('/admin/login?next=/admin', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Correo electrónico').fill(adminProfile.email)
  await page.getByLabel('Contraseña').fill(adminProfile.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin(?:\?.*)?$/, { timeout: 30_000 })
  await expect(page.locator('.admin-dashboard')).toBeVisible()
}

test.describe('evidencia visual administrativa autenticada', () => {
  test.skip(!adminProfile, 'Requiere un perfil QA administrador en E2E_ACCESS_PROFILES_JSON.')

  for (const theme of themes) {
    for (const viewport of viewports) {
      test(`dashboard · ${theme} · ${viewport.key}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await prepareTheme(page, theme)
        await signIn(page)

        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        await expect(page.getByRole('heading', { name: 'Resumen administrativo' })).toBeVisible()
        await expect(page.locator('.admin-scope-control').first()).toContainText(adminProfile.expectedScopeLabel)

        if (viewport.key === 'desktop') {
          await expect(page.locator('aside.admin-sidebar')).toBeVisible()
        } else {
          await expect(page.locator('nav.admin-mobile-nav')).toBeVisible()
        }

        await page.evaluate(() => document.fonts.ready)
        await page.addStyleTag({
          content: `
            *, *::before, *::after {
              animation-delay: 0s !important;
              animation-duration: 0s !important;
              caret-color: transparent !important;
              scroll-behavior: auto !important;
              transition-delay: 0s !important;
              transition-duration: 0s !important;
            }
          `,
        })

        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
          `El dashboard administrativo no debe producir desplazamiento horizontal en ${viewport.key}.`,
        ).toBe(true)

        const artifactName = `admin-dashboard-${theme}-${viewport.key}.png`
        const artifactPath = testInfo.outputPath(artifactName)
        await page.screenshot({
          animations: 'disabled',
          caret: 'hide',
          fullPage: true,
          path: artifactPath,
        })
        await testInfo.attach(`evidencia-${artifactName}`, {
          contentType: 'image/png',
          path: artifactPath,
        })
      })
    }
  }
})
