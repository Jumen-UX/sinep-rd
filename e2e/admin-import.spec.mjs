import path from 'node:path'
import { expect, test } from '@playwright/test'
import { expectNoBlockingAccessibilityViolations } from './accessibility.mjs'

const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD
const fixturePath = path.resolve('tests/fixtures/imports/eventos-canonical-pilot.csv')
const mockedBatchId = '00000000-0000-4000-8000-000000000001'

test.describe('preparación administrativa de importaciones', () => {
  test.skip(!adminEmail || !adminPassword, 'Requiere E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD.')

  test('lee un CSV de eventos, muestra la vista previa y prepara el resultado', async ({ page }, testInfo) => {
    await page.goto('/admin/login?next=/admin/importar', { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Correo electrónico').fill(adminEmail)
    await page.getByLabel('Contraseña').fill(adminPassword)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL('**/admin/importar', { timeout: 30_000 })

    await page.route('**/api/admin/importaciones/preparar', async (route) => {
      const payload = route.request().postDataJSON()
      expect(payload.import_type).toBe('eventos')
      expect(payload.rows).toHaveLength(1)
      expect(payload.rows[0].tipo_evento).toBe('erection')
      expect(payload.rows[0].fecha_efectiva).toBe('1511-08-08')
      expect(payload.file.sha256).toMatch(/^[0-9a-f]{64}$/)

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          batch_id: mockedBatchId,
          status: 'validated',
          row_count: 1,
          valid_rows: 1,
          warning_rows: 0,
          error_rows: 0,
          duplicate_rows: 0,
          unresolved_rows: 0,
          can_apply: false,
          application_rpc_available: true,
          application_domain: 'eventos',
        }),
      })
    })

    await page.getByRole('button', { name: /Eventos históricos/ }).click()
    await page.getByLabel('Archivo CSV o Excel').setInputFiles(fixturePath)

    await expect(page.getByRole('heading', { name: 'Vista previa del CSV' })).toBeVisible()
    await expect(page.getByText('CSV leído correctamente: 1 fila(s) listas para preparar y validar.')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'erection', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Preparar y validar lote' })).toBeEnabled()

    await page.getByRole('button', { name: 'Preparar y validar lote' }).click()

    await expect(page.getByRole('heading', { name: `Lote ${mockedBatchId}` })).toBeVisible()
    await expect(page.getByText('Aplicación manual disponible')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Abrir lote y continuar' })).toHaveAttribute(
      'href',
      `/admin/importar/${mockedBatchId}`,
    )

    await expectNoBlockingAccessibilityViolations({ page, expect, testInfo, include: '#top' })
  })
})
