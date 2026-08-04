import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const formPath=new URL('../src/features/account/AccountProfileForm.tsx',import.meta.url)
const pagePath=new URL('../src/app/(account)/cuenta/perfil/page.tsx',import.meta.url)
const stylesPath=new URL('../src/features/account/account-profile.module.css',import.meta.url)
async function read(path){return readFile(path,'utf8')}

test('profile workspace exposes progress actionable checklist and avatar shortcut',async()=>{const[form,page]=await Promise.all([read(formPath),read(pagePath)]);assert.match(page,/<AccountProfileForm profile=\{profile\}/);assert.match(form,/profile-identity-title/);assert.match(form,/profile-completion-title/);assert.match(form,/Completitud del perfil/);assert.match(form,/completionHint/);assert.match(form,/Editar fotografía/);assert.match(form,/completionFields\.map/);assert.match(form,/href=\{field\.target\}/);assert.match(form,/Completar →/);assert.match(form,/La vinculación con una ficha eclesial es opcional/)})

test('profile state is normalized and never reports initial changes',async()=>{const form=await read(formPath);assert.match(form,/function normalizeValue/);assert.match(form,/function normalizeForm/);assert.match(form,/const \[baseline,setBaseline\]/);assert.match(form,/JSON\.stringify\(normalizedForm\)!==JSON\.stringify\(normalizeForm\(baseline\)\)/);assert.match(form,/setBaseline\(saved\)/);assert.match(form,/\(isDirty\|\|saving\)\?/)})

test('profile success feedback is temporary and accessible',async()=>{const form=await read(formPath);assert.match(form,/messageTimer=useRef/);assert.match(form,/setTimeout\(\(\)=>setMessage\(null\),4000\)/);assert.match(form,/className=\{styles\.toast\} role="status"/);assert.match(form,/Tu perfil fue actualizado correctamente/)})

test('profile form validates https photos without blocking unrelated edits',async()=>{const form=await read(formPath);assert.match(form,/IMAGE_PATH_PATTERN/);assert.match(form,/parsed\.protocol!=='https:'/);assert.match(form,/La URL es válida, pero no parece apuntar directamente a una imagen/);assert.match(form,/avatarInspection\.previewable/);assert.match(form,/const canSubmit=isDirty&&!saving/)})

test('profile protected email is rendered as data rather than disabled input',async()=>{const form=await read(formPath);assert.match(form,/styles\.protectedField/);assert.match(form,/styles\.protectedBadge/);assert.match(form,/styles\.protectedValue/);assert.match(form,/<LockIcon\/>Protegido/);assert.doesNotMatch(form,/<input disabled type="email"/)})

test('profile protected icon remains compact despite global svg rules',async()=>{const styles=await read(stylesPath);assert.match(styles,/\.protectedBadge>\.lockIcon\{[^}]*width:14px!important/s);assert.match(styles,/\.protectedBadge>\.lockIcon\{[^}]*height:14px!important/s);assert.match(styles,/\.protectedBadge>\.lockIcon\{[^}]*max-width:14px!important/s);assert.match(styles,/\.protectedBadge>\.lockIcon\{[^}]*flex:0 0 14px!important/s)})

test('profile completion cards and data cards resist global overrides',async()=>{const styles=await read(stylesPath);assert.match(styles,/\.checklist\{[^}]*display:grid!important/s);assert.match(styles,/\.checklist>li\{[^}]*grid-template-columns:auto minmax\(0,1fr\) auto!important/s);assert.match(styles,/\.grid\{[^}]*display:grid!important/s);assert.match(styles,/\.dataCard\{[^}]*display:grid!important/s);assert.match(styles,/\.protectedHeading\{[^}]*display:flex!important/s);assert.match(styles,/\.protectedValue\{[^}]*overflow-wrap:anywhere!important/s)})

test('profile preferences use controlled locale and IANA timezone suggestions',async()=>{const form=await read(formPath);assert.match(form,/TIMEZONE_OPTIONS/);assert.match(form,/list="account-timezones"/);assert.match(form,/<datalist id="account-timezones">/);assert.match(form,/America\/Santo_Domingo/);assert.match(form,/value=\{form\.preferredLocale\}/);assert.match(form,/value=\{form\.timezone\}/)})

test('profile presentation includes progress toast and responsive rules',async()=>{const styles=await read(stylesPath);assert.match(styles,/\.identityProgress/);assert.match(styles,/\.progressTrack/);assert.match(styles,/\.avatarLink/);assert.match(styles,/\.checkPending/);assert.match(styles,/\.completeLink/);assert.match(styles,/\.toast\{[^}]*position:fixed/s);assert.match(styles,/bottom:calc\(7\.25rem \+ env\(safe-area-inset-bottom\)\)/);assert.match(styles,/@media\(max-width:800px\)/);assert.match(styles,/@media\(max-width:520px\)/);assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/);assert.doesNotMatch(styles,/#[0-9a-f]{3,8}/i)})
