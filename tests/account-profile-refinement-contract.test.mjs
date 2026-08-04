import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const formPath = new URL('../src/features/account/AccountProfileForm.tsx', import.meta.url)
const pagePath = new URL('../src/app/(account)/cuenta/perfil/page.tsx', import.meta.url)
const stylesPath = new URL('../src/features/account/account-profile.module.css', import.meta.url)
async function read(path){return readFile(path,'utf8')}

test('profile workspace exposes one completion summary and actionable checklist',async()=>{
  const [form,page]=await Promise.all([read(formPath),read(pagePath)])
  assert.match(page,/<AccountProfileForm profile=\{profile\}/)
  assert.match(form,/profile-identity-title/)
  assert.match(form,/profile-completion-title/)
  assert.match(form,/Completitud del perfil/)
  assert.match(form,/Revisión de datos/)
  assert.match(form,/completionFields\.map/)
  assert.match(form,/href=\{field\.target\}/)
  assert.match(form,/>Completar<\/a>/)
  assert.match(form,/La vinculación con una ficha eclesial es opcional/)
})

test('profile state is normalized and never reports initial changes',async()=>{
  const form=await read(formPath)
  assert.match(form,/function normalizeValue/)
  assert.match(form,/function normalizeForm/)
  assert.match(form,/const \[baseline,setBaseline\]/)
  assert.match(form,/JSON\.stringify\(normalizedForm\)!==JSON\.stringify\(normalizeForm\(baseline\)\)/)
  assert.match(form,/setBaseline\(saved\)/)
  assert.match(form,/\(isDirty\|\|saving\)\?/) 
})

test('profile form validates https photos without blocking unrelated edits',async()=>{
  const form=await read(formPath)
  assert.match(form,/IMAGE_PATH_PATTERN/)
  assert.match(form,/parsed\.protocol!=='https:'/)
  assert.match(form,/La URL es válida, pero no parece apuntar directamente a una imagen/)
  assert.match(form,/avatarInspection\.previewable/)
  assert.match(form,/const canSubmit=isDirty&&!saving/)
})

test('profile protected email is rendered as data rather than disabled input',async()=>{
  const form=await read(formPath)
  assert.match(form,/styles\.protectedField/)
  assert.match(form,/styles\.protectedBadge/)
  assert.match(form,/styles\.protectedValue/)
  assert.match(form,/<LockIcon\/>Protegido/)
  assert.doesNotMatch(form,/<input disabled type="email"/)
})

test('profile protected icon remains compact despite global svg rules',async()=>{
  const styles=await read(stylesPath)
  assert.match(styles,/\.protectedBadge>\.lockIcon\{[^}]*width:14px!important/s)
  assert.match(styles,/\.protectedBadge>\.lockIcon\{[^}]*height:14px!important/s)
  assert.match(styles,/\.protectedBadge>\.lockIcon\{[^}]*max-width:14px!important/s)
  assert.match(styles,/\.protectedBadge>\.lockIcon\{[^}]*flex:0 0 14px!important/s)
})

test('profile preferences use controlled locale and IANA timezone suggestions',async()=>{
  const form=await read(formPath)
  assert.match(form,/TIMEZONE_OPTIONS/)
  assert.match(form,/list="account-timezones"/)
  assert.match(form,/<datalist id="account-timezones">/)
  assert.match(form,/America\/Santo_Domingo/)
  assert.match(form,/value=\{form\.preferredLocale\}/)
  assert.match(form,/value=\{form\.timezone\}/)
})

test('profile presentation uses consistent cards checklist and responsive rules',async()=>{
  const styles=await read(stylesPath)
  assert.match(styles,/\.identityProgress/)
  assert.match(styles,/\.completionCard/)
  assert.match(styles,/\.checklist/)
  assert.match(styles,/\.checkPending/)
  assert.match(styles,/\.dataCard/)
  assert.match(styles,/\.protectedValue/)
  assert.match(styles,/\.field input,\.field select\{[^}]*box-shadow:inset/s)
  assert.match(styles,/\.actions\{display:flex/)
  assert.match(styles,/@media\(max-width:800px\)/)
  assert.match(styles,/@media\(max-width:520px\)/)
  assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/)
  assert.doesNotMatch(styles,/#[0-9a-f]{3,8}/i)
})
