import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const componentPath = new URL('../src/features/personas/admin/PersonAssignmentHistory.tsx', import.meta.url)
const pagePath = new URL('../src/features/personas/admin/PersonDetailPage.tsx', import.meta.url)

test('person detail exposes canonical assignment history and succession links', async () => {
  const [component, page] = await Promise.all([
    readFile(componentPath, 'utf8'),
    readFile(pagePath, 'utf8'),
  ])

  assert.match(component, /public_position_assignments_with_hierarchy/)
  assert.match(component, /\.eq\('person_id', personId\)/)
  assert.match(component, /position_title/)
  assert.match(component, /actual_end_date/)
  assert.match(component, /predecessor_person_name/)
  assert.match(component, /successor_person_name/)
  assert.match(component, /href=\{`\/entidades\/\$\{entitySlug\}`\}/)
  assert.match(component, /href=\{`\/personas\/\$\{slug\}`\}/)
  assert.match(component, /aria-labelledby="person-assignment-history-title"/)

  assert.match(page, /import PersonAssignmentHistory/)
  assert.match(page, /<PersonAssignmentHistory\s+personId=\{person\.person_id\}\s+onItemsChange=\{setAssignments\}\s*\/>/)
  assert.match(page, /href="#nombramientos"/)
})
