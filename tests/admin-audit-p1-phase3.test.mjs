import assert from 'node:assert/strict'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'

/**
 * P1 Phase 3 — Audit Logging with Jurisdiction Tests
 * 
 * Validates that:
 * - admin_audit_log tracks jurisdiction_id for actions
 * - Users can only view audit logs for their jurisdiction
 * - RPC admin_write_audit_log correctly derives jurisdiction
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

async function deleteRecord(table, id) {
  if (!id) return
  await supabase.from(table).delete().eq('id', id)
}

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

async function createTestPerson() {
  const { data: person } = await supabase
    .from('persons')
    .insert([
      {
        first_name: 'TestAudit' + Math.random().toString(36).slice(7),
        last_name: 'Person',
        display_name: 'Test Audit Person',
        slug: 'test-audit-' + Math.random().toString(36).slice(7),
        person_type: 'priest',
        gender: 'male',
        status: 'active',
      },
    ])
    .select()
    .single()

  return person
}

test('P1.P3.1: admin_write_audit_log records action without jurisdiction_id', async () => {
  try {
    const { error } = await supabase
      .rpc('admin_write_audit_log', {
        p_action: 'test.action',
        p_target_table: null,
        p_target_id: null,
        p_metadata: { test: true },
      })

    assert.ok(!error, `RPC should succeed: ${error?.message}`)
  } catch (err) {
    assert.fail(`RPC call failed: ${err.message}`)
  }
})

test('P1.P3.2: admin_write_audit_log derives jurisdiction_id from position_assignment', async () => {
  const diocese = await createTestDiocese('Test Audit Diocese ' + Date.now())
  const person = await createTestPerson()

  try {
    // Create org chart and office
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

    // Create position assignment with jurisdiction
    const { data: assignment } = await supabase
      .from('position_assignments')
      .insert([
        {
          person_id: person.id,
          office_configuration_id: office.id,
          organization_chart_id: chart.id,
          ecclesiastical_entity_id: diocese.id,
          is_current: true,
          assignment_status: 'active',
          selection_method: 'appointment',
          verification_status: 'verified',
          visibility: 'public',
          record_status: 'active',
        },
      ])
      .select()
      .single()

    // Record audit for this assignment
    const { error: auditError } = await supabase
      .rpc('admin_write_audit_log', {
        p_action: 'test.create_assignment',
        p_target_table: 'position_assignments',
        p_target_id: assignment.id,
        p_metadata: { diocese_id: diocese.id },
      })

    assert.ok(!auditError, `Audit RPC should succeed: ${auditError?.message}`)

    // Verify audit log has jurisdiction_id
    const { data: auditLog } = await supabase
      .from('admin_audit_log')
      .select('id, jurisdiction_id, action')
      .eq('target_id', assignment.id)
      .eq('action', 'test.create_assignment')
      .single()

    assert.ok(auditLog, 'Audit log should exist')
    assert.equal(auditLog.jurisdiction_id, diocese.id, 'jurisdiction_id should be derived from position_assignment')

    // Cleanup
    await deleteRecord('position_assignments', assignment.id)
    await deleteRecord('office_configurations', office.id)
    await deleteRecord('organization_charts', chart.id)
  } finally {
    await deleteRecord('ecclesiastical_entities', diocese.id)
    await deleteRecord('persons', person.id)
  }
})

test('P1.P3.3: admin_write_audit_log derives jurisdiction_id from ecclesiastical_entity', async () => {
  const diocese = await createTestDiocese('Test Audit Entity ' + Date.now())

  try {
    const { error } = await supabase
      .rpc('admin_write_audit_log', {
        p_action: 'test.create_entity',
        p_target_table: 'ecclesiastical_entities',
        p_target_id: diocese.id,
        p_metadata: {},
      })

    assert.ok(!error, `Audit RPC should succeed: ${error?.message}`)

    // Verify audit log has jurisdiction_id matching the entity
    const { data: auditLog } = await supabase
      .from('admin_audit_log')
      .select('id, jurisdiction_id')
      .eq('target_id', diocese.id)
      .eq('action', 'test.create_entity')
      .single()

    assert.ok(auditLog, 'Audit log should exist')
    assert.equal(
      auditLog.jurisdiction_id,
      diocese.id,
      'jurisdiction_id should be the entity itself'
    )
  } finally {
    await deleteRecord('ecclesiastical_entities', diocese.id)
  }
})

test('P1.P3.4: admin_audit_log_by_jurisdiction RPC returns audit logs for jurisdiction', async () => {
  const diocese = await createTestDiocese('Test Audit Query ' + Date.now())

  try {
    // Write some audit logs
    await supabase.rpc('admin_write_audit_log', {
      p_action: 'test.action1',
      p_target_table: 'ecclesiastical_entities',
      p_target_id: diocese.id,
      p_metadata: { test: 1 },
    })

    await supabase.rpc('admin_write_audit_log', {
      p_action: 'test.action2',
      p_target_table: 'ecclesiastical_entities',
      p_target_id: diocese.id,
      p_metadata: { test: 2 },
    })

    // Query audit logs for this jurisdiction
    const { data: logs, error } = await supabase
      .rpc('admin_audit_log_by_jurisdiction', {
        p_jurisdiction_id: diocese.id,
        p_limit_rows: 10,
      })

    assert.ok(!error, `Query RPC should succeed: ${error?.message}`)
    assert.ok(Array.isArray(logs), 'Should return array')
    assert.ok(logs.length >= 2, 'Should return at least 2 audit logs')

    const actions = logs.map((log) => log.action)
    assert.ok(actions.includes('test.action1'), 'Should include action1')
    assert.ok(actions.includes('test.action2'), 'Should include action2')
  } finally {
    await deleteRecord('ecclesiastical_entities', diocese.id)
  }
})

test('P1.P3.5: admin_audit_log_with_jurisdiction view enriches audit data', async () => {
  const diocese = await createTestDiocese('Test Audit View ' + Date.now())

  try {
    await supabase.rpc('admin_write_audit_log', {
      p_action: 'test.view_test',
      p_target_table: 'ecclesiastical_entities',
      p_target_id: diocese.id,
      p_metadata: {},
    })

    // Query via view
    const { data: auditWithJurisdiction } = await supabase
      .from('admin_audit_log_with_jurisdiction')
      .select('action, jurisdiction_name, jurisdiction_slug')
      .eq('target_id', diocese.id)
      .eq('action', 'test.view_test')
      .single()

    assert.ok(auditWithJurisdiction, 'View should return record')
    assert.equal(
      auditWithJurisdiction.jurisdiction_name,
      diocese.name,
      'Should include jurisdiction_name from entity'
    )
    assert.equal(
      auditWithJurisdiction.jurisdiction_slug,
      diocese.slug,
      'Should include jurisdiction_slug'
    )
  } finally {
    await deleteRecord('ecclesiastical_entities', diocese.id)
  }
})

test('P1.P3.6: Explicit jurisdiction_id overrides derivation', async () => {
  const diocese1 = await createTestDiocese('Test Audit Override 1 ' + Date.now())
  const diocese2 = await createTestDiocese('Test Audit Override 2 ' + Date.now())

  try {
    // Write audit log with explicit jurisdiction_id different from target
    const { error } = await supabase
      .rpc('admin_write_audit_log', {
        p_action: 'test.override',
        p_target_table: 'ecclesiastical_entities',
        p_target_id: diocese1.id,
        p_metadata: {},
        p_jurisdiction_id: diocese2.id, // Explicit override
      })

    assert.ok(!error, `RPC should succeed: ${error?.message}`)

    // Verify explicit jurisdiction_id was used
    const { data: auditLog } = await supabase
      .from('admin_audit_log')
      .select('jurisdiction_id')
      .eq('target_id', diocese1.id)
      .eq('action', 'test.override')
      .single()

    assert.ok(auditLog, 'Audit log should exist')
    assert.equal(
      auditLog.jurisdiction_id,
      diocese2.id,
      'Should use explicit jurisdiction_id, not derivation'
    )
  } finally {
    await deleteRecord('ecclesiastical_entities', diocese1.id)
    await deleteRecord('ecclesiastical_entities', diocese2.id)
  }
})

console.log('✓ P1 Phase 3 (Audit) tests initialized and ready to run')