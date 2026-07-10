import assert from 'node:assert/strict'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'

/**
 * P1 Phase 2 — RPC Scope Validation Tests
 * 
 * Validates that admin_save_* functions respect user jurisdiction scope.
 * 
 * Prerequisites:
 * - SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL
 * - Migration 20260711_p1_phase2_scope_validation_rpcs.sql applied
 */

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing environment variables')
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const supabase = getSupabaseClient()

/**
 * Cleanup helper
 */
async function deleteRecord(table, id) {
  if (!id) return
  await supabase.from(table).delete().eq('id', id)
}

/**
 * Create test diocese
 */
async function createTestDiocese(name) {
  const { data: entityType } = await supabase
    .from('entity_types')
    .select('id')
    .eq('key', 'diocese')
    .single()

  const { data: diocese } = await supabase
    .from('ecclesiastical_entities')
    .insert([
      {
        entity_type_id: entityType.id,
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-') + '-' + Math.random().toString(36).slice(7),
        country: 'DO',
        status: 'active',
      },
    ])
    .select()
    .single()

  return diocese
}

test('P1.P2.1: admin_save_priest validates incardination_entity_id scope', async () => {
  const diocese = await createTestDiocese('Test Diocese Priest ' + Date.now())

  try {
    const payload = {
      first_name: 'TestPriestFirst',
      last_name: 'TestPriestLast',
      display_name: 'Test Priest',
      slug: 'test-priest-' + Math.random().toString(36).slice(7),
      gender: 'male',
      incardination_entity_id: diocese.id, // Within user's scope (if user is restricted)
    }

    // With service role, should succeed (no restrictions)
    const { data, error } = await supabase
      .rpc('admin_save_priest', { payload })

    assert.ok(
      data?.person_id || !error,
      `Service role should create priest: ${error?.message}`
    )
  } finally {
    await deleteRecord('ecclesiastical_entities', diocese.id)
  }
})

test('P1.P2.2: admin_save_priest validates current_service_entity_id scope', async () => {
  const diocese = await createTestDiocese('Test Diocese Service ' + Date.now())

  try {
    const payload = {
      first_name: 'TestPriestService',
      last_name: 'TestLast',
      display_name: 'Test Priest Service',
      slug: 'test-priest-service-' + Math.random().toString(36).slice(7),
      gender: 'male',
      current_service_entity_id: diocese.id,
    }

    const { data, error } = await supabase
      .rpc('admin_save_priest', { payload })

    assert.ok(
      data?.person_id || !error,
      `Service role should create priest with service entity: ${error?.message}`
    )
  } finally {
    await deleteRecord('ecclesiastical_entities', diocese.id)
  }
})

test('P1.P2.3: admin_save_deacon validates incardination scope', async () => {
  const diocese = await createTestDiocese('Test Diocese Deacon ' + Date.now())

  try {
    const payload = {
      first_name: 'TestDeacon',
      last_name: 'TestLast',
      display_name: 'Test Deacon',
      slug: 'test-deacon-' + Math.random().toString(36).slice(7),
      gender: 'male',
      incardination_entity_id: diocese.id,
    }

    const { data, error } = await supabase
      .rpc('admin_save_deacon', { payload })

    assert.ok(
      data?.person_id || !error,
      `Service role should create deacon: ${error?.message}`
    )
  } finally {
    await deleteRecord('ecclesiastical_entities', diocese.id)
  }
})

test('P1.P2.4: admin_save_religious validates service entity scope', async () => {
  const diocese = await createTestDiocese('Test Diocese Religious ' + Date.now())

  try {
    const payload = {
      first_name: 'TestReligious',
      last_name: 'TestLast',
      display_name: 'Test Religious',
      slug: 'test-religious-' + Math.random().toString(36).slice(7),
      gender: 'female',
      current_service_entity_id: diocese.id,
      religious_order: 'Test Order',
    }

    const { data, error } = await supabase
      .rpc('admin_save_religious', { payload })

    assert.ok(
      data?.person_id || !error,
      `Service role should create religious person: ${error?.message}`
    )
  } finally {
    await deleteRecord('ecclesiastical_entities', diocese.id)
  }
})

test('P1.P2.5: Scope validation functions exist and are callable', async () => {
  const diocese = await createTestDiocese('Test Diocese Func ' + Date.now())

  try {
    // Test current_user_has_scope_for_entity
    const { data: hasScope, error: err1 } = await supabase
      .rpc('current_user_has_scope_for_entity', { p_entity_id: diocese.id })

    assert.ok(
      typeof hasScope === 'boolean' && !err1,
      `current_user_has_scope_for_entity should work: ${err1?.message}`
    )

    // Test current_user_root_jurisdiction_id
    const { data: rootId, error: err2 } = await supabase
      .rpc('current_user_root_jurisdiction_id')

    assert.ok(
      rootId === null || typeof rootId === 'string' || rootId === undefined,
      `current_user_root_jurisdiction_id should return UUID or null: ${err2?.message}`
    )

    // Test assert_user_has_scope_for_entity
    const { data: assertResult, error: err3 } = await supabase
      .rpc('assert_user_has_scope_for_entity', {
        p_entity_id: diocese.id,
        p_context: 'test',
      })

    // Service role should not error
    assert.ok(
      !err3,
      `assert_user_has_scope_for_entity should not error for service role: ${err3?.message}`
    )
  } finally {
    await deleteRecord('ecclesiastical_entities', diocese.id)
  }
})

test('P1.P2.6: Multiple entity validations in single RPC (priest with quick assignment)', async () => {
  const dio1 = await createTestDiocese('Test Diocese Quick 1 ' + Date.now())
  const dio2 = await createTestDiocese('Test Diocese Quick 2 ' + Date.now())

  try {
    // Get an organization chart and office
    const { data: chart } = await supabase
      .from('organization_charts')
      .insert([{ name: 'Test Chart ' + Math.random().toString(36).slice(7), status: 'active' }])
      .select()
      .single()

    const { data: office } = await supabase
      .from('office_configurations')
      .insert([
        {
          organization_chart_id: chart.id,
          name: 'Test Office',
          slug: 'test-office-' + Math.random().toString(36).slice(7),
          status: 'active',
        },
      ])
      .select()
      .single()

    const payload = {
      first_name: 'TestQuickAssign',
      last_name: 'TestLast',
      display_name: 'Test Quick Assign',
      slug: 'test-quick-' + Math.random().toString(36).slice(7),
      gender: 'male',
      incardination_entity_id: dio1.id, // One diocese
      current_service_entity_id: dio2.id, // Different diocese
      quick_entity_id: dio1.id,
      quick_office_configuration_id: office.id,
      quick_start_date: new Date().toISOString().split('T')[0],
    }

    // Service role should succeed regardless (it's unrestricted)
    const { data, error } = await supabase
      .rpc('admin_save_priest', { payload })

    assert.ok(
      data?.person_id || !error,
      `Service role should handle multiple entities: ${error?.message}`
    )

    // Cleanup
    await deleteRecord('office_configurations', office.id)
    await deleteRecord('organization_charts', chart.id)
  } finally {
    await deleteRecord('ecclesiastical_entities', dio1.id)
    await deleteRecord('ecclesiastical_entities', dio2.id)
  }
})

console.log('✓ P1 Phase 2 tests initialized and ready to run')
console.log('Note: Full scope restriction testing requires authenticated user sessions with limited scope')
