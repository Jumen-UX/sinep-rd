'use client'

import { useEffect, useMemo, useState } from 'react'
import { loadAdministrativeDocuments, type AdministrativeDocumentRow } from '@/features/documents/services/document-admin-service'
import { createClient } from '@/lib/supabase/client'

type JurisdictionDocumentSelectProps = {
  name?: string
  required?: boolean
  label?: string
  allowEmpty?: boolean
}

function formatDocumentLabel(row: AdministrativeDocumentRow) {
  const identity = [row.document_type.replaceAll('_', ' '), row.document_number].filter(Boolean).join(' · ')
  const context = [row.document_date, row.issuing_authority].filter(Boolean).join(' · ')
  return `${row.title}${identity ? ` — ${identity}` : ''}${context ? ` (${context})` : ''}`
}

export default function JurisdictionDocumentSelect({
  name = 'source',
  required = false,
  label = 'Documento fuente',
  allowEmpty = true,
}: JurisdictionDocumentSelectProps) {
  const supabase = useMemo(() => createClient(), [])
  const [documents, setDocuments] = useState<AdministrativeDocumentRow[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const rows = await loadAdministrativeDocuments(supabase, {
          scopeId: null,
          search: null,
          visibility: null,
          includeInactive: false,
          limit: 500,
        })
        if (!cancelled) setDocuments(rows)
      } catch (loadError) {
        if (!cancelled) {
          setDocuments([])
          setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los documentos.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [supabase])

  const filtered = documents.filter((row) => {
    const needle = query.trim().toLocaleLowerCase('es')
    if (!needle) return true
    return [row.title, row.document_type, row.document_number, row.issuing_authority, row.document_date]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase('es').includes(needle))
  })

  return (
    <fieldset>
      <legend>{label}{required ? ' *' : ''}</legend>
      <label>
        <span className="sr-only">Buscar documento fuente</span>
        <input
          aria-describedby={error ? `${name}-document-error` : undefined}
          disabled={loading}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={loading ? 'Cargando documentos…' : 'Buscar por título, tipo, número o autoridad…'}
          type="search"
          value={query}
        />
      </label>
      <label>
        <span className="sr-only">Seleccionar documento fuente</span>
        <select disabled={loading || Boolean(error)} name={name} required={required} defaultValue="">
          {allowEmpty && <option value="">Sin documento asociado</option>}
          {!allowEmpty && <option value="" disabled>Selecciona un documento</option>}
          {filtered.map((row) => (
            <option key={row.id} value={row.id}>{formatDocumentLabel(row)}</option>
          ))}
        </select>
      </label>
      {!loading && !error && documents.length === 0 && <small>No hay documentos disponibles en tu alcance administrativo.</small>}
      {!loading && !error && documents.length > 0 && filtered.length === 0 && <small>No hay documentos que coincidan con la búsqueda.</small>}
      {error && <small id={`${name}-document-error`} role="alert">{error} Abre Documentos para revisar tu alcance.</small>}
    </fieldset>
  )
}
