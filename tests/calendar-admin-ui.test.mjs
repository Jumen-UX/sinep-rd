import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readSource(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('calendar service uses only scoped administrative RPCs for mutations and reads', async () => {
  const source = await readSource('src/features/events/services/calendar-admin-service.ts')

  for (const rpc of [
    'admin_list_calendar_scope_options',
    'admin_list_calendar_events',
    'admin_generate_calendar_occurrences',
    'admin_list_event_reminders',
    'admin_save_event_reminder',
    'admin_list_event_visibility_settings',
    'admin_save_event_visibility_setting',
  ]) {
    assert.match(source, new RegExp(`rpc\\('${rpc}'`))
  }

  assert.match(source, /p_scope_entity_id: filters\.scopeEntityId/)
  assert.match(source, /p_scope_entity_id: scopeEntityId/)
  assert.match(source, /scope_entity_id: input\.scopeEntityId/)
  assert.match(source, /diocese_id: input\.dioceseId/)
  assert.doesNotMatch(source, /\.from\('(event_occurrences|commemorative_events|event_reminders|event_visibility_settings|event_notification_logs)'\)\s*\.(insert|update|delete|upsert)/s)
})

test('calendar workspace inherits navigation context and gates sensitive actions by permission', async () => {
  const source = await readSource('src/features/events/admin/CalendarWorkspace.tsx')

  assert.match(source, /useAdminNavigation\(\)/)
  assert.match(source, /context\.activeScope/)
  assert.match(source, /events\.apply/)
  assert.match(source, /events\.manage_reminders/)
  assert.match(source, /events\.manage_visibility/)
  assert.match(source, /selectedScopeSupportsVisibility/)
  assert.match(source, /loadCalendarScopeOptions/)
  assert.match(source, /loadAdminCalendarEvents/)
  assert.match(source, /generateCalendarOccurrences/)
  assert.match(source, /saveEventReminder/)
  assert.match(source, /saveEventVisibilitySetting/)
})

test('calendar workspace exposes accessible territorial filters and status feedback', async () => {
  const source = await readSource('src/features/events/admin/CalendarWorkspace.tsx')

  for (const label of [
    'Ámbito',
    'Año',
    'Mes',
    'Tipo de evento',
    'Información incluida',
    'Recordatorios',
    'Visibilidad por diócesis',
  ]) {
    assert.match(source, new RegExp(label))
  }

  assert.match(source, /role="alert"/)
  assert.match(source, /aria-live="assertive"/)
  assert.match(source, /role="status"/)
  assert.match(source, /aria-live="polite"/)
  assert.match(source, /disabled=\{workingAction !== null/)
  assert.match(source, /No hay entidades autorizadas disponibles/)
})

test('event registry integrates calendar mode without replacing historical workflows', async () => {
  const source = await readSource('src/features/events/admin/EventRegistryPage.tsx')

  assert.match(source, /import CalendarWorkspace from '\.\/CalendarWorkspace'/)
  assert.match(source, /type WorkMode = 'all' \| 'historical' \| 'new' \| 'calendar' \| 'pending'/)
  assert.match(source, /key: 'calendar', title: 'Fechas'/)
  assert.match(source, /workMode !== 'calendar'/)
  assert.match(source, /workMode === 'calendar' \? \(/)
  assert.match(source, /<CalendarWorkspace \/>/)
  assert.match(source, /<EventDetailPanel event=\{selectedEvent\} \/>/)
  assert.match(source, /href="\/admin\/eventos\/nuevo"/)
  assert.match(source, /href="\/admin\/eventos\/pendientes"/)
})

test('events feature barrel exports the calendar service', async () => {
  const source = await readSource('src/features/events/index.ts')
  assert.match(source, /export \* from '\.\/services\/calendar-admin-service'/)
})
