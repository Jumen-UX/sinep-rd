import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function read(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('form error summary announces errors and moves focus to the selected field', async () => {
  const component = await read('src/components/ui/form-error-summary.tsx')

  assert.match(component, /announce="assertive"/)
  assert.match(component, /tabIndex=\{-1\}/)
  assert.match(component, /document\.getElementById\(fieldId\)/)
  assert.match(component, /field\.focus\(\{ preventScroll: true \}\)/)
  assert.match(component, /field\.scrollIntoView/)
  assert.match(component, /Conservamos los datos válidos/)
})

test('page state distinguishes loading empty no-results and errors', async () => {
  const component = await read('src/components/ui/page-state.tsx')

  assert.match(component, /PageStateKind = 'loading' \| 'error' \| 'empty' \| 'no-results'/)
  assert.match(component, /function LoadingState/)
  assert.match(component, /aria-busy="true"/)
  assert.match(component, /announce="assertive"/)
  assert.match(component, /data-state=\{kind\}/)
  assert.doesNotMatch(component, /aria-busy=\{kind === 'loading'/)
})

test('button exposes a reusable loading contract that prevents duplicate submissions', async () => {
  const component = await read('src/components/ui/button.tsx')

  assert.match(component, /loading\?: boolean/)
  assert.match(component, /loadingLabel\?: string/)
  assert.match(component, /disabled=\{disabled \|\| loading\}/)
  assert.match(component, /aria-busy=\{loading \|\| undefined\}/)
  assert.match(component, /motion-reduce:animate-none/)
})

test('button preserves the Radix Slot single-child contract when rendered asChild', async () => {
  const component = await read('src/components/ui/button.tsx')

  assert.match(component, /if \(asChild\) \{[\s\S]*?<Slot[\s\S]*?>\s*\{children\}\s*<\/Slot>/)
  assert.doesNotMatch(component, /const Comp = asChild \? Slot : 'button'/)
  assert.doesNotMatch(component, /<Slot[\s\S]*?loading &&/)
})

test('alert tone does not force a live region', async () => {
  const component = await read('src/components/ui/alert.tsx')

  assert.match(component, /type AlertAnnouncement = 'off' \| 'polite' \| 'assertive'/)
  assert.match(component, /announce = 'off'/)
  assert.match(component, /announce === 'assertive' \? 'alert' : 'status'/)
  assert.match(component, /actions\?: React\.ReactNode/)
  assert.doesNotMatch(component, /role=\{tone === 'danger'/)
})
