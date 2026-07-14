'use client'

import { type ChangeEvent, type MouseEvent, useMemo, useState } from 'react'
import {
  prepareImportBatch,
  type ImportBatchSummary,
  type ImportBatchType,
} from '../services/batch-import-admin-service'
import {
  buildCsvTemplate,
  parseCsvPreview,
  sha256Hex,
  type CsvPreview,
} from '../services/csv-preview'

type ImportType = ImportBatchType

type ImportOption = {
  key: ImportType
  title: string
  eyebrow: string
  description: string
  icon: string
  columns: string[]
  notes: string[]
}

type SelectedFile = {
  name: string
  size: number
  extension: 'csv' | 'xlsx' | 'xls'
  mimeType: string | null
  lastModified: number
  sha256: string | null
}

const importOptions: ImportOption[] = [
  {
    key: 'personas',
    eyebrow: 'Personas',
    title: 'Personas y agentes',
    description: 'Carga inicial de obispos, sacerdotes, diáconos, religiosos y laicos con datos básicos y estado.',
    icon: '◉',
    columns: ['codigo_referencia', 'tipo_persona', 'primer_nombre', 'primer_apellido', 'nombre_publico', 'estado', 'visibilidad', 'entidad_actual'],
    notes: ['codigo_referencia es opcional para altas nuevas; úsalo para enlazar de forma idempotente una persona ya registrada.', 'Usa catálogos para tipo de persona y estado.', 'El sistema valida coincidencias exactas por código interno antes de aplicar.', 'Los datos privados no deben ir en plantillas públicas.'],
  },
  {
    key: 'parroquias',
    eyebrow: 'Estructura',
    title: 'Parroquias, capillas y comunidades',
    description: 'Carga territorial por diócesis o zona con jerarquía flexible y posibilidad de revisión antes de aplicar.',
    icon: '✚',
    columns: ['pais_iso2', 'diocesis', 'nivel_padre', 'tipo_entidad', 'nombre', 'direccion', 'visibilidad'],
    notes: ['Los nombres repetidos se revisan por diócesis y nivel.', 'La jerarquía se debe resolver antes de publicar.', 'Las entidades nuevas entran en revisión.'],
  },
  {
    key: 'asignaciones',
    eyebrow: 'Nombramientos',
    title: 'Cargos y nombramientos',
    description: 'Importación controlada de cargos actuales o históricos con fecha de inicio, entidad y persona.',
    icon: '▣',
    columns: ['persona', 'cargo', 'entidad', 'fecha_inicio', 'fecha_fin', 'actual', 'fuente'],
    notes: ['Los cargos actuales deben cerrar cargos previos incompatibles.', 'Toda asignación debe apuntar a persona y entidad resueltas.', 'La fuente ayuda a revisión editorial.'],
  },
  {
    key: 'eventos',
    eyebrow: 'Historial',
    title: 'Eventos históricos',
    description: 'Carga por lotes de erecciones, divisiones, fusiones, nombramientos y hechos verificables.',
    icon: '◷',
    columns: ['tipo_evento', 'fecha_efectiva', 'entidad', 'descripcion', 'titulo', 'fuente', 'url_fuente'],
    notes: ['Cada evento debe ser trazable.', 'Los eventos pueden quedar en cola de revisión.', 'No se deben aplicar cambios estructurales sin validación.'],
  },
]

const requiredColumnsByImportType: Record<ImportType, string[]> = {
  personas: ['tipo_persona', 'primer_nombre', 'primer_apellido'],
  parroquias: ['pais_iso2', 'diocesis', 'nivel_padre', 'tipo_entidad', 'nombre'],
  asignaciones: ['persona', 'cargo', 'entidad', 'fecha_inicio'],
  eventos: ['tipo_evento', 'fecha_efectiva', 'entidad', 'descripcion'],
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function forceNavigation(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  window.location.assign(href)
}

export default function AdminBatchImportPage() {
  const [importType, setImportType] = useState<ImportType>('personas')
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null)
  const [preview, setPreview] = useState<CsvPreview | null>(null)
  const [preparedBatch, setPreparedBatch] = useState<ImportBatchSummary | null>(null)
  const [isPreparing, setIsPreparing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedOption = useMemo(
    () => importOptions.find((option) => option.key === importType) ?? importOptions[0],
    [importType],
  )
  const acceptedExtensions = '.csv,.xlsx,.xls'
  const canPrepare = Boolean(
    selectedFile?.extension === 'csv'
    && selectedFile.sha256
    && preview
    && preview.totalRows > 0
    && preview.totalRows <= 5000
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
    if (!['csv', 'xlsx', 'xls'].includes(extension)) {
      setSelectedFile(null)
      setError('El archivo debe estar en formato CSV, XLSX o XLS.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setSelectedFile(null)
      setError('El archivo no debe superar 10 MB para esta primera etapa de carga.')
      return
    }

    const typedExtension = extension as SelectedFile['extension']
    setSelectedFile({
      name: file.name,
      size: file.size,
      extension: typedExtension,
      mimeType: file.type || null,
      lastModified: file.lastModified,
      sha256: null,
    })

    if (typedExtension !== 'csv') {
      setError('La vista previa segura está disponible actualmente para CSV. Exporta este archivo de Excel como CSV UTF-8 para continuar.')
      return
    }

    try {
      const [source, fileBytes] = await Promise.all([file.text(), file.arrayBuffer()])
      const [result, fileSha256] = await Promise.all([
        Promise.resolve(parseCsvPreview(source, requiredColumnsByImportType[importType])),
        sha256Hex(fileBytes),
      ])
      setSelectedFile((current) => current ? { ...current, sha256: fileSha256 } : current)
      setPreview(result)
      if (result.missingColumns.length > 0) setError(`Faltan columnas obligatorias: ${result.missingColumns.join(', ')}.`)
      else if (result.totalRows > 5000) setError(`El archivo contiene ${result.totalRows} filas y supera el límite inicial de 5,000.`)
      else setMessage(`CSV leído correctamente: ${result.totalRows} fila(s) listas para preparar y validar.`)
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'No se pudo leer el archivo CSV.')
    }
  }

  function selectImportType(nextType: ImportType) {
    setImportType(nextType)
    setSelectedFile(null)
    setPreview(null)
    setPreparedBatch(null)
    setMessage(null)
    setError(null)
  }

  function downloadTemplate() {
    const blob = new Blob([buildCsvTemplate(selectedOption.columns)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `sinep-${selectedOption.key}-plantilla.csv`
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
          client_preview_rows: Math.min(preview.totalRows, 25),
          extra_columns: preview.extraColumns,
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
          <p className="lead">Prepara archivos CSV para persistirlos, validarlos y enviarlos a revisión. Los lotes aprobados de personas, estructuras, asignaciones y eventos pueden aplicarse mediante contratos canónicos con auditoría e idempotencia.</p>
          <div className="role-list admin-role-list"><span className="role-pill">CSV seguro</span><span className="role-pill">Hash SHA-256</span><span className="role-pill">Revisión previa</span><span className="role-pill">Aplicación manual</span></div>
        </div>
        <div className="admin-welcome-illustration" aria-hidden="true">⇪</div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box">{message}</div>}

      <section className="admin-module-group">
        <div className="admin-group-heading"><span>1</span><div><p className="eyebrow">Tipo de importación</p><h2>Selecciona qué datos vas a cargar</h2><p className="meta">Cada tipo tiene columnas mínimas y reglas de revisión diferentes.</p></div><a href="#plantilla">Ver plantilla</a></div>
        <div className="admin-module-grid">
          {importOptions.map((option) => (
            <button className={`admin-module-card is-active ${importType === option.key ? 'active-filter' : ''}`} key={option.key} onClick={() => selectImportType(option.key)} type="button">
              <div className="admin-module-card-head"><span className="admin-module-icon">{option.icon}</span><span className="admin-status-pill active">{importType === option.key ? 'Seleccionado' : 'Disponible'}</span></div>
              <p className="entity-type">{option.eyebrow}</p><h3>{option.title}</h3><p className="meta">{option.description}</p><ul>{option.columns.slice(0, 4).map((column) => <li key={column}>{column}</li>)}</ul>
            </button>
          ))}
        </div>
      </section>

      <section className="admin-bottom-grid">
        <article className="card dashboard-section" id="plantilla">
          <div className="section-heading"><div><p className="eyebrow">Plantilla sugerida</p><h2>{selectedOption.title}</h2><p className="meta">Descarga la cabecera CSV oficial para este tipo de importación.</p></div><button className="button button-secondary" onClick={downloadTemplate} type="button">Descargar plantilla CSV</button></div>
          <div className="admin-system-list">{selectedOption.columns.map((column) => <div key={column}><span>{requiredColumnsByImportType[importType].includes(column) ? 'Obligatoria' : 'Opcional'}</span><strong>{column}</strong></div>)}</div>
          <ul>{selectedOption.notes.map((note) => <li key={note}>{note}</li>)}</ul>
        </article>

        <article className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Archivo fuente</p><h2>Selecciona el archivo</h2><p className="meta">CSV UTF-8, máximo 10 MB y 5,000 filas por lote.</p></div></div>
          <div className="auth-form access-form"><label>Archivo<input accept={acceptedExtensions} onChange={(event) => void handleFileChange(event)} type="file" /></label></div>
          {selectedFile && <div className="admin-system-list"><div><span>Nombre</span><strong>{selectedFile.name}</strong></div><div><span>Tamaño</span><strong>{formatBytes(selectedFile.size)}</strong></div><div><span>Formato</span><strong>{selectedFile.extension.toUpperCase()}</strong></div><div><span>SHA-256</span><strong>{selectedFile.sha256 ? `${selectedFile.sha256.slice(0, 20)}…` : 'Pendiente'}</strong></div></div>}
        </article>
      </section>

      {preview && <section className="card dashboard-section"><div className="section-heading"><div><p className="eyebrow">Vista previa</p><h2>{preview.totalRows} fila(s) detectadas</h2><p className="meta">{preview.headers.length} columnas · {preview.extraColumns.length} columnas adicionales.</p></div><span className="role-pill">{preview.missingColumns.length === 0 ? 'Cabecera válida' : 'Cabecera incompleta'}</span></div><div className="admin-system-list">{preview.headers.map((header) => <div key={header}><span>{requiredColumnsByImportType[importType].includes(header) ? 'Obligatoria' : selectedOption.columns.includes(header) ? 'Opcional' : 'Adicional'}</span><strong>{header}</strong></div>)}</div></section>}

      <section className="card dashboard-section">
        <div className="section-heading"><div><p className="eyebrow">Preparación persistente</p><h2>Validar y guardar lote</h2><p className="meta">La preparación no modifica registros canónicos. Persiste el archivo lógico, sus filas, incidencias y trazabilidad.</p></div><span className="role-pill">Permiso: imports.prepare</span></div>
        <div className="admin-top-actions"><button className="button button-primary" disabled={!canPrepare || isPreparing} onClick={() => void prepareBatch()} type="button">{isPreparing ? 'Preparando lote…' : 'Preparar y validar lote'}</button>{preparedBatch && <a className="button button-secondary" href={`/admin/importar/lotes/${preparedBatch.batch_id}`}>Abrir lote preparado</a>}</div>
        {preparedBatch && <div className="admin-stat-strip" aria-label="Resumen del lote preparado"><div><span>✓</span><strong>{preparedBatch.valid_rows}</strong><small>Válidas</small></div><div><span>!</span><strong>{preparedBatch.warning_rows}</strong><small>Advertencias</small></div><div><span>×</span><strong>{preparedBatch.error_rows}</strong><small>Errores</small></div><div><span>≡</span><strong>{preparedBatch.duplicate_rows}</strong><small>Duplicadas</small></div><div><span>?</span><strong>{preparedBatch.unresolved_rows}</strong><small>No resueltas</small></div></div>}
      </section>
    </div>
  )
}
