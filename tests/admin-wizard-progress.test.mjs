import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const progressSource = await readFile(
  new URL('../src/components/admin/AdminWizardProgress.tsx', import.meta.url),
  'utf8',
)

test('wizard progress supports an explicit reachable-step boundary', () => {
  assert.match(progressSource, /maxReachableStep\?: number/)
  assert.match(progressSource, /maxReachableStep = currentStep/)
  assert.match(progressSource, /index <= reachableStep/)
})

test('wizard progress keeps inaccessible future steps non-interactive', () => {
  assert.match(progressSource, /const canNavigate = Boolean\(onStepChange\) && index <= reachableStep/)
  assert.match(progressSource, /canNavigate \? \(/)
  assert.match(progressSource, /opacity-70/)
})


test('wizard progress offers an opt-in compact mobile disclosure', () => {
  assert.match(progressSource, /compactOnMobile\?: boolean/)
  assert.match(progressSource, /compactOnMobile = false/)
  assert.match(progressSource, /<details className="xl:hidden">/)
  assert.match(progressSource, /Ver todos los pasos/)
  assert.match(progressSource, /<ol className="hidden gap-1 xl:grid">/)
})
