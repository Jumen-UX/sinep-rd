const allowedStates = new Set(['ready', 'onboarding', 'no_role', 'blocked'])
const allowedNavigationRoles = new Set(['administrator', 'viewer'])
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const adminPathPattern = /^\/admin(?:\/[a-z0-9áéíóúñ-]+)*$/i

function requiredText(value, field, index) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) throw new Error(`El perfil operativo ${index + 1} requiere ${field}.`)
  return normalized
}

function optionalUuid(value, field, index) {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new Error(`El perfil operativo ${index + 1} tiene ${field} inválido.`)
  }
  return value
}

function routeList(value, field, index) {
  if (!Array.isArray(value)) {
    throw new Error(`El perfil operativo ${index + 1} requiere expectedNavigation.${field} como arreglo.`)
  }

  const routes = value.map((route) => {
    if (typeof route !== 'string' || !adminPathPattern.test(route)) {
      throw new Error(`El perfil operativo ${index + 1} contiene una ruta administrativa inválida en ${field}.`)
    }
    return route
  })

  if (new Set(routes).size !== routes.length) {
    throw new Error(`El perfil operativo ${index + 1} repite rutas en expectedNavigation.${field}.`)
  }

  return routes
}

function normalizeExpectedNavigation(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`El perfil operativo ${index + 1} requiere expectedNavigation.`)
  }

  const visible = routeList(value.visible, 'visible', index)
  const hidden = routeList(value.hidden, 'hidden', index)
  const readOnly = routeList(value.readOnly, 'readOnly', index)
  const visibleSet = new Set(visible)
  const hiddenSet = new Set(hidden)

  for (const route of visible) {
    if (hiddenSet.has(route)) {
      throw new Error(`El perfil operativo ${index + 1} declara ${route} como visible y oculta.`)
    }
  }
  for (const route of readOnly) {
    if (!visibleSet.has(route)) {
      throw new Error(`El perfil operativo ${index + 1} declara ${route} como solo lectura sin hacerla visible.`)
    }
  }

  return { visible, hidden, readOnly }
}

function normalizeProfile(profile, index) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new Error(`El perfil operativo ${index + 1} no es un objeto válido.`)
  }

  const label = requiredText(profile.label, 'label', index)
  const email = requiredText(profile.email, 'email', index)
  const password = typeof profile.password === 'string' ? profile.password : ''
  const expectedState = profile.expectedState

  if (!email.includes('@')) throw new Error(`El perfil operativo ${index + 1} tiene un correo inválido.`)
  if (!password) throw new Error(`El perfil operativo ${index + 1} requiere password.`)
  if (!allowedStates.has(expectedState)) {
    throw new Error(`El perfil operativo ${index + 1} tiene un estado no válido.`)
  }

  const ownEntityId = optionalUuid(profile.ownEntityId, 'ownEntityId', index)
  const forbiddenEntityId = optionalUuid(profile.forbiddenEntityId, 'forbiddenEntityId', index)
  const minimumVisibleDioceses = profile.minimumVisibleDioceses == null
    ? null
    : profile.minimumVisibleDioceses

  if (minimumVisibleDioceses !== null && (!Number.isInteger(minimumVisibleDioceses) || minimumVisibleDioceses < 0)) {
    throw new Error(`El perfil operativo ${index + 1} tiene minimumVisibleDioceses inválido.`)
  }

  if (expectedState !== 'ready') {
    return {
      label,
      email,
      password,
      expectedState,
      ownEntityId,
      forbiddenEntityId,
      minimumVisibleDioceses,
      navigationRole: null,
      expectedScopeLabel: null,
      expectedNavigation: null,
    }
  }

  const navigationRole = requiredText(profile.navigationRole, 'navigationRole', index)
  if (!allowedNavigationRoles.has(navigationRole)) {
    throw new Error(`El perfil operativo ${index + 1} tiene navigationRole no válido.`)
  }

  const expectedScopeLabel = requiredText(profile.expectedScopeLabel, 'expectedScopeLabel', index)
  const expectedNavigation = normalizeExpectedNavigation(profile.expectedNavigation, index)

  if (!ownEntityId || !forbiddenEntityId || ownEntityId === forbiddenEntityId) {
    throw new Error(`El perfil ready ${index + 1} requiere ownEntityId y forbiddenEntityId distintos.`)
  }

  return {
    label,
    email,
    password,
    expectedState,
    ownEntityId,
    forbiddenEntityId,
    minimumVisibleDioceses,
    navigationRole,
    expectedScopeLabel,
    expectedNavigation,
  }
}

function validateCoverage(profiles) {
  const states = new Set(profiles.map((profile) => profile.expectedState))
  const missingStates = [...allowedStates].filter((state) => !states.has(state))
  if (missingStates.length > 0) {
    throw new Error(`La matriz operativa no cubre los estados: ${missingStates.join(', ')}.`)
  }

  const readyProfiles = profiles.filter((profile) => profile.expectedState === 'ready')
  const navigationRoles = new Set(readyProfiles.map((profile) => profile.navigationRole))
  const missingRoles = [...allowedNavigationRoles].filter((role) => !navigationRoles.has(role))
  if (missingRoles.length > 0) {
    throw new Error(`La matriz ready no cubre los roles de navegación: ${missingRoles.join(', ')}.`)
  }

  const hasBidirectionalIsolation = readyProfiles.some((left, leftIndex) => (
    readyProfiles.some((right, rightIndex) => (
      leftIndex !== rightIndex
      && left.ownEntityId === right.forbiddenEntityId
      && left.forbiddenEntityId === right.ownEntityId
    ))
  ))

  if (!hasBidirectionalIsolation) {
    throw new Error('La matriz requiere dos perfiles ready con aislamiento bidireccional A↔B entre entidades distintas.')
  }
}

export function parseAccessProfiles(rawProfiles, { requireCoverage = true } = {}) {
  if (!rawProfiles) return []

  let parsed
  try {
    parsed = JSON.parse(rawProfiles)
  } catch {
    throw new Error('E2E_ACCESS_PROFILES_JSON no contiene JSON válido.')
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('E2E_ACCESS_PROFILES_JSON debe contener un arreglo JSON no vacío.')
  }

  const profiles = parsed.map(normalizeProfile)
  if (requireCoverage) validateCoverage(profiles)
  return profiles
}

export function summarizeAccessProfiles(profiles) {
  const stateCounts = Object.fromEntries([...allowedStates].map((state) => [
    state,
    profiles.filter((profile) => profile.expectedState === state).length,
  ]))
  const readyRoles = Object.fromEntries([...allowedNavigationRoles].map((role) => [
    role,
    profiles.filter((profile) => profile.navigationRole === role).length,
  ]))

  return { total: profiles.length, stateCounts, readyRoles }
}
