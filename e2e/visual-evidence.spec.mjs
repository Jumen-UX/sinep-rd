import { expect, test } from '@playwright/test'

const themes = ['light', 'dark']
const viewports = [
  { key: 'mobile', width: 390, height: 844 },
  { key: 'tablet', width: 768, height: 1024 },
  { key: 'desktop', width: 1440, height: 1200 },
]

const surfaces = [
  {
    key: 'public-home',
    path: '/',
    ready: (page) => page.locator('.public-dashboard-layout'),
    baseline: (page, viewport) => viewport.key === 'desktop'
      ? page.locator('.public-sidebar')
      : page.locator('.public-mobile-header'),
  },
  {
    key: 'admin-login',
    path: '/admin/login',
    ready: (page) => page.locator('.auth-card form'),
    baseline: (page) => page.locator('.auth-card'),
  },
  {
    key: 'admin-password-recovery',
    path: '/admin/recuperar/solicitar',
    ready: (page) => page.locator('.auth-card form'),
    baseline: (page) => page.locator('.auth-card'),
  },
]

async function stabilizeVisualState(page, theme) {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
  await page.addInitScript((selectedTheme) => {
    window.localStorage.setItem('sinep-theme', selectedTheme)
    window.localStorage.removeItem('sinep-accessibility')
  }, theme)
}

for (const surface of surfaces) {
  for (const theme of themes) {
    for (const viewport of viewports) {
      test(`${surface.key} · ${theme} · ${viewport.key}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await stabilizeVisualState(page, theme)

        const response = await page.goto(surface.path, { waitUntil: 'networkidle' })
        expect(response, `La ruta ${surface.path} no devolvió respuesta.`).not.toBeNull()
        expect(response.status(), `La ruta ${surface.path} devolvió ${response.status()}.`).toBeLessThan(400)

        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        await expect(page.locator('h1').first()).toBeVisible()
        await expect(surface.ready(page)).toBeVisible()
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
          `${surface.key} no debe producir desplazamiento horizontal en ${viewport.key}.`,
        ).toBe(true)

        if (surface.key === 'public-home' && viewport.key === 'mobile') {
          const [accessibilityTrigger, bottomNavigation] = await Promise.all([
            page.getByRole('button', { name: 'Abrir herramientas de accesibilidad' }).boundingBox(),
            page.locator('.public-bottom-nav').boundingBox(),
          ])
          expect(accessibilityTrigger).not.toBeNull()
          expect(bottomNavigation).not.toBeNull()
          expect(
            accessibilityTrigger.y + accessibilityTrigger.height,
            'El control de accesibilidad debe quedar sobre la navegación pública móvil.',
          ).toBeLessThanOrEqual(bottomNavigation.y - 8)
        }

        const artifactName = `${surface.key}-${theme}-${viewport.key}.png`
        const artifactPath = testInfo.outputPath(artifactName)
        await page.screenshot({
          animations: 'disabled',
          caret: 'hide',
          fullPage: true,
          path: artifactPath,
        })
        await testInfo.attach(`evidencia-${surface.key}-${theme}-${viewport.key}`, {
          contentType: 'image/png',
          path: artifactPath,
        })

        await expect(surface.baseline(page, viewport)).toHaveScreenshot(artifactName, {
          animations: 'disabled',
          caret: 'hide',
          maxDiffPixelRatio: 0.001,
        })
      })
    }
  }
}
