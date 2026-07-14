import { expect, test } from '@playwright/test'

const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD
const allowMutations = process.env.E2E_ALLOW_MUTATIONS === 'true'
const existingReference = process.env.E2E_PERSON_REFERENCE_CODE
const existingFirstName = process.env.E2E_PERSON_FIRST_NAME
const existingLastName = process.env.E2E_PERSON_LAST_NAME

const canRun = Boolean(
  adminEmail
  && adminPassword
  && allowMutations
  && existingReference
  && existingFirstName
  && existingLastName,
)

function buildCsv(runId) {
  const headers = [
    'codigo_referencia',
    'tipo_persona',
    'primer_nombre',
    'primer_apellido',
    'nombre_publico',
    'estado',
    'visibilidad',
    'entidad_actual',
  ]
  const existing = [
    existingReference,
    'priest',
    existingFirstName,
    existingLastName,
    `${existingFirstName} ${existingLastName}`,
    'active',
    'public',
    '',
  ]
  const created = [
    '',
    'layperson',
    'Piloto',
    `Importación ${runId}`,
    `Persona Piloto de Importación ${runId}`,
    'active',
    'internal',
    '',
  ]
  return `${headers.join(',')}\n${existing.join(',')}\n${created.join(',')}\n`
}

test.describe('aplicación mixta real de personas', () => {
  test.skip(!canRun, 'Requiere credenciales, E2E_ALLOW_MUTATIONS=true y una referencia estable de persona en un entorno no productivo.')

  test('prepara, aprueba, aplica y reporta create + noop de forma idempotente', async ({ page }) => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const csv = buildCsv(runId)

    await page.goto('/admin/login?next=/admin/importar', { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Correo electrónico').fill(adminEmail)
    await page.getByLabel('Contraseña').fill(adminPassword)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL('**/admin/importar', { timeout: 30_000 })

    await page.getByRole('button', { name: /Personas y agentes/ }).click()
    await page.getByLabel('Archivo CSV o Excel').setInputFiles({
      name: `personas-mixto-${runId}.csv`,
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf8'),
    })

    await expect(page.getByText('CSV leído correctamente: 2 fila(s) listas para preparar y validar.')).toBeVisible()
    await page.getByRole('button', { name: 'Preparar y validar lote' }).click()

    const openBatch = page.getByRole('link', { name: 'Abrir lote y continuar' })
    await expect(openBatch).toBeVisible()
    await openBatch.click()
    await page.waitForURL('**/admin/importar/**', { timeout: 30_000 })

    await expect(page.getByText('Creaciones')).toBeVisible()
    await expect(page.getByText('Sin cambios')).toBeVisible()

    await page.getByRole('button', { name: 'Aprobar lote' }).click()
    await expect(page.getByText('Lote aprobado editorialmente y listo para aplicación canónica.')).toBeVisible()

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Aplicar lote de personas' }).click()
    await expect(page.getByRole('heading', { name: 'Aplicación completada' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Descargar reporte final CSV')).toBeVisible()

    const batchId = page.url().split('/').filter(Boolean).at(-1)
    expect(batchId).toMatch(/^[0-9a-f-]{36}$/i)

    const replay = await page.evaluate(async (id) => {
      const response = await fetch(`/api/admin/importaciones/${id}/aplicar`, { method: 'POST' })
      return response.json()
    }, batchId)
    expect(replay.status).toBe('applied')
    expect(replay.idempotent_replay).toBe(true)

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('link', { name: 'Descargar reporte final CSV' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^sinep-reporte-personas-mixto-.*-[0-9a-f]{8}\.csv$/)
  })
})
