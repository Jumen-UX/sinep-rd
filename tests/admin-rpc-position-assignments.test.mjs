import assert from 'node:assert/strict'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'

/**
 * RPC Transactional Tests (P0 — Admin Wizards)
 * 
 * These tests validate that admin RPCs like admin_save_position_assignment
 * handle complex scenarios without leaving partial records.
 * 
 * Prerequisites:
 * - Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL environment variables
 * - Must have an admin user authenticated (use service role key for these tests)
 * - All migrations must be applied
 */

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

const supabase = getSupabaseClient()

/**
 * Cleanup helper
 */
async function deleteRecord(table, id) {
  if (!id) return
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)
  
  if (error) {
    console.warn(`Warning: Failed to delete ${table}/${id}:`, error.message)
  }
}

/**
 * Create a test person record
 */
async function createTestPerson(overrides = {}) {
  const data = {
    first_name: 'Admin' + Math.random().toString(36).slice(7),
    last_name: 'Prueba',
    display_name: 'Admin Prueba',
    slug: 'admin-prueba-' + Math.random().toString(36).slice(7),
    person_type: 'priest',
    gender: 'male',
    status: 'active',
    ...overrides,
  }

  const { data: result, error } = await supabase
    .from('persons')
    .insert([data])
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create test person: ${error.message}`)
  }

  return result
}

/**
 * Create a test organization chart
 */
async function createTestOrganizationChart(overrides = {}) {
  const data = {
    name: 'OrgChart ' + Math.random().toString(36).slice(7),
    status: 'active',
    ...overrides,
  }

  const { data: result, error } = await supabase
    .from('organization_charts')
    .insert([data])
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create test organization chart: ${error.message}`)
  }

  return result
}

/**
 * Create a test office configuration
 */
async function createTestOfficeConfiguration(organizationChartId, overrides = {}) {
  const data = {
    organization_chart_id: organizationChartId,
    name: 'Cargo ' + Math.random().toString(36).slice(7),
    slug: 'cargo-' + Math.random().toString(36).slice(7),
    status: 'active',
    ...overrides,
  }

  const { data: result, error } = await supabase
    .from('office_configurations')
    .insert([data])
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create test office configuration: ${error.message}`)
  }

  return result
}

/**
 * Call admin_save_position_assignment RPC
 */
async function callSavePositionAssignmentRpc(payload) {
  const { data, error } = await supabase
    .rpc('admin_save_position_assignment', { payload })

  if (error) {
    throw new Error(`RPC error: ${error.message}`)
  }

  return data
}

test('P0.RPC.1: Save position assignment creates record with is_current=true when no end date', async () => {
  const person = await createTestPerson()
  const chart = await createTestOrganizationChart()
  const office = await createTestOfficeConfiguration(chart.id)

  try {
    const payload = {
      person_id: person.id,
      office_configuration_id: office.id,
      organization_chart_id: chart.id,
      assignment_status: 'active',
      selection_method: 'appointment',
      verification_status: 'verified',
      visibility: 'public',
    }

    const result = await callSavePositionAssignmentRpc(payload)

    assert.ok(result.assignment_id, 'RPC should return assignment_id')

    // Verify assignment was created correctly
    const { data: assignment } = await supabase
      .from('position_assignments')
      .select('is_current, assignment_status, person_id')
      .eq('id', result.assignment_id)
      .single()

    assert.ok(assignment.is_current === true, 'Assignment without end_date should be is_current=true')
    assert.equal(assignment.assignment_status, 'active', 'Status should match payload')
    assert.equal(assignment.person_id, person.id, 'Person ID should match')
  } finally {
    await deleteRecord('position_assignments', result?.assignment_id)
    await deleteRecord('office_configurations', office.id)
    await deleteRecord('organization_charts', chart.id)
    await deleteRecord('persons', person.id)
  }
})

test('P0.RPC.2: Save position assignment with actual_end_date sets is_current=false', async () => {
  const person = await createTestPerson()
  const chart = await createTestOrganizationChart()
  const office = await createTestOfficeConfiguration(chart.id)

  try {
    const today = new Date().toISOString().split('T')[0]
    const endDate = new Date(Date.now() - 86400000).toISOString().split('T')[0] // yesterday

    const payload = {
      person_id: person.id,
      office_configuration_id: office.id,
      organization_chart_id: chart.id,
      actual_end_date: endDate,
      assignment_status: 'ended',
      selection_method: 'appointment',
      verification_status: 'verified',
      visibility: 'public',
    }

    const result = await callSavePositionAssignmentRpc(payload)

    const { data: assignment } = await supabase
      .from('position_assignments')
      .select('is_current, assignment_status')
      .eq('id', result.assignment_id)
      .single()

    assert.ok(assignment.is_current === false, 'Assignment with actual_end_date should be is_current=false')
    assert.equal(assignment.assignment_status, 'ended', 'Status should be ended')
  } finally {
    await deleteRecord('position_assignments', result?.assignment_id)
    await deleteRecord('office_configurations', office.id)
    await deleteRecord('organization_charts', chart.id)
    await deleteRecord('persons', person.id)
  }
})

test('P0.RPC.3: Vacant position does not require person_id', async () => {
  const chart = await createTestOrganizationChart()
  const office = await createTestOfficeConfiguration(chart.id)

  try {
    const payload = {
      office_configuration_id: office.id,
      organization_chart_id: chart.id,
      assignment_status: 'vacant',
      selection_method: 'appointment',
      verification_status: 'verified',
      visibility: 'public',
    }

    const result = await callSavePositionAssignmentRpc(payload)

    const { data: assignment } = await supabase
      .from('position_assignments')
      .select('person_id, assignment_status, is_current')
      .eq('id', result.assignment_id)
      .single()

    assert.ok(assignment.person_id === null, 'Vacant assignment should have null person_id')
    assert.equal(assignment.assignment_status, 'vacant', 'Status should be vacant')
    assert.ok(assignment.is_current === true, 'Vacant assignment should be is_current=true')
  } finally {
    await deleteRecord('position_assignments', result?.assignment_id)
    await deleteRecord('office_configurations', office.id)
    await deleteRecord('organization_charts', chart.id)
  }
})

test('P0.RPC.4: close_previous_current flag closes previous current assignments', async () => {
  const person1 = await createTestPerson()
  const person2 = await createTestPerson()
  const chart = await createTestOrganizationChart()
  const office = await createTestOfficeConfiguration(chart.id)

  try {
    // Create first current assignment
    const payload1 = {
      person_id: person1.id,
      office_configuration_id: office.id,
      organization_chart_id: chart.id,
      assignment_status: 'active',
      selection_method: 'appointment',
      verification_status: 'verified',
      visibility: 'public',
    }

    const result1 = await callSavePositionAssignmentRpc(payload1)
    const assign1Id = result1.assignment_id

    // Create second current assignment with close_previous_current=true
    const payload2 = {
      person_id: person2.id,
      office_configuration_id: office.id,
      organization_chart_id: chart.id,
      assignment_status: 'active',
      selection_method: 'appointment',
      verification_status: 'verified',
      visibility: 'public',
      close_previous_current: true,
    }

    const result2 = await callSavePositionAssignmentRpc(payload2)
    const assign2Id = result2.assignment_id

    // Verify first assignment was closed
    const { data: assign1 } = await supabase
      .from('position_assignments')
      .select('is_current, assignment_status, replaced_by_assignment_id')
      .eq('id', assign1Id)
      .single()

    assert.ok(assign1.is_current === false, 'Previous current assignment should be closed')
    assert.equal(assign1.assignment_status, 'replaced', 'Status should be replaced')
    assert.equal(assign1.replaced_by_assignment_id, assign2Id, 'Should reference replacement')

    // Verify second assignment is current
    const { data: assign2 } = await supabase
      .from('position_assignments')
      .select('is_current')
      .eq('id', assign2Id)
      .single()

    assert.ok(assign2.is_current === true, 'New assignment should be current')
  } finally {
    await deleteRecord('position_assignments', result1?.assignment_id)
    await deleteRecord('position_assignments', result2?.assignment_id)
    await deleteRecord('office_configurations', office.id)
    await deleteRecord('organization_charts', chart.id)
    await deleteRecord('persons', person1.id)
    await deleteRecord('persons', person2.id)
  }
})

test('P0.RPC.5: Invalid office_configuration_id is rejected', async () => {
  const person = await createTestPerson()

  try {
    const payload = {
      person_id: person.id,
      office_configuration_id: '00000000-0000-0000-0000-000000000000',
      organization_chart_id: '00000000-0000-0000-0000-000000000000',
      assignment_status: 'active',
      selection_method: 'appointment',
      verification_status: 'verified',
      visibility: 'public',
    }

    try {
      await callSavePositionAssignmentRpc(payload)
      assert.fail('Should have thrown error for invalid office_configuration_id')
    } catch (error) {
      assert.ok(
        error.message.includes('no existe') || error.message.includes('no activo'),
        'Should reject invalid office configuration'
      )
    }
  } finally {
    await deleteRecord('persons', person.id)
  }
})

test('P0.RPC.6: Non-vacant assignment requires person_id', async () => {
  const chart = await createTestOrganizationChart()
  const office = await createTestOfficeConfiguration(chart.id)

  try {
    const payload = {
      office_configuration_id: office.id,
      organization_chart_id: chart.id,
      assignment_status: 'active',
      selection_method: 'appointment',
      verification_status: 'verified',
      visibility: 'public',
      // person_id is intentionally omitted
    }

    try {
      await callSavePositionAssignmentRpc(payload)
      assert.fail('Should have thrown error for missing person_id')
    } catch (error) {
      assert.ok(
        error.message.includes('persona') || error.message.includes('excepto cuando'),
        'Should require person_id for non-vacant assignments'
      )
    }
  } finally {
    await deleteRecord('office_configurations', office.id)
    await deleteRecord('organization_charts', chart.id)
  }
})
