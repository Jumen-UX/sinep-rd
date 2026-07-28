'use client'

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/ui/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { PageState } from '@/components/ui/page-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { useAdminNavigation } from '@/features/admin/navigation/AdminNavigationProvider'
import { createClient } from '@/lib/supabase/client'
import {
  downloadDocumentsCsv,
  loadAdministrativeDocuments,
  type AdministrativeDocumentRow,
} from '../services/document-admin-service'

const visibilityOptions = [
  { value: '', label: 'Todas las visibilidades' },
  { value: 'public', label: 'Pública' },
  { value: 'internal', label: 'Interna' },
  { value: 'private', label: 'Privada' },
  { value: 'confidential', label: 'Confidencial' },
]

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

function readableValue(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function visibilityTone(value: string): 'neutral' | 'info' | 'warning' | 'danger' {
  if (value === 'public') return 'info'
  if (value === 'private' || value === 'confidential') return 'danger'
  if (value === 'internal') return 'warning'
  return 'neutral'
}

function documentSource(row: AdministrativeDocumentRow) {
  if (row.external_url) return 'Enlace externo'
  if (row.file_path) return 'Archivo interno'
  return 'Referencia documental'
}

export default function AdministrativeDocumentsPage() {
  const supabase = useMemo(() => createClient(), [])
  const navigation = useAdminNavigation()
  const [rows, setRows] = useState<AdministrativeDocumentRow[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [visibility, setVisibility] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const activeScope = navigation.context?.activeScope ?? null
  const activeScopeId = activeScope?.entityId ?? null

  const loadRows = useCallback(async () => {
    if (!navigation.context || navigation.context.accessState !== 'ready') return

    setLoading(true)
    setError(null)

    try {
      const documents = await loadAdministrativeDocuments(supabase, {
        scopeId: activeScopeId,
        search: appliedSearch || null,
        visibility: visibility || null,
        includeInactive,
        limit: 750,
      })
      setRows(documents)
    } catch (loadError) {
      setRows([])
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el directorio documental.')
    } finally {
      setLoading(false)
    }
  }, [activeScopeId, appliedSearch, includeInactive, navigation.context, supabase, visibility])

  useEffect(() => {
    if (navigation.loading) return
    void loadRows()
  }, [loadRows, navigation.loading])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAppliedSearch(searchInput.trim().replace(/\s+/g, ' '))
  }

  if (navigation.loading) {
    return <PageState compact kind="loading" title="Preparando documentos" description="Estamos resolviendo tu alcance documental." />
  }

  if (!navigation.context || navigation.context.accessState !== 'ready') {
    return <PageState kind="error" title="Acceso documental no disponible" description="Necesitas un acceso administrativo activo para consultar documentos." />
  }

  return (
    <main className="container admin-dashboard">
      <PageHeader
        breadcrumbs={[
          { label: 'Administración', href: '/admin' },
          { label: 'Documentos' },
        ]}
        eyebrow="Repositorio documental"
        title="Documentos administrativos"
        description="Consulta y exporta únicamente los documentos visibles dentro del alcance territorial o pastoral activo."
        metadata={
          <>
            <StatusBadge tone="info" dot>{activeScope?.label ?? 'Alcance resuelto automáticamente'}</StatusBadge>
            <StatusBadge tone={rows.length > 0 ? 'neutral' : 'warning'}>{rows.length} documento{rows.length === 1 ? '' : 's'}</StatusBadge>
          </>
        }
        actions={
          <Button
            disabled={loading || rows.length === 0}
            onClick={() => downloadDocumentsCsv(rows)}
            type="button"
            variant="secondary"
          >
            Exportar CSV
          </Button>
        }
      />

      <section className="card admin-section" aria-labelledby="document-security-note">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Control documental</p>
            <h2 id="document-security-note">Carga de archivos temporalmente deshabilitada</h2>
            <p className="meta">
              El sistema todavía no dispone de un bucket documental privado. La consulta y la exportación están habilitadas;
              la carga se activará cuando objeto, metadatos y auditoría puedan guardarse en una sola operación segura.
            </p>
          </div>
          <StatusBadge tone="warning">Solo lectura</StatusBadge>
        </div>
      </section>

      <section className="card admin-section" aria-labelledby="document-filters-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Filtros</p>
            <h2 id="document-filters-heading">Buscar en el alcance activo</h2>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleSearch}>
          <label className="full-width">
            Buscar
            <input
              maxLength={120}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Título, número, autoridad o descripción"
              type="search"
              value={searchInput}
            />
          </label>
          <label>
            Visibilidad
            <select value={visibility} onChange={(event) => setVisibility(event.target.value)}>
              {visibilityOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Estado incluido
            <select
              value={includeInactive ? 'all' : 'current'}
              onChange={(event) => setIncludeInactive(event.target.value === 'all')}
            >
              <option value="current">Activos, aprobados y en revisión</option>
              <option value="all">Incluir inactivos y archivados</option>
            </select>
          </label>
          <div className="button-row full-width">
            <Button type="submit">Aplicar búsqueda</Button>
            <Button
              onClick={() => {
                setSearchInput('')
                setAppliedSearch('')
                setVisibility('')
                setIncludeInactive(false)
              }}
              type="button"
              variant="secondary"
            >
              Limpiar filtros
            </Button>
          </div>
        </form>
      </section>

      {loading ? (
        <PageState compact kind="loading" title="Cargando documentos" description="Consultando el repositorio dentro de tu alcance." />
      ) : error ? (
        <PageState kind="error" title="No pudimos cargar los documentos" description={error} />
      ) : rows.length === 0 ? (
        <PageState kind="empty" title="Sin documentos visibles" description="No hay documentos que coincidan con el alcance y los filtros seleccionados." />
      ) : (
        <DataTable caption="Documentos administrativos visibles">
          <DataTableHeader>
            <DataTableRow>
              <DataTableHead>Documento</DataTableHead>
              <DataTableHead>Fecha</DataTableHead>
              <DataTableHead>Visibilidad</DataTableHead>
              <DataTableHead>Estado</DataTableHead>
              <DataTableHead>País</DataTableHead>
              <DataTableHead>Fuente</DataTableHead>
            </DataTableRow>
          </DataTableHeader>
          <DataTableBody>
            {rows.map((row) => (
              <DataTableRow key={row.id}>
                <DataTableCell>
                  <div className="flex min-w-64 flex-col gap-1">
                    <strong>{row.title}</strong>
                    <span className="text-[var(--text-muted)]">
                      {readableValue(row.document_type)}{row.document_number ? ` · ${row.document_number}` : ''}
                    </span>
                    {row.issuing_authority ? <span className="text-[var(--text-muted)]">{row.issuing_authority}</span> : null}
                  </div>
                </DataTableCell>
                <DataTableCell>{formatDate(row.document_date)}</DataTableCell>
                <DataTableCell><StatusBadge tone={visibilityTone(row.visibility)}>{readableValue(row.visibility)}</StatusBadge></DataTableCell>
                <DataTableCell><StatusBadge tone="neutral">{readableValue(row.status)}</StatusBadge></DataTableCell>
                <DataTableCell>{row.country_iso2 ?? '—'}</DataTableCell>
                <DataTableCell>
                  {row.external_url ? (
                    <a href={row.external_url} rel="noopener noreferrer" target="_blank">Abrir enlace</a>
                  ) : documentSource(row)}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
    </main>
  )
}
