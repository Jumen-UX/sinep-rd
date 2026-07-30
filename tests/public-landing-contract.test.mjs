import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('public landing explains international scope before the explorer', async () => {
  const [intro, shell, explorer] = await Promise.all([
    read('src/features/public/PublicLandingIntro.tsx'),
    read('src/features/public/PublicDashboardShell.tsx'),
    read('src/features/public/PublicDashboardExplorer.tsx'),
  ])

  assert.match(intro, /<h1 id="public-landing-title">/)
  assert.match(intro, /organizada por país, jurisdicción y servicio pastoral/)
  assert.match(intro, /Base inicial corresponde a República Dominicana/)
  assert.match(intro, /href="#explorador"/)
  assert.match(intro, /href="\/diocesis"/)
  assert.match(intro, /href="\/personas"/)

  assert.match(shell, /<PublicLandingIntro \/>/)
  assert.match(shell, /<PublicDashboardExplorer \{\.\.\.props\} \/>/)
  assert.ok(shell.indexOf('<PublicLandingIntro />') < shell.indexOf('<PublicDashboardExplorer {...props} />'))
  assert.doesNotMatch(shell, /Entorno de desarrollo|Sistema de Información<br \/>Eclesial Pastoral/)

  assert.match(explorer, /id="explorador"/)
  assert.match(explorer, /<h2 id="ambito-title">Explorador eclesial<\/h2>/)
  assert.doesNotMatch(explorer, /<h1/)
})
