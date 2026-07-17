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

async function entityPathFromSitemap(request) {
  const sitemapResponse = await request.get('/sitemap.xml')
  expect(sitemapResponse.ok(), 'El sitemap público debe responder correctamente.').toBe(true)
  const sitemap = await sitemapResponse.text()
  return sitemap.match(/<loc>[^<]+(\/entidades\/[^<]+)<\/loc>/)?.[1] ?? null
}

for (const publicPage of publicPages) {
  test(`${publicPage.label} responde y conserva semántica accesible`, async ({ page }, testInfo) => {
    await expectAccessiblePublicPage({ page, testInfo, path: publicPage.path })
  })
}

test('tema oscuro se aplica sin perder persistencia ni accesibilidad', async ({ page }, testInfo) => {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' })

  expect(response).not.toBeNull()
  expect(response.status()).toBeLessThan(400)

  const themeControl = page.locator('[data-ui="theme-control"] select').first()
  await expect(themeControl).toBeVisible()
  await themeControl.selectOption('dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('sinep-theme'))).toBe('dark')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expectNoBlockingAccessibilityViolations({ page, expect, testInfo })
})

test('inicio territorial mantiene sus secciones en flujo vertical', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 })
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' })

  expect(response).not.toBeNull()
  expect(response.status()).toBeLessThan(400)

  const provinces = page.locator('.public-provinces-section')
  const jurisdictions = page.locator('.public-jurisdictions-section')
  const pastors = page.locator('.public-pastors-section')

  await expect(provinces).toBeVisible()
  await expect(jurisdictions).toBeVisible()
  await expect(pastors).toBeVisible()

  const [provinceBox, jurisdictionBox, pastorsBox] = await Promise.all([
    provinces.boundingBox(),
    jurisdictions.boundingBox(),
    pastors.boundingBox(),
  ])

  expect(provinceBox).not.toBeNull()
  expect(jurisdictionBox).not.toBeNull()
  expect(pastorsBox).not.toBeNull()
  expect(provinceBox.y + provinceBox.height).toBeLessThanOrEqual(jurisdictionBox.y + 1)
  expect(jurisdictionBox.y + jurisdictionBox.height).toBeLessThanOrEqual(pastorsBox.y + 1)

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    'La vista territorial no debe producir desplazamiento horizontal en escritorio.',
  ).toBe(true)
})

test('ficha de entidad conserva la presentación pública completa', async ({ page, request }) => {
  const entityPath = await entityPathFromSitemap(request)
  expect(entityPath, 'El sitemap debe publicar al menos una ficha de entidad.').not.toBeNull()

  await page.setViewportSize({ width: 1440, height: 1200 })
  const response = await page.goto(entityPath, { waitUntil: 'domcontentloaded' })
  expect(response).not.toBeNull()
  expect(response.status()).toBeLessThan(400)

  await expect(page.locator('.public-entity-detail')).toBeVisible()
  await expect(page.locator('.public-entity-detail .dashboard-hero')).toBeVisible()
  await expect(page.locator('.entity-facts-grid')).toBeVisible()

  const presentation = await page.evaluate(() => {
    const header = document.querySelector('.site-header-inner')
    const hero = document.querySelector('.public-entity-detail .dashboard-hero')
    const heading = document.querySelector('.public-entity-detail h1')
    const facts = document.querySelector('.entity-facts-grid')

    return {
      headerDisplay: header ? getComputedStyle(header).display : null,
      heroPaddingTop: hero ? Number.parseFloat(getComputedStyle(hero).paddingTop) : 0,
      headingSize: heading ? Number.parseFloat(getComputedStyle(heading).fontSize) : 0,
      factsDisplay: facts ? getComputedStyle(facts).display : null,
      factsColumns: facts ? getComputedStyle(facts).gridTemplateColumns : '',
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    }
  })

  expect(presentation.headerDisplay, 'El encabezado público debe conservar su distribución horizontal.').toBe('flex')
  expect(presentation.heroPaddingTop, 'La ficha principal debe conservar relleno visual.').toBeGreaterThanOrEqual(20)
  expect(presentation.headingSize, 'El título institucional no debe quedar reducido por el reset CSS.').toBeGreaterThanOrEqual(32)
  expect(presentation.factsDisplay, 'Los datos básicos deben presentarse como cuadrícula.').toBe('grid')
  expect(presentation.factsColumns.split(' ').filter(Boolean).length, 'La cuadrícula debe usar dos columnas en escritorio.').toBeGreaterThanOrEqual(2)
  expect(presentation.noHorizontalOverflow, 'La ficha no debe producir desplazamiento horizontal.').toBe(true)
})

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
