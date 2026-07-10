import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractFunction(sql, qualifiedName) {
  const marker = `create or replace function ${qualifiedName}`
  const start = sql.indexOf(marker)
  assert.notEqual(start, -1, `No se encontró la función ${qualifiedName}`)

  const candidates = [
    sql.indexOf('\ncreate or replace function ', start + marker.length),
    sql.indexOf('\nrevoke all on function ', start + marker.length),
    sql.length,
  ].filter((index) => index >= 0)

  return sql.slice(start, Math.min(...candidates))
}

const routeContracts = [
  ['src/app/api/admin/asignacion/route.ts', 'appointments.create_proposal', 'admin_save_position_assignment'],
  ['src/app/api/admin/sacerdote/route.ts', 'people.create_proposal', 'admin_save_priest'],
  ['src/app/api/admin/diacono/route.ts', 'people.create_proposal', 'admin_save_deacon'],
  ['src/app/api/admin/obispo/route.ts', 'people.create_proposal', 'admin_save_bishop'],
  ['src/app/api/admin/laico/route.ts', 'people.create_proposal', 'admin_save_layperson'],
  ['src/app/api/admin/religioso/route.ts', 'people.create_proposal', 'admin_save_religious'],
  ['src/app/api/admin/entidad/route.ts', 'entities.create_proposal', 'admin_save_ecclesiastical_entity'],
  ['src/app/api/admin/jurisdiccion/route.ts', 'entities.create_proposal', 'admin_save_jurisdiction'],
  ['src/app/api/admin/estructura/nodo-entidad/route.ts', 'structures.manage', 'admin_create_structure_node_entity'],
]

test('critical admin routes enforce permission, validation, RPC and audit contracts', async () => {
  for (const [path, permissionKey, rpcName] of routeContracts) {
    const source = await readRepoFile(path)
    assert.match(
      source,
      new RegExp(`permissionKey:\\s*['\"]${escapeRegex(permissionKey)}['\"]`),
      `${path} debe exigir ${permissionKey}`,
    )
    assert.match(
      source,
      new RegExp(`\\.rpc\\(\\s*['\"]${escapeRegex(rpcName)}['\"]`),
      `${path} debe llamar ${rpcName}`,
    )
    assert.match(source, /parseJsonObjectBody\(/, `${path} debe validar el cuerpo JSON`)
    assert.match(source, /recordAdminAudit\(/, `${path} debe registrar auditoría`)
  }
})

test('permission wrappers are scope-aware and not executable by anonymous users', async () => {
  const sql = await readRepoFile('supabase/migrations/20260710151417_enforce_permission_and_entity_scope_on_admin_writes.sql')
  const scopeBody = extractFunction(sql, 'app_private.current_user_can_manage_entity')

  assert.match(scopeBody, /join public\.role_permissions/)
  assert.match(scopeBody, /permission_row\.key = p_permission_key/)
  assert.match(scopeBody, /ura\.scope_type = 'diocese'/)
  assert.match(scopeBody, /target_node_lineage/)

  const publicRpcs = [
    'admin_save_position_assignment',
    'admin_save_priest',
    'admin_save_bishop',
    'admin_save_ecclesiastical_entity',
    'admin_save_jurisdiction',
    'admin_save_structure_template',
    'admin_save_structure_level',
    'admin_save_structure_node',
  ]

  for (const rpcName of publicRpcs) {
    const body = extractFunction(sql, `public.${rpcName}`)
    assert.doesNotMatch(body, /security\s+definer/i, `${rpcName} no debe elevar privilegios directamente`)
    assert.match(
      sql,
      new RegExp(`revoke all on function public\\.${escapeRegex(rpcName)}\\(jsonb\\) from public, anon;`),
      `${rpcName} debe revocar acceso anónimo`,
    )
    assert.match(
      sql,
      new RegExp(`grant execute on function public\\.${escapeRegex(rpcName)}\\(jsonb\\) to authenticated;`),
      `${rpcName} debe limitar ejecución a authenticated`,
    )
  }

  const appointmentBody = extractFunction(sql, 'public.admin_save_position_assignment')
  assert.match(appointmentBody, /appointments\.create_proposal/)
  assert.match(appointmentBody, /current_user_can_manage_entity/)

  const priestBody = extractFunction(sql, 'public.admin_save_priest')
  assert.match(priestBody, /people\.create_proposal/)
  assert.match(priestBody, /appointments\.create_proposal/)

  const jurisdictionBody = extractFunction(sql, 'public.admin_save_jurisdiction')
  assert.match(jurisdictionBody, /Solo la administración nacional puede crear jurisdicciones mayores/)

  for (const rpcName of ['admin_save_structure_template', 'admin_save_structure_level', 'admin_save_structure_node']) {
    assert.match(extractFunction(sql, `public.${rpcName}`), /structures\.manage/)
  }
})

test('all person wizards reuse the canonical assignment succession function', async () => {
  const contracts = [
    {
      path: 'supabase/migrations/20260710150600_make_priest_creation_atomic_with_assignment.sql',
      functions: ['internal.admin_save_priest'],
    },
    {
      path: 'supabase/migrations/20260710151859_secure_person_wizards_and_reuse_assignment_flow.sql',
      functions: ['public.admin_save_deacon', 'public.admin_save_layperson', 'public.admin_save_religious'],
    },
    {
      path: 'supabase/migrations/20260710152650_reuse_assignment_flow_for_bishop.sql',
      functions: ['public.admin_save_bishop'],
    },
  ]

  for (const contract of contracts) {
    const sql = await readRepoFile(contract.path)
    for (const functionName of contract.functions) {
      const body = extractFunction(sql, functionName)
      assert.match(body, /internal\.admin_save_position_assignment\(/, `${functionName} debe reutilizar la operación canónica`)
      assert.match(body, /'close_previous_current', true/, `${functionName} debe cerrar el ocupante anterior`)
      assert.doesNotMatch(
        body,
        /insert\s+into\s+public\.position_assignments/i,
        `${functionName} no debe insertar nombramientos directamente`,
      )
    }
  }
})

test('entity and structure node creation remains one atomic database operation', async () => {
  const route = await readRepoFile('src/app/api/admin/estructura/nodo-entidad/route.ts')
  assert.match(route, /admin_create_structure_node_entity/)
  assert.doesNotMatch(route, /admin_save_ecclesiastical_entity/)
  assert.doesNotMatch(route, /admin_save_structure_node/)

  const sql = await readRepoFile('supabase/migrations/20260710152811_make_structure_node_entity_creation_atomic.sql')
  const body = extractFunction(sql, 'public.admin_create_structure_node_entity')
  assert.match(body, /internal\.admin_save_ecclesiastical_entity\(/)
  assert.match(body, /internal\.admin_save_structure_node\(/)
  assert.match(body, /current_user_can_manage_entity\('structures\.manage'/)
  assert.match(body, /current_user_can_manage_entity\('entities\.create_proposal'/)
  assert.match(sql, /revoke all on function public\.admin_create_structure_node_entity\(jsonb\) from public, anon;/)
  assert.match(sql, /grant execute on function public\.admin_create_structure_node_entity\(jsonb\) to authenticated;/)
})

test('administrative audit uses the authenticated audit RPC and an RLS-aware view', async () => {
  const helper = await readRepoFile('src/lib/admin/audit.ts')
  assert.match(helper, /\.rpc\('admin_write_audit_log'/)
  assert.match(helper, /p_action: event\.action/)
  assert.match(helper, /p_target_id: event\.targetId/)
  assert.match(helper, /p_metadata: event\.metadata/)

  const sql = await readRepoFile('supabase/migrations/20260710150400_restore_admin_audit_pipeline.sql')
  const body = extractFunction(sql, 'public.admin_write_audit_log')
  assert.match(body, /security\s+definer/i)
  assert.match(body, /auth\.uid\(\)/)
  assert.match(body, /current_user_has_admin_role\(\)/)
  assert.match(body, /insert into public\.audit_logs/)
  assert.match(sql, /revoke all on function public\.admin_write_audit_log\(text, text, uuid, jsonb\) from public, anon;/)
  assert.match(sql, /with \(security_invoker = true\)/)
})

test('the standard test command executes every test file', async () => {
  const packageJson = JSON.parse(await readRepoFile('package.json'))
  assert.equal(packageJson.scripts.test, 'node --test tests/*.test.mjs')
})
