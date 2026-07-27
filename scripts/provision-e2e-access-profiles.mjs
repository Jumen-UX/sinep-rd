import { randomBytes } from 'node:crypto'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const REQUIRED_CONFIRMATION = 'PROVISION_NON_PRODUCTION_E2E'
const DEFAULT_OUTPUT = '.secrets/e2e-access-profiles.json'
const DEFAULT_EMAIL_DOMAIN = 'example.test'
const DEFAULT_ENTITY_A_SLUG = 'test-arquidiocesis-ozama'
const DEFAULT_ENTITY_B_SLUG = 'test-diocesis-monte-azul'
const MAX_USER_PAGES = 20
const USERS_PER_PAGE = 1000

function requiredEnv(name, fallback) {
  const value = process.env[name]?.trim() || fallback
  if (!value) throw new Error(`Falta la variable obligatoria ${name}.`)
  return value
}

function enabled(name) {
  return ['1', 'true', 'yes', 'on'].includes(process.env[name]?.trim().toLowerCase() ?? '')
}

function assertSafeInputs({ emailDomain, entitySlugs }) {
  if (process.env.E2E_PROVISION_CONFIRM !== REQUIRED_CONFIRMATION) {
    throw new Error(`Define E2E_PROVISION_CONFIRM=${REQUIRED_CONFIRMATION} para confirmar el entorno no productivo.`)
  }

  if (!enabled('E2E_ALLOW_NON_RESERVED_EMAIL_DOMAIN') && !emailDomain.endsWith('.test') && !emailDomain.endsWith('.invalid')) {
    throw new Error('El dominio E2E debe terminar en .test o .invalid, salvo autorización explícita.')
  }

  if (!enabled('E2E_ALLOW_NON_TEST_ENTITIES') && entitySlugs.some((slug) => !slug.startsWith('test-'))) {
    throw new Error('Las entidades E2E deben usar slugs test-* salvo autorización explícita.')
  }

  if (new Set(entitySlugs).size !== entitySlugs.length) {
    throw new Error('Las entidades A y B deben ser distintas.')
  }
}

function randomPassword() {
  return `${randomBytes(24).toString('base64url')}Aa1!`
}

function isoDate() {
  return new Date().toISOString().slice(0, 10)
}

function profileSpecs({ emailDomain, entityA, entityB }) {
  return [
    {
      key: 'diocesan-admin-a',
      label: `Administrador · ${entityA.name}`,
      email: `e2e-admin-a@${emailDomain}`,
      fullName: 'E2E Administrador Diócesis A',
      expectedState: 'ready',
      status: 'active',
      onboardingComplete: true,
      roleKey: 'diocesan_admin',
      entity: entityA,
      navigationRole: 'administrator',
      expectedNavigation: {
        visible: ['/admin/nuevo', '/admin/personas'],
        hidden: [],
        readOnly: [],
      },
    },
    {
      key: 'internal-viewer-b',
      label: `Consulta · ${entityB.name}`,
      email: `e2e-viewer-b@${emailDomain}`,
      fullName: 'E2E Consulta Diócesis B',
      expectedState: 'ready',
      status: 'active',
      onboardingComplete: true,
      roleKey: 'internal_viewer',
      entity: entityB,
      navigationRole: 'viewer',
      expectedNavigation: {
        visible: ['/admin/personas'],
        hidden: ['/admin/nuevo'],
        readOnly: ['/admin/personas'],
      },
    },
    {
      key: 'onboarding',
      label: 'Onboarding pendiente',
      email: `e2e-onboarding@${emailDomain}`,
      fullName: 'E2E Onboarding Pendiente',
      expectedState: 'onboarding',
      status: 'active',
      onboardingComplete: false,
    },
    {
      key: 'no-role',
      label: 'Sin rol administrativo',
      email: `e2e-no-role@${emailDomain}`,
      fullName: 'E2E Sin Rol',
      expectedState: 'no_role',
      status: 'active',
      onboardingComplete: true,
    },
    {
      key: 'blocked',
      label: 'Acceso suspendido',
      email: `e2e-blocked@${emailDomain}`,
      fullName: 'E2E Acceso Suspendido',
      expectedState: 'blocked',
      status: 'suspended',
      onboardingComplete: true,
    },
  ]
}

async function listAllUsers(supabase) {
  const users = []

  for (let page = 1; page <= MAX_USER_PAGES; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: USERS_PER_PAGE })
    if (error) throw new Error(`No se pudieron listar usuarios de Auth: ${error.message}`)

    users.push(...data.users)
    if (data.users.length < USERS_PER_PAGE) return users
  }

  throw new Error(`La búsqueda de usuarios superó ${MAX_USER_PAGES * USERS_PER_PAGE} registros.`)
}

async function resolveEntities(supabase, slugs) {
  const { data, error } = await supabase
    .from('ecclesiastical_entities')
    .select('id,slug,name,status')
    .in('slug', slugs)

  if (error) throw new Error(`No se pudieron resolver las entidades E2E: ${error.message}`)

  const bySlug = new Map(data.map((entity) => [entity.slug, entity]))
  const entities = slugs.map((slug) => bySlug.get(slug))
  if (entities.some((entity) => !entity)) throw new Error('No se encontraron las dos entidades E2E configuradas.')
  if (entities.some((entity) => entity.status !== 'active')) throw new Error('Las entidades E2E deben estar activas.')

  return entities
}

async function resolveRoles(supabase) {
  const keys = ['diocesan_admin', 'internal_viewer']
  const { data, error } = await supabase.from('roles').select('id,key,name').in('key', keys)
  if (error) throw new Error(`No se pudieron resolver los roles E2E: ${error.message}`)

  const roles = new Map(data.map((role) => [role.key, role]))
  for (const key of keys) {
    if (!roles.has(key)) throw new Error(`No existe el rol requerido ${key}.`)
  }
  return roles
}

async function upsertAuthUser(supabase, existingUsers, spec, password) {
  const existing = existingUsers.find((user) => user.email?.toLowerCase() === spec.email.toLowerCase())
  const attributes = {
    password,
    email_confirm: true,
    user_metadata: { full_name: spec.fullName },
    app_metadata: { e2e_access_profile: true, e2e_profile_key: spec.key },
  }

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, attributes)
    if (error) throw new Error(`No se pudo actualizar el usuario ${spec.key}: ${error.message}`)
    return data.user
  }

  const { data, error } = await supabase.auth.admin.createUser({ email: spec.email, ...attributes })
  if (error) throw new Error(`No se pudo crear el usuario ${spec.key}: ${error.message}`)
  return data.user
}

async function configureProfile(supabase, spec, userId) {
  const completedAt = spec.onboardingComplete ? new Date().toISOString() : null
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    email: spec.email,
    full_name: spec.fullName,
    status: spec.status,
    onboarding_step: spec.onboardingComplete ? 'complete' : 'profile',
    onboarding_completed_at: completedAt,
    onboarding_updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })

  if (error) throw new Error(`No se pudo configurar el perfil ${spec.key}: ${error.message}`)
}

async function replaceRoleAssignments(supabase, spec, userId, roles) {
  const { error: deleteError } = await supabase.from('user_role_assignments').delete().eq('user_id', userId)
  if (deleteError) throw new Error(`No se pudieron limpiar los roles de ${spec.key}: ${deleteError.message}`)

  if (!spec.roleKey) return

  const role = roles.get(spec.roleKey)
  const { error: insertError } = await supabase.from('user_role_assignments').insert({
    user_id: userId,
    role_id: role.id,
    scope_type: 'diocese',
    scope_entity_id: spec.entity.id,
    diocese_id: spec.entity.id,
    starts_at: isoDate(),
    status: 'active',
  })

  if (insertError) throw new Error(`No se pudo asignar el rol de ${spec.key}: ${insertError.message}`)
}

async function registerAudit(supabase, spec, userId) {
  const { error } = await supabase.from('audit_logs').insert({
    action: 'provision_e2e_access_profile',
    target_table: 'profiles',
    target_id: userId,
    scope_type: spec.entity ? 'diocese' : 'unknown',
    scope_entity_id: spec.entity?.id ?? null,
    diocese_id: spec.entity?.id ?? null,
    outcome: 'success',
    new_data: {
      e2e_profile_key: spec.key,
      expected_state: spec.expectedState,
      role_key: spec.roleKey ?? null,
      entity_slug: spec.entity?.slug ?? null,
    },
  })

  if (error) throw new Error(`No se pudo auditar el perfil ${spec.key}: ${error.message}`)
}

async function verifyProvisioning(supabase, provisioned, roles) {
  const ids = provisioned.map(({ user }) => user.id)
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id,status,onboarding_completed_at')
    .in('id', ids)
  if (profileError) throw new Error(`No se pudieron verificar los perfiles: ${profileError.message}`)

  const { data: assignments, error: assignmentError } = await supabase
    .from('user_role_assignments')
    .select('user_id,role_id,scope_type,scope_entity_id,diocese_id,status')
    .in('user_id', ids)
  if (assignmentError) throw new Error(`No se pudieron verificar los roles: ${assignmentError.message}`)

  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))
  for (const { spec, user } of provisioned) {
    const profile = profilesById.get(user.id)
    if (!profile || profile.status !== spec.status) throw new Error(`El estado persistido de ${spec.key} no coincide.`)
    if (Boolean(profile.onboarding_completed_at) !== spec.onboardingComplete) {
      throw new Error(`El onboarding persistido de ${spec.key} no coincide.`)
    }

    const userAssignments = assignments.filter((assignment) => assignment.user_id === user.id)
    if (!spec.roleKey && userAssignments.length !== 0) throw new Error(`${spec.key} no debe conservar roles activos.`)
    if (spec.roleKey) {
      const role = roles.get(spec.roleKey)
      const matches = userAssignments.length === 1
        && userAssignments[0].role_id === role.id
        && userAssignments[0].scope_type === 'diocese'
        && userAssignments[0].scope_entity_id === spec.entity.id
        && userAssignments[0].diocese_id === spec.entity.id
        && userAssignments[0].status === 'active'
      if (!matches) throw new Error(`La asignación de alcance de ${spec.key} no coincide.`)
    }
  }
}

function buildProtectedMatrix(provisioned, entityA, entityB) {
  return provisioned.map(({ spec, password }) => {
    const base = {
      label: spec.label,
      email: spec.email,
      password,
      expectedState: spec.expectedState,
    }

    if (spec.expectedState !== 'ready') return base

    const forbiddenEntity = spec.entity.id === entityA.id ? entityB : entityA
    return {
      ...base,
      navigationRole: spec.navigationRole,
      expectedScopeLabel: spec.entity.name,
      expectedNavigation: spec.expectedNavigation,
      ownEntityId: spec.entity.id,
      forbiddenEntityId: forbiddenEntity.id,
      minimumVisibleDioceses: 1,
    }
  })
}

async function writeProtectedMatrix(outputPath, matrix) {
  const absolutePath = resolve(outputPath)
  await mkdir(dirname(absolutePath), { recursive: true, mode: 0o700 })
  await writeFile(absolutePath, `${JSON.stringify(matrix, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  await chmod(absolutePath, 0o600)
  return absolutePath
}

async function main() {
  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.SUPABASE_URL?.trim())
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  const emailDomain = requiredEnv('E2E_ACCESS_EMAIL_DOMAIN', DEFAULT_EMAIL_DOMAIN)
  const entityASlug = requiredEnv('E2E_ACCESS_ENTITY_A_SLUG', DEFAULT_ENTITY_A_SLUG)
  const entityBSlug = requiredEnv('E2E_ACCESS_ENTITY_B_SLUG', DEFAULT_ENTITY_B_SLUG)
  const outputPath = requiredEnv('E2E_ACCESS_OUTPUT', DEFAULT_OUTPUT)

  assertSafeInputs({ emailDomain, entitySlugs: [entityASlug, entityBSlug] })

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })

  const [[entityA, entityB], roles, existingUsers] = await Promise.all([
    resolveEntities(supabase, [entityASlug, entityBSlug]),
    resolveRoles(supabase),
    listAllUsers(supabase),
  ])
  const specs = profileSpecs({ emailDomain, entityA, entityB })
  const provisioned = []

  for (const spec of specs) {
    const password = randomPassword()
    const user = await upsertAuthUser(supabase, existingUsers, spec, password)
    await configureProfile(supabase, spec, user.id)
    await replaceRoleAssignments(supabase, spec, user.id, roles)
    await registerAudit(supabase, spec, user.id)
    provisioned.push({ spec, user, password })
  }

  await verifyProvisioning(supabase, provisioned, roles)
  const matrix = buildProtectedMatrix(provisioned, entityA, entityB)
  const absolutePath = await writeProtectedMatrix(outputPath, matrix)

  console.log(`Matriz E2E aprovisionada: ${matrix.length} perfiles.`)
  console.log(`Archivo protegido: ${absolutePath}`)
  console.log('Copia su contenido en el secreto E2E_ACCESS_PROFILES_JSON y elimina el archivo cuando termine la configuración.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Error desconocido al aprovisionar la matriz E2E.')
  process.exitCode = 1
})
