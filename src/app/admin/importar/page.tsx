'use client'

import { type ChangeEvent, type MouseEvent, useMemo, useState } from 'react'

type ImportType = 'personas' | 'parroquias' | 'asignaciones' | 'eventos'

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
  extension: string
  lastModified: number
}

const importOptions: ImportOption[] = [
  {
    key: 'personas',
    eyebrow: 'Personas',
    title: 'Personas y agentes',
    description: 'Carga inicial de obispos, sacerdotes, diáconos, religiosos y laicos con datos básicos y estado.',
    icon: '◉',
    columns: ['tipo_persona', 'primer_nombre', 'primer_apellido', 'nombre_publico', 'estado', 'visibilidad', 'entidad_actual'],
    notes: ['Usa catálogos para tipo de persona y estado.', 'El sistema debe validar posibles duplicados antes de publicar.', 'Los datos privados no deben ir en plantillas públicas.'],
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
    columns: ['tipo_evento', 'fecha_efectiva', 'entidad', 'descripcion', 'fuente', 'estado_revision'],
    notes: ['Cada evento debe ser trazable.', 'Los eventos pueden quedar en cola de revisión.', 'No se deben aplicar cambios estructurales sin validación.'],
  },
]

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
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedOption = useMemo(() => importOptions.find((option) => option.key === importType) ?? importOptions[0], [importType])
  const acceptedExtensions = '.csv,.xlsx,.xls'

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setMessage(null)
    setError(null)
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

    setSelectedFile({ name: file.name, size: file.size, extension, lastModified: file.lastModified })
    setMessage('Archivo listo para revisión. El procesamiento automático se conectará a la cola de importación controlada.')
  }

  return (
    <div id="top">
      <header className="admin-top-header">
        <div className="admin-top-title">
          <span className="admin-mini-mark">IMPORTAR</span>
          <strong>Carga por lotes</strong>
        </div>
        <div className="admin-top-actions">
          <a className="button button-secondary" href="/admin" onClick={(event) => forceNavigation(event, '/admin')}>Volver al panel</a>
          <a className="button button-secondary" href="/admin/revision" onClick={(event) => forceNavigation(event, '/admin/revision')}>Cola de revisión</a>
          <a className="button button-primary" href="/admin/nuevo" onClick={(event) => forceNavigation(event, '/admin/nuevo')}>Carga individual</a>
        </div>
      </header>

      <section className="admin-welcome-panel">
        <div>
          <p className="eyebrow">Carga masiva controlada</p>
          <h1>Importar registros por lotes</h1>
          <p className="lead">Prepara archivos CSV o Excel para cargar datos de personas, estructuras, nombramientos o eventos sin saltar la validación editorial ni las reglas de duplicidad.</p>
          <div className="role-list admin-role-list">
            <span className="role-pill">CSV / XLSX</span>
            <span className="role-pill">Revisión previa</span>
            <span className="role-pill">Antiduplicados</span>
            <span className="role-pill">Aplicación controlada</span>
          </div>
        </div>
        <div className="admin-welcome-illustration" aria-hidden="true">⇪</div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box">{message}</div>}

      <section className="admin-module-group">
        <div className="admin-group-heading">
          <span>1</span>
          <div>
            <p className="eyebrow">Tipo de importación</p>
            <h2>Selecciona qué datos vas a cargar</h2>
            <p className="meta">Cada tipo tiene columnas mínimas y reglas de revisión diferentes.</p>
          </div>
          <a href="#plantilla">Ver plantilla</a>
        </div>

        <div className="admin-module-grid">
          {importOptions.map((option) => (
            <button className={`admin-module-card is-active ${importType === option.key ? 'active-filter' : ''}`} key={option.key} onClick={() => setImportType(option.key)} type="button">
              <div className="admin-module-card-head">
                <span className="admin-module-icon">{option.icon}</span>
                <span className="admin-status-pill active">{importType === option.key ? 'Seleccionado' : 'Disponible'}</span>
              </div>
              <p className="entity-type">{option.eyebrow}</p>
              <h3>{option.title}</h3>
              <p className="meta">{option.description}</p>
              <ul>
                {option.columns.slice(0, 4).map((column) => <li key={column}>{column}</li>)}
              </ul>
            </button>
          ))}
        </div>
      </section>

      <section className="admin-bottom-grid">
        <article className="card dashboard-section" id="plantilla">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Plantilla sugerida</p>
              <h2>{selectedOption.title}</h2>
              <p className="meta">Columnas mínimas recomendadas para iniciar la importación.</p>
            </div>
            <span className="role-pill">{selectedOption.columns.length} columnas</span>
          </div>

          <div className="admin-module-grid">
            {selectedOption.columns.map((column) => (
              <div className="admin-module-card" key={column}>
                <p className="entity-type">Columna</p>
                <h3>{column}</h3>
                <p className="meta">Debe venir normalizada antes de aplicar cambios definitivos.</p>
              </div>
            ))}
          </div>
        </article>

        <aside className="card admin-system-card">
          <p className="eyebrow">Reglas de seguridad</p>
          <h2>Antes de aplicar</h2>
          {selectedOption.notes.map((note) => (
            <div key={note}><span>{note}</span><strong>Requerido</strong></div>
          ))}
        </aside>
      </section>

      <section className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Archivo</p>
            <h2>Subir lote</h2>
            <p className="meta">Esta pantalla deja preparado el lote para la siguiente fase: lectura, previsualización, validación y aplicación.</p>
          </div>
          <span className="role-pill">Máx. 10 MB</span>
        </div>

        <form className="auth-form access-form">
          <label>
            Archivo CSV o Excel
            <input accept={acceptedExtensions} onChange={handleFileChange} type="file" />
          </label>
        </form>

        {selectedFile ? (
          <div className="admin-stat-strip" aria-label="Archivo seleccionado">
            <div><span>▤</span><strong>{selectedFile.extension.toUpperCase()}</strong><small>Formato</small></div>
            <div><span>⇪</span><strong>{formatBytes(selectedFile.size)}</strong><small>Tamaño</small></div>
            <div><span>◷</span><strong>{new Date(selectedFile.lastModified).toLocaleDateString('es-DO')}</strong><small>Modificado</small></div>
            <div><span>✓</span><strong>Listo</strong><small>Validación básica</small></div>
            <div><span>!</span><strong>Pendiente</strong><small>Procesamiento</small></div>
          </div>
        ) : (
          <div className="empty-state">
            <h3>Sin archivo seleccionado</h3>
            <p>Elige un archivo para validar tipo y tamaño antes de enviarlo a procesamiento.</p>
          </div>
        )}
      </section>
    </div>
  )
}
