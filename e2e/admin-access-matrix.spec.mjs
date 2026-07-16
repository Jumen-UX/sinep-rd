import { expect, test } from '@playwright/test'

const rawProfiles = process.env.E2E_ACCESS_PROFILES_JSON
const validStates = new Set(['ready', 'onboarding', 'no_role', 'blocked'])
const validNavigationRoles = new Set(['administrator', 'viewer'])

function parseAdminHrefList(value, field, profileIndex) {
  if (!Array.isArray(value)) {
    throw new Error(`El campo ${field} del perfil operativo ${profileIndex + 1} debe ser un arreglo.`)
  }

  const hrefs = value.map((href) => (typeof href === 'string' ? href.trim() : ''))
  if (hrefs.some((href) => !/^\/admin(?:\/|$)/.test(href))) {
    throw new Error(`El campo ${field} del perfil operativo ${profileIndex + 1} contiene una ruta administrativa no válida.`)
  }

  return [...new Set(hrefs)]
}

function parseNavigationExpectation(profile, profileIndex, expectedState) {
  const navigationRole = typeof profile.navigationRole === 'string'
    ? profile.navigationRole.trim()
    : ''
  const expectation = profile.expectedNavigation

  if (expectedState !== 'ready') {
    if (navigationRole || expectation !== undefined) {
      throw new Error(`El perfil operativo ${profileIndex + 1} solo puede definir navegación cuando expectedState es ready.`)
    }
    return null
  }

  if (!validNavigationRoles.has(navigationRole)) {
    throw new Error(`El perfil operativo ${profileIndex + 1} debe declarar navigationRole como administrator o viewer.`)
  }

  if (!expectation || typeof expectation !== 'object' || Array.isArray(expectation)) {
    throw new Error(`El perfil operativo ${profileIndex + 1} debe declarar expectedNavigation.`)
  }

  const visible = parseAdminHrefList(expectation.visible, 'expectedNavigation.visible', profileIndex)
  const hidden = parseAdminHrefList(expectation.hidden, 'expectedNavigation.hidden', profileIndex)
  const readOnly = parseAdminHrefList(expectation.readOnly, 'expectedNavigation.readOnly', profileIndex)
  const visibleSet = new Set(visible)

  if (visible.length === 0) {
    throw new Error(`El perfil operativo ${profileIndex + 1} debe incluir al menos una ruta visible.`)
  }
  if (hidden.some((href) => visibleSet.has(href))) {
    throw new Error(`El perfil operativo ${profileIndex + 1} no puede marcar una misma ruta como visible y oculta.`)
  }
  if (readOnly.some((href) => !visibleSet.has(href))) {
    throw new Error(`El perfil operativo ${profileIndex + 1} solo puede marcar como consulta rutas también declaradas visibles.`)
  }

  return {
    role: navigationRole,
    visible,
    hidden,
    readOnly,
    scopeLabel: typeof profile.expectedScopeLabel === 'string'
      ? profile.expectedScopeLabel.trim()
      : '',
  }
}

function loadProfiles() {
  if (!rawProfiles) return []

  const profiles = JSON.parse(rawProfiles)
  if (!Array.isArray(profiles)) throw new Error('E2E_ACCESS_PROFILES_JSON debe contener un arreglo JSON.')

  const normalizedProfiles = profiles.map((profile, index) => {
    const label = typeof profile.label === 'string' ? profile.label.trim() : ''
    const email = typeof profile.email === 'string' ? profile.email.trim() : ''
    const password = typeof profile.password === 'string' ? profile.password : ''
    const expectedState = profile.expectedState

    if (!label || !email || !password || !validStates.has(expectedState)) {
      throw new Error(`El perfil operativo ${index + 1} está incompleto o tiene un estado no válido.`)
    }

    return {
      label,
      email,
      password,
      expectedState,
      navigation: parseNavigationExpectation(profile, index, expectedState),
      ownEntityId: typeof profile.ownEntityId === 'string' ? profile.ownEntityId : null,
      forbiddenEntityId: typeof profile.forbiddenEntityId === 'string' ? profile.forbiddenEntityId : null,
      minimumVisibleDioceses: Number.isInteger(profile.minimumVisibleDioceses)
        ? profile.minimumVisibleDioceses
        : null,
    }
  })

  const navigationRoles = new Set(
    normalizedProfiles
      .filter((profile) => profile.expectedState === 'ready')
      .map((profile) => profile.navigation?.role)
      .filter(Boolean),
  )

  for (const requiredRole of validNavigationRoles) {
    if (!navigationRoles.has(requiredRole)) {
      throw new Error(`E2E_ACCESS_PROFILES_JSON debe incluir un perfil ready con navigationRole ${requiredRole}.`)
    }
  }

  return normalizedProfiles
}

async function validateNavigation(page, expectation, profileLabel) {
  const sidebar = page.locator('.admin-sidebar')

  try {
    await expect(sidebar, `El shell administrativo debe estar visible para ${profileLabel}.`).toBeVisible({ timeout: 30_000 })
  } catch (shellError) {
    const title = await page.title().catch(() => 'Título no disponible')
    const body = await page.locator('body').innerText().catch(() => 'Contenido no disponible')
    const excerpt = body.replace(/\s+/g, ' ').trim().slice(0, 800)
    throw new Error(
      `No se renderizó el shell administrativo para ${profileLabel}. URL final: ${page.url()}. Título: ${title}. Contenido: ${excerpt}`,
      { cause: shellError },
    )
  }

  const navigation = sidebar.locator('.admin-sidebar-nav')
  await expect(sidebar.locator('.admin-navigation-status')).toHaveCount(0, { timeout: 30_000 })
  await expect(sidebar.locator('.admin-navigation-error')).toHaveCount(0)
  await expect(navigation).toBeVisible()

  if (expectation.scopeLabel) {
    await expect(sidebar.locator('.admin-scope-control')).toContainText(expectation.scopeLabel)
  }

  for (const href of expectation.visible) {
    const link = navigation.locator(`a[href="${href}"]`)
    await expect(link, `La ruta ${href} debe estar visible para ${expectation.role}.`).toHaveCount(1)
    await expect(link).toBeVisible()
  }

  for (const href of expectation.hidden) {
    await expect(
      navigation.locator(`a[href="${href}"]`),
      `La ruta ${href} debe permanecer oculta para ${expectation.role}.`,
    ).toHaveCount(0)
  }

  for (const href of expectation.readOnly) {
    await expect(
      navigation.locator(`a[href="${href}"]`),
      `La ruta ${href} debe identificarse como consulta para ${expectation.role}.`,
    ).toContainText('Consulta')
  }
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
    test(`${profile.label}: aplica estado, navegación y alcance esperados`, async ({ browser }) => {
      const context = await browser.newContext()
      const page = await context.newPage()

      try {
        await page.goto('/admin/login?next=/admin', { waitUntil: 'domcontentloaded' })
        await page.getByLabel('Correo electrónico').fill(profile.email)
        await page.getByLabel('Contraseña').fill(profile.password)
        await page.getByRole('button', { name: 'Entrar' }).click()
        await expect(page).toHaveURL(destinationByState[profile.expectedState], { timeout: 30_000 })
        await page.waitForLoadState('domcontentloaded')

        if (profile.expectedState !== 'ready') return

        await validateNavigation(page, profile.navigation, profile.label)

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
