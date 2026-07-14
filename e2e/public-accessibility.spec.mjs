import { expect, test } from '@playwright/test'
import { expectNoBlockingAccessibilityViolations } from './accessibility.mjs'

const publicPages = [
  { path: '/', label: 'inicio' },
  { path: '/diocesis', label: 'directorio de diócesis' },
  { path: '/personas', label: 'directorio de personas' },
]

async function expectAccessiblePublicPage({ page, testInfo, path }) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' })

  expect(response, `La ruta ${path} no devolvió respuesta.`).not.toBeNull()
  expect(response.status(), `La ruta ${path} devolvió ${response.status()}.`).toBeLessThan(400)

  await expect(page.locator('body')).toBeVisible()
  await expect(page.locator('h1').first()).toBeVisible()
  expect(await page.locator('h1').count(), 'Cada página pública debe tener un solo encabezado principal.').toBe(1)
  expect(await page.locator('img:not([alt])').count(), 'Todas las imágenes deben declarar texto alternativo, incluso si es vacío.').toBe(0)

  await page.keyboard.press('Tab')
  const focusedTag = await page.evaluate(() => document.activeElement?.tagName ?? null)
  expect(focusedTag, 'La navegación por teclado debe mover el foco fuera del body.').not.toBe('BODY')

  await expectNoBlockingAccessibilityViolations({ page, expect, testInfo })
}

for (const publicPage of publicPages) {
  test(`${publicPage.label} responde y conserva semántica accesible`, async ({ page }, testInfo) => {
    await expectAccessiblePublicPage({ page, testInfo, path: publicPage.path })
  })
}

test('sitemap publica fichas navegables de personas y entidades', async ({ page, request }, testInfo) => {
  const sitemapResponse = await request.get('/sitemap.xml')
  expect(sitemapResponse.ok(), 'El sitemap público debe responder correctamente.').toBe(true)

  const sitemap = await sitemapResponse.text()
  const detailPaths = [
    sitemap.match(/<loc>[^<]+(\/personas\/[^<]+)<\/loc>/)?.[1],
    sitemap.match(/<loc>[^<]+(\/entidades\/[^<]+)<\/loc>/)?.[1],
  ].filter(Boolean)

  expect(detailPaths.length, 'El sitemap debe contener al menos una ficha de persona y una de entidad.').toBe(2)

  for (const path of detailPaths) {
    await expectAccessiblePublicPage({ page, testInfo, path })
  }
})

test('inicio conserva navegación y semántica en viewport móvil', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await expectAccessiblePublicPage({ page, testInfo, path: '/' })

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    'La página inicial no debe producir desplazamiento horizontal en móvil.',
  ).toBe(true)
})
