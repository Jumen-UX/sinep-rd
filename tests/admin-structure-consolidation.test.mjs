import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const adminLayout = await readFile('src/app/(admin)/layout.tsx', 'utf8')
const structureStyles = await readFile('src/styles/admin-structure-workflows.css', 'utf8')
const levelOfficePage = await readFile('src/features/structures/admin/LevelOfficeConfigurationPage.tsx', 'utf8')
const hierarchySelector = await readFile('src/components/StructureHierarchySelector.tsx', 'utf8')

test('admin layout loads canonical structural styles without the retired cleanup layer', () => {
  const structureIndex = adminLayout.indexOf("import '@/styles/admin-structure-workflows.css'")
  const compatibilityIndex = adminLayout.indexOf("import '@/styles/admin-theme-compatibility.css'")

  assert.ok(structureIndex >= 0)
  assert.ok(compatibilityIndex > structureIndex)
  assert.doesNotMatch(adminLayout, /admin-embedded-theme-cleanup\.css/)
})

test('structural workflow styles use semantic tokens and responsive layouts', () => {
  assert.match(structureStyles, /\.level-office-page select/)
  assert.match(structureStyles, /\.level-office-row/)
  assert.match(structureStyles, /\.level-office-summary/)
  assert.match(structureStyles, /\.structure-selector-grid/)
  assert.match(structureStyles, /\.structure-selector-field/)
  assert.match(structureStyles, /\.structure-selector-path/)
  assert.match(structureStyles, /var\(--surface\)/)
  assert.match(structureStyles, /var\(--surface-subtle\)/)
  assert.match(structureStyles, /var\(--focus-ring\)/)
  assert.match(structureStyles, /@media \(max-width: 900px\)/)
  assert.doesNotMatch(structureStyles, /!important/)
  assert.doesNotMatch(structureStyles, /background:\s*(?:#fff(?:fff)?|#fbf8f1|white)\b/i)
})

test('level office configuration owns selection feedback and form semantics', () => {
  assert.doesNotMatch(levelOfficePage, /const pageStyles/)
  assert.doesNotMatch(levelOfficePage, /<style>\{pageStyles\}<\/style>/)
  assert.match(levelOfficePage, /level-office-page/)
  assert.match(levelOfficePage, /aria-busy=\{loadingStructure \|\| saving\}/)
  assert.match(levelOfficePage, /role="alert" aria-live="assertive"/)
  assert.match(levelOfficePage, /success-box" role="status" aria-live="polite" aria-atomic="true"/)
  assert.match(levelOfficePage, /aria-pressed=\{selectedLevelId === level\.id\}/)
  assert.match(levelOfficePage, /<fieldset className="level-office-fieldset"/)
  assert.match(levelOfficePage, /<legend>Cargos disponibles para el nivel<\/legend>/)
  assert.match(levelOfficePage, /level-office-summary" aria-live="polite" aria-atomic="true"/)
  assert.match(levelOfficePage, /type="submit"/)
})

test('hierarchy selector owns unique labels errors and selected-path announcements', () => {
  assert.doesNotMatch(hierarchySelector, /const componentStyles/)
  assert.doesNotMatch(hierarchySelector, /<style>\{componentStyles\}<\/style>/)
  assert.match(hierarchySelector, /useId/)
  assert.match(hierarchySelector, /aria-busy=\{loadingBase \|\| loadingTree\}/)
  assert.match(hierarchySelector, /aria-labelledby=\{headingId\}/)
  assert.match(hierarchySelector, /className="structure-selector-field"/)
  assert.match(hierarchySelector, /htmlFor=\{dioceseSelectId\}/)
  assert.match(hierarchySelector, /htmlFor=\{templateSelectId\}/)
  assert.match(hierarchySelector, /htmlFor=\{nodeSelectId\}/)
  assert.match(hierarchySelector, /id=\{errorId\} role="alert" aria-live="assertive"/)
  assert.match(hierarchySelector, /aria-controls=\{pathId\}/)
  assert.match(hierarchySelector, /id=\{pathId\} role="status" aria-live="polite" aria-atomic="true"/)
})
