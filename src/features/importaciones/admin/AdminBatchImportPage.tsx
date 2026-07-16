'use client'

import { type ChangeEvent, type MouseEvent, useMemo, useState } from 'react'
import {
  IMPORT_BATCH_LIMITS,
  IMPORT_DOMAIN_OPTIONS,
  IMPORT_FILE_ACCEPT,
  IMPORT_TEMPLATE_VERSION,
  getImportDomainContract,
  isImportFileExtension,
  isProcessableImportFileExtension,
  type ImportBatchType,
  type ProcessableImportFileExtension,
} from '../contracts/import-batch-contract'
import {
  prepareImportBatch,
  type ImportBatchSummary,
} from '../services/batch-import-admin-service'
import {
  buildCsvTemplate,
  parseCsvPreview,
  sha256Hex,
  type CsvPreview,
} from '../services/csv-preview'

type SelectedFile = {
  name: string
  size: number
  extension: ProcessableImportFileExtension
  mimeType: string | null
  lastModified: number
  sha256: string | null
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function delimiterLabel(delimiter: CsvPreview['delimiter']) {
  if (delimiter === ';') return 'punto y coma'
  if (delimiter === '\t') return 'tabulación'
  return 'coma'
}

function forceNavigation(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  window.location.assign(href)
}

export default function AdminBatchImportPage() {
  const [importType, setImportType] = useState<ImportBatchType>('personas')
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null)
  const [preview, setPreview] = useState<CsvPreview | null>(null)
  const [preparedBatch, setPreparedBatch] = useState<ImportBatchSummary | null>(null)
  const [isPreparing, setIsPreparing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedOption = useMemo(() => getImportDomainContract(importType), [importType])
  const canPrepare = Boolean(
    selectedFile?.extension === 'csv'
    && selectedFile.sha256
    && preview
    && preview.totalRows > 0
    && preview.totalRows <= IMPORT_BATCH_LIMITS.maxRows
    && preview.missingColumns.length === 0,
  )

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setMessage(null)
    setError(null)
    setPreview(null)
    setPreparedBatch(null)
    const file = event.target.files?.[0]

    if (!file) {
      setSelectedFile(null)
      return
    }

    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!isImportFileExtension(extension)) {
      setSelectedFile(null)
      setError('El archivo debe estar en formato CSV.')
      return
    }

    if (!isProcessableImportFileExtension(extension)) {
      setSelectedFile(null)
      setError('XLSX y XLS todavía no se procesan directamente. Exporta el archivo como CSV UTF-8 para continuar.')
      return
    }

    if (file.size > IMPORT_BATCH_LIMITS.maxFileSizeBytes) {
      setSelectedFile(null)
      setError(`El archivo no debe superar ${formatBytes(IMPORT_BATCH_LIMITS.maxFileSizeBytes)}.`)
      return
    }

    setSelectedFile({
      name: file.name,
      size: file.size,
      extension,
      mimeType: file.type || null,
      lastModified: file.lastModified,
      sha256: null,
    })

    try {
      const [source, fileBytes] = await Promise.all([file.text(), file.arrayBuffer()])
      const [result, fileSha256] = await Promise.all([
        Promise.resolve(parseCsvPreview(source, [...selectedOption.requiredColumns])),
        sha256Hex(fileBytes),
      ])
      setSelectedFile((current) => current ? { ...current, sha256: fileSha256 } : current)
      setPreview(result)
      if (result.missingColumns.length > 0) setError(`Faltan columnas obligatorias: ${result.missingColumns.join(', ')}.`)
      else if (result.totalRows > IMPORT_BATCH_LIMITS.maxRows) setError(`El archivo contiene ${result.totalRows} filas y supera el límite de ${IMPORT_BATCH_LIMITS.maxRows.toLocaleString('es-DO')}.`)
      else setMessage(`CSV leído correctamente con delimitador de ${delimiterLabel(result.delimiter)}: ${result.totalRows} fila(s) listas para preparar y validar.`)
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'No se pudo leer el archivo CSV.')
    }
  }

  function selectImportType(nextType: ImportBatchType) {
    setImportType(nextType)
    setSelectedFile(null)
    setPreview(null)
    setPreparedBatch(null)
    setMessage(null)
    setError(null)
  }

  function downloadTemplate() {
    const blob = new Blob([buildCsvTemplate([...selectedOption.columns])], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `sinep-${selectedOption.key}-v${IMPORT_TEMPLATE_VERSION}-plantilla.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function prepareBatch() {
    if (!selectedFile || !selectedFile.sha256 || !preview || !canPrepare) return
    setIsPreparing(true)
    setError(null)
    setMessage(null)
    setPreparedBatch(null)
    try {
      const summary = await prepareImportBatch({
        importType,
        templateVersion: IMPORT_TEMPLATE_VERSION,
        file: {
          name: selectedFile.name,
          extension: selectedFile.extension,
          mimeType: selectedFile.mimeType,
          sizeBytes: selectedFile.size,
          sha256: selectedFile.sha256,
          lastModifiedAt: selectedFile.lastModified ? new Date(selectedFile.lastModified).toISOString() : null,
        },
        headers: preview.headers,
        rows: preview.records,
        sourceMetadata: {
          client_preview_rows: Math.min(preview.totalRows, IMPORT_BATCH_LIMITS.previewRows),
          extra_columns: preview.extraColumns,
          csv_delimiter: preview.delimiter,
        },
      })
      setPreparedBatch(summary)
      setMessage(summary.status === 'validated'
        ? summary.application_rpc_available
          ? 'Lote persistido y validado. Ábrelo para aprobarlo y aplicar sus operaciones mediante el contrato canónico.'
          : 'Lote persistido y validado. Puede aprobarse, pero este dominio todavía no tiene contrato de aplicación.'
        : 'Lote persistido. Revisa errores, duplicados y relaciones no resueltas antes de aprobarlo.')
    } catch (prepareError) {
      setError(prepareError instanceof Error ? prepareError.message : 'No se pudo preparar el lote de importación.')
    } finally {
      setIsPreparing(false)
    }
  }

  return (
    <div id="top">
      <header className="admin-top-header">
        <div className="admin-top-title"><span className="admin-mini-mark">IMPORTAR</span><strong>Carga por lotes</strong></div>
        <div className="admin-top-actions">
          <a className="button button-secondary" href="/admin" onClick={(event) => forceNavigation(event, '/admin')}>Volver al panel</a>
          <a className="button button-secondary" href="/admin/importar/lotes" onClick={(event) => forceNavigation(event, '/admin/importar/lotes')}>Historial de lotes</a>
          <a className="button button-secondary" href="/admin/revision" onClick={(event) => forceNavigation(event, '/admin/revision')}>Cola de revisión</a>
          <a className="button button-primary" href="/admin/nuevo" onClick={(event) => forceNavigation(event, '/admin/nuevo')}>Carga individual</a>
        </div>
      </header>

      <section className="admin-welcome-panel">
        <div>
          <p className="eyebrow">Carga masiva controlada</p><h1>Importar registros por lotes</h1>
          <p className="lead">Prepara archivos CSV para persistirlos, validarlos y enviarlos a revisión. Los lotes aprobados pueden aplicarse mediante contratos canónicos con auditoría e idempotencia.</p>
          <div className="role-list admin-role-list"><span className="role-pill">CSV seguro</span><span className="role-pill">Plantilla v{IMPORT_TEMPLATE_VERSION}</span><span className="role-pill">Hash SHA-256</span><span className="role-pill">Aplicación manual</span></div>
        </div>
        <div className="admin-welcome-illustration" aria-hidden="true">⇪</div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box">{message}</div>}

      <section className="admin-module-group">
        <div className="admin-group-heading"><span>1</span><div><p className="eyebrow">Tipo de importación</p><h2>Selecciona qué datos vas a cargar</h2><p className="meta">Cada tipo usa el mismo contrato versionado y reglas específicas.</p></div><a href="#plantilla">Ver plantilla</a></div>
        <div className="admin-module-grid">
          {IMPORT_DOMAIN_OPTIONS.map((option) => (
            <button className={`admin-module-card is-active ${importType === option.key ? 'active-filter' : ''}`} key={option.key} onClick={() => selectImportType(option.key)} type="button">
              <div className="admin-module-card-head"><span className="admin-module-icon">{option.icon}</span><span className="admin-status-pill active">{importType === option.key ? 'Seleccionado' : 'Disponible'}</span></div>
              <p className="entity-type">{option.eyebrow}</p><h3>{option.title}</h3><p className="meta">{option.description}</p><ul>{option.columns.slice(0, 4).map((column) => <li key={column}>{column}</li>)}</ul>
            </button>
          ))}
        </div>
      </section>

      <section className="admin-bottom-grid">
        <article className="card dashboard-section" id="plantilla">
          <div className="section-heading"><div><p className="eyebrow">Plantilla oficial v{IMPORT_TEMPLATE_VERSION}</p><h2>{selectedOption.title}</h2><p className="meta">Descarga la cabecera CSV correspondiente al contrato vigente.</p></div><button className="button button-secondary" onClick={downloadTemplate} type="button">Descargar plantilla CSV</button></div>
          <div className="admin-system-list">{selectedOption.columns.map((column) => <div key={column}><span>{selectedOption.requiredColumns.includes(column) ? 'Obligatoria' : 'Opcional'}</span><strong>{column}</strong></div>)}</div>
          <ul>{selectedOption.notes.map((note) => <li key={note}>{note}</li>)}</ul>
        </article>

        <article className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Archivo fuente</p><h2>Selecciona el archivo</h2><p className="meta">CSV UTF-8 delimitado por coma, punto y coma o tabulación; máximo {formatBytes(IMPORT_BATCH_LIMITS.maxFileSizeBytes)} y {IMPORT_BATCH_LIMITS.maxRows.toLocaleString('es-DO')} filas por lote.</p></div></div>
          <div className="auth-form access-form"><label>Archivo CSV<input accept={IMPORT_FILE_ACCEPT} onChange={(event) => void handleFileChange(event)} type="file" /></label></div>
          <p className="meta">Los archivos XLSX y XLS deben exportarse como CSV UTF-8 antes de cargarse.</p>
          {selectedFile && <div className="admin-system-list"><div><span>Nombre</span><strong>{selectedFile.name}</strong></div><div><span>Tamaño</span><strong>{formatBytes(selectedFile.size)}</strong></div><div><span>Formato</span><strong>{selectedFile.extension.toUpperCase()}</strong></div><div><span>SHA-256</span><strong>{selectedFile.sha256 ? `${selectedFile.sha256.slice(0, 20)}…` : 'Pendiente'}</strong></div></div>}
        </article>
      </section>

      {preview && <section className="card dashboard-section"><div className="section-heading"><div><p className="eyebrow">Vista previa</p><h2>{preview.totalRows} fila(s) detectadas</h2><p className="meta">{preview.headers.length} columnas · delimitador: {delimiterLabel(preview.delimiter)} · {preview.extraColumns.length} columnas adicionales.</p></div><span className="role-pill">{preview.missingColumns.length === 0 ? 'Cabecera válida' : 'Cabecera incompleta'}</span></div><div className="admin-system-list">{preview.headers.map((header) => <div key={header}><span>{selectedOption.requiredColumns.includes(header) ? 'Obligatoria' : selectedOption.columns.includes(header) ? 'Opcional' : 'Adicional'}</span><strong>{header}</strong></div>)}</div></section>}

      <section className="card dashboard-section">
        <div className="section-heading"><div><p className="eyebrow">Preparación persistente</p><h2>Validar y guardar lote</h2><p className="meta">La preparación no modifica registros canónicos. Persiste el archivo lógico, sus filas, incidencias y trazabilidad.</p></div><span className="role-pill">Permiso: imports.prepare</span></div>
        <div className="admin-top-actions"><button className="button button-primary" disabled={!canPrepare || isPreparing} onClick={() => void prepareBatch()} type="button">{isPreparing ? 'Preparando lote…' : 'Preparar y validar lote'}</button>{preparedBatch && <a className="button button-secondary" href={`/admin/importar/lotes/${preparedBatch.batch_id}`}>Abrir lote preparado</a>}</div>
        {preparedBatch && <div className="admin-stat-strip" aria-label="Resumen del lote preparado"><div><span>✓</span><strong>{preparedBatch.valid_rows}</strong><small>Válidas</small></div><div><span>!</span><strong>{preparedBatch.warning_rows}</strong><small>Advertencias</small></div><div><span>×</span><strong>{preparedBatch.error_rows}</strong><small>Errores</small></div><div><span>≡</span><strong>{preparedBatch.duplicate_rows}</strong><small>Duplicadas</small></div><div><span>?</span><strong>{preparedBatch.unresolved_rows}</strong><small>No resueltas</small></div></div>}
      </section>
    </div>
  )
}
