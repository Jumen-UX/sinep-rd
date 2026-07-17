import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const notice = await readFile('src/components/admin/AdminStatusNotice.tsx', 'utf8')

test('admin status notices expose atomic live regions with appropriate priority', () => {
  assert.match(notice, /aria-atomic="true"/)
  assert.match(notice, /aria-live=\{isError \? 'assertive' : 'polite'\}/)
  assert.match(notice, /role=\{isError \? 'alert' : 'status'\}/)
})

test('admin status notices support busy state and field association', () => {
  assert.match(notice, /busy\?: boolean/)
  assert.match(notice, /id\?: string/)
  assert.match(notice, /aria-busy=\{busy \|\| undefined\}/)
  assert.match(notice, /id=\{id\}/)
})
