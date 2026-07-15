import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'

const managerPath = 'src/features/appointments/admin/AssignmentManagerPage.tsx'
const servicePath = 'src/features/appointments/services/assignment-admin-service.ts'
const migrationsPath = 'supabase/migrations'

async function readMigrationCorpus() {
  const files = (await readdir(migrationsPath))
    .filter((file) => file.endsWith('.sql'))
    .sort()

  return Promise.all(files.map((file) => readFile(`${migrationsPath}/${file}`, 'utf8')))
    .then((parts) => parts.join('\n'))
}

test('assignment manager exposes explicit vacancy replacement renewal suspension and closure states', async () => {
  const source = await readFile(managerPath, 'utf8')

  for (const status of [
    "['active', 'Activo']",
    "['term_expired_still_serving', 'Período vencido, continúa en funciones']",
    "['renewed', 'Renovado']",
    "['replaced', 'Sustituido']",
    "['vacant', 'Vacante']",
    "['suspended', 'Suspendido']",
    "['ended', 'Finalizado']",
  ]) {
    assert.match(source, new RegExp(status.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  assert.match(source, /const requiresPerson = assignmentStatus !== 'vacant'/)
  assert.match(source, /person_id: requiresPerson \? selectedPersonId : null/)
})

test('assignment workflow preserves period closure and succession evidence', async () => {
  const [manager, service, migrations] = await Promise.all([
    readFile(managerPath, 'utf8'),
    readFile(servicePath, 'utf8'),
    readMigrationCorpus(),
  ])

  for (const field of [
    'term_start_date',
    'term_end_date',
    'actual_end_date',
    'predecessor_assignment_id',
    'successor_assignment_id',
    'assignment_status',
  ]) {
    assert.match(manager, new RegExp(field))
  }

  assert.match(service, /predecessor_person_name/)
  assert.match(service, /successor_person_name/)
  assert.match(service, /actual_end_date/)
  assert.match(service, /assignment_status/)

  assert.match(migrations, /predecessor_assignment_id/i)
  assert.match(migrations, /successor_assignment_id/i)
  assert.match(migrations, /actual_end_date/i)
  assert.match(migrations, /is_current/i)
  assert.match(migrations, /close_previous_current/i)
})

test('single-holder succession is automatic while multiple-holder closure remains explicit', async () => {
  const source = await readFile(managerPath, 'utf8')

  assert.match(source, /holder_cardinality === 'single'/)
  assert.match(source, /El titular anterior se cerrará automáticamente/)
  assert.match(source, /holder_cardinality === 'multiple'/)
  assert.match(source, /name="close_previous_current"/)
  assert.match(source, /close_previous_current: selectedConfig\?\.holder_cardinality === 'multiple'/)
})
