import { parseAccessProfiles, summarizeAccessProfiles } from '../e2e/support/access-profile-matrix.mjs'

try {
  const profiles = parseAccessProfiles(process.env.E2E_ACCESS_PROFILES_JSON)
  const summary = summarizeAccessProfiles(profiles)
  console.log(`Matriz E2E protegida válida: ${summary.total} perfiles.`)
  console.log(`Estados cubiertos: ${Object.entries(summary.stateCounts).map(([state, count]) => `${state}=${count}`).join(', ')}.`)
  console.log(`Roles ready cubiertos: ${Object.entries(summary.readyRoles).map(([role, count]) => `${role}=${count}`).join(', ')}.`)
} catch (error) {
  const message = error instanceof Error ? error.message : 'No se pudo validar E2E_ACCESS_PROFILES_JSON.'
  console.error(`::error::${message}`)
  process.exit(1)
}
