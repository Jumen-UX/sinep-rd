import { expect, test } from '@playwright/test'
import { expectNoBlockingAccessibilityViolations } from './accessibility.mjs'

const publicPages = [
  { path: '/', label: 'inicio' },
  { path: '/diocesis', label: 'directorio de diócesis' },
  { path: '/personas', label: 'directorio de personas' },
]

for (const publicPage of publicPages) {
  test(`${publicPage.label} responde y conserva semántica accesible`, async ({ page }, testInfo) => {
    const response = await page.goto(publicPage.path, { waitUntil: 'domcontentloaded' })

    expect(response, `La ruta ${publicPage.path} no devolvió respuesta.`).not.toBeNull()
    expect(response.status(), `La ruta ${publicPage.path} devolvió ${response.status()}.`).toBeLessThan(400)

    await expect(page.locator('body')).toBeVisible()
    await expect(page.locator('h1').first()).toBeVisible()
    expect(await page.locator('h1').count(), 'Cada página pública debe tener un solo encabezado principal.').toBe(1)
    expect(await page.locator('img:not([alt])').count(), 'Todas las imágenes deben declarar texto alternativo, incluso si es vacío.').toBe(0)

    await page.keyboard.press('Tab')
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName ?? null)
    expect(focusedTag, 'La navegación por teclado debe mover el foco fuera del body.').not.toBe('BODY')

    await expectNoBlockingAccessibilityViolations({ page, expect, testInfo })
  })
}
