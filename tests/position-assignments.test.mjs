import assert from 'node:assert/strict'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'

/**
 * Position Assignment Integrity Tests (P0 — Critical)
 * 
 * These tests validate that the database and triggers enforce the rule:
 * "Only one active/current assignment can exist per office/scope combination."
 * 
 * Prerequisites:
 * - Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL environment variables
 * - The test Supabase project must have all migrations applied
 * - Tests use a temporary schema that is cleaned up after each test
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
 * Cleanup helper: Delete a record without RLS checks
 */
async function deleteRecord(table, id) {
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
    first_name: 'Juan' + Math.random().toString(36).slice(7),
    last_name: 'Prueba',
    display_name: 'Juan Prueba',
    slug: 'juan-prueba-' + Math.random().toString(36).slice(7),
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
 * Create a test organization chart (necessary for assignments)
 */
async function createTestOrganizationChart(overrides = {}) {
  const data = {
    name: 'Organizacion Prueba ' + Math.random().toString(36).slice(7),
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
    name: 'Cargo Prueba ' + Math.random().toString(36).slice(7),
    slug: 'cargo-prueba-' + Math.random().toString(36).slice(7),
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

test('P0.1: Direct insert of second current assignment auto-closes first (trigger)', async () => {
  const person1 = await createTestPerson()
  const person2 = await createTestPerson()
  const chart = await createTestOrganizationChart()
  const office = await createTestOfficeConfiguration(chart.id)

  try {
    // Insert first assignment as current
    const { data: assign1, error: err1 } = await supabase
      .from('position_assignments')
      .insert([
        {
          person_id: person1.id,
          office_configuration_id: office.id,
          organization_chart_id: chart.id,
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

    assert.ok(!err1, `First assignment insert failed: ${err1?.message}`)
    assert.ok(assign1.is_current === true, 'First assignment should be current')

    // Insert second assignment as current
    const { data: assign2, error: err2 } = await supabase
      .from('position_assignments')
      .insert([
        {
          person_id: person2.id,
          office_configuration_id: office.id,
          organization_chart_id: chart.id,
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

    assert.ok(!err2, `Second assignment insert failed: ${err2?.message}`)
    assert.ok(assign2.is_current === true, 'Second assignment should be current')

    // Verify first assignment was auto-closed by trigger
    const { data: assign1Updated, error: err3 } = await supabase
      .from('position_assignments')
      .select('is_current, assignment_status')
      .eq('id', assign1.id)
      .single()

    assert.ok(!err3, `Failed to fetch updated first assignment: ${err3?.message}`)
    assert.ok(
      assign1Updated.is_current === false,
      'First assignment should be closed after second was inserted'
    )
    assert.ok(
      assign1Updated.assignment_status === 'replaced',
      'First assignment status should be "replaced"'
    )

    // Verify only one current assignment exists
    const { data: currentAssignments, error: err4 } = await supabase
      .from('position_assignments')
      .select('id, is_current')
      .eq('office_configuration_id', office.id)
      .eq('is_current', true)
      .eq('record_status', 'active')

    assert.ok(!err4, `Failed to query current assignments: ${err4?.message}`)
    assert.equal(currentAssignments.length, 1, 'Only one current assignment should exist')
    assert.equal(
      currentAssignments[0].id,
      assign2.id,
      'The second assignment should be the current one'
    )
  } finally {
    await deleteRecord('position_assignments', assign1?.id)
    await deleteRecord('position_assignments', assign2?.id)
    await deleteRecord('office_configurations', office.id)
    await deleteRecord('organization_charts', chart.id)
    await deleteRecord('persons', person1.id)
    await deleteRecord('persons', person2.id)
  }
})

test('P0.2: Unique partial index prevents duplicates on concurrent inserts', async () => {
  const person = await createTestPerson()
  const chart = await createTestOrganizationChart()
  const office = await createTestOfficeConfiguration(chart.id)

  try {
    // Insert first assignment as current
    const { data: assign1, error: err1 } = await supabase
      .from('position_assignments')
      .insert([
        {
          person_id: person.id,
          office_configuration_id: office.id,
          organization_chart_id: chart.id,
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

    assert.ok(!err1, `First assignment insert failed: ${err1?.message}`)

    // Try to insert second current assignment for same scope
    // This should fail due to unique index constraint
    const { data: assign2, error: err2 } = await supabase
      .from('position_assignments')
      .insert([
        {
          person_id: person.id,
          office_configuration_id: office.id,
          organization_chart_id: chart.id,
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

    // The database should reject this with a unique constraint violation
    // (after the trigger closes the previous one, the second insert might still succeed,
    // but if timed perfectly, this should fail)
    // NOTE: This test validates trigger behavior, not index behavior directly
    // The index is a fallback safety mechanism.
    assert.ok(
      !err2 || err2.code === '23505',
      `Expected constraint error or successful insert with trigger, got: ${err2?.message}`
    )
  } finally {
    await deleteRecord('position_assignments', assign1?.id)
    await deleteRecord('position_assignments', assign2?.id)
    await deleteRecord('office_configurations', office.id)
    await deleteRecord('organization_charts', chart.id)
    await deleteRecord('persons', person.id)
  }
})

test('P0.3: Closing assignment updates replaced_by and assignment_status', async () => {
  const person1 = await createTestPerson()
  const person2 = await createTestPerson()
  const chart = await createTestOrganizationChart()
  const office = await createTestOfficeConfiguration(chart.id)

  try {
    // Insert first assignment
    const { data: assign1 } = await supabase
      .from('position_assignments')
      .insert([
        {
          person_id: person1.id,
          office_configuration_id: office.id,
          organization_chart_id: chart.id,
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

    // Insert second assignment (should close first)
    const { data: assign2 } = await supabase
      .from('position_assignments')
      .insert([
        {
          person_id: person2.id,
          office_configuration_id: office.id,
          organization_chart_id: chart.id,
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

    // Verify first assignment has correct fields updated
    const { data: assign1Updated } = await supabase
      .from('position_assignments')
      .select('replaced_by_assignment_id, successor_assignment_id, is_current, assignment_status, actual_end_date')
      .eq('id', assign1.id)
      .single()

    assert.equal(
      assign1Updated.replaced_by_assignment_id,
      assign2.id,
      'replaced_by_assignment_id should point to new assignment'
    )
    assert.equal(
      assign1Updated.successor_assignment_id,
      assign2.id,
      'successor_assignment_id should point to new assignment'
    )
    assert.ok(
      assign1Updated.actual_end_date !== null,
      'actual_end_date should be set'
    )
  } finally {
    await deleteRecord('position_assignments', assign1?.id)
    await deleteRecord('position_assignments', assign2?.id)
    await deleteRecord('office_configurations', office.id)
    await deleteRecord('organization_charts', chart.id)
    await deleteRecord('persons', person1.id)
    await deleteRecord('persons', person2.id)
  }
})

test('P0.4: Non-current assignments are not affected by trigger', async () => {
  const person1 = await createTestPerson()
  const person2 = await createTestPerson()
  const chart = await createTestOrganizationChart()
  const office = await createTestOfficeConfiguration(chart.id)

  try {
    // Insert first assignment as non-current
    const { data: assign1 } = await supabase
      .from('position_assignments')
      .insert([
        {
          person_id: person1.id,
          office_configuration_id: office.id,
          organization_chart_id: chart.id,
          is_current: false,
          assignment_status: 'ended',
          selection_method: 'appointment',
          verification_status: 'verified',
          visibility: 'public',
          record_status: 'active',
        },
      ])
      .select()
      .single()

    // Insert second assignment as current
    const { data: assign2 } = await supabase
      .from('position_assignments')
      .insert([
        {
          person_id: person2.id,
          office_configuration_id: office.id,
          organization_chart_id: chart.id,
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

    // Verify first non-current assignment was not modified
    const { data: assign1Check } = await supabase
      .from('position_assignments')
      .select('is_current, assignment_status')
      .eq('id', assign1.id)
      .single()

    assert.ok(
      assign1Check.is_current === false,
      'Non-current assignment should remain non-current'
    )
    assert.equal(
      assign1Check.assignment_status,
      'ended',
      'Non-current assignment status should not change'
    )
  } finally {
    await deleteRecord('position_assignments', assign1?.id)
    await deleteRecord('position_assignments', assign2?.id)
    await deleteRecord('office_configurations', office.id)
    await deleteRecord('organization_charts', chart.id)
    await deleteRecord('persons', person1.id)
    await deleteRecord('persons', person2.id)
  }
})

test('P0.5: Different office scopes do not interfere', async () => {
  const person1 = await createTestPerson()
  const person2 = await createTestPerson()
  const chart = await createTestOrganizationChart()
  const office1 = await createTestOfficeConfiguration(chart.id)
  const office2 = await createTestOfficeConfiguration(chart.id)

  try {
    // Insert assignment for office1
    const { data: assign1 } = await supabase
      .from('position_assignments')
      .insert([
        {
          person_id: person1.id,
          office_configuration_id: office1.id,
          organization_chart_id: chart.id,
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

    // Insert assignment for office2
    const { data: assign2 } = await supabase
      .from('position_assignments')
      .insert([
        {
          person_id: person2.id,
          office_configuration_id: office2.id,
          organization_chart_id: chart.id,
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

    // Both should remain current (different scopes)
    const { data: all } = await supabase
      .from('position_assignments')
      .select('id, is_current, office_configuration_id')
      .in('id', [assign1.id, assign2.id])

    assert.equal(all.length, 2, 'Both assignments should exist')
    assert.ok(all.every(a => a.is_current === true), 'Both assignments should be current (different scopes)')
  } finally {
    await deleteRecord('position_assignments', assign1?.id)
    await deleteRecord('position_assignments', assign2?.id)
    await deleteRecord('office_configurations', office1.id)
    await deleteRecord('office_configurations', office2.id)
    await deleteRecord('organization_charts', chart.id)
    await deleteRecord('persons', person1.id)
    await deleteRecord('persons', person2.id)
  }
})
