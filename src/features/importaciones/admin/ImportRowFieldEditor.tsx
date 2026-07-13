'use client'

import { useEffect, useMemo, useState } from 'react'
import { SearchableSelect, type SearchableSelectOption } from '@/components/admin/SearchableSelect'
import { getImportRowFieldContract } from '@/features/importaciones/domain/import-row-field-contract'
import { getImportReferenceOptions } from '@/features/importaciones/services/import-reference-catalog-service'

export type ImportReferenceResolution = 'empty' | 'loading' | 'canonical' | 'provisional' | 'error'

type Props = {
  fieldName: string
  importType: string
  value: string
  onChange: (value: string) => void
  referenceOptions?: SearchableSelectOption[]
  onResolutionChange?: (resolution: ImportReferenceResolution) => void
}

export function ImportRowFieldEditor({
  fieldName,
  importType,
  value,
  onChange,
  referenceOptions,
  onResolutionChange,
}: Props) {
  const contract = getImportRowFieldContract(importType, fieldName)
  const controlId = `import-row-${fieldName}`
  const [catalogOptions, setCatalogOptions] = useState<SearchableSelectOption[]>(referenceOptions ?? [])
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    if (contract.kind !== 'reference' || !contract.referenceType || referenceOptions) return

    let active = true
    setIsLoadingCatalog(true)
    setCatalogError(null)

    void getImportReferenceOptions(contract.referenceType)
      .then((options) => {
        if (active) setCatalogOptions(options)
      })
      .catch((error) => {
        if (active) {
          setCatalogError(error instanceof Error ? error.message : 'No se pudo cargar el catálogo.')
          setCatalogOptions([])
        }
      })
      .finally(() => {
        if (active) setIsLoadingCatalog(false)
      })

    return () => { active = false }
  }, [contract.kind, contract.referenceType, referenceOptions, retryToken])

  const availableOptions = referenceOptions ?? catalogOptions
  const selectedCanonicalOption = useMemo(
    () => availableOptions.find((option) => option.value === value),
    [availableOptions, value],
  )

  const referenceState: ImportReferenceResolution = contract.kind !== 'reference' || !value.trim()
    ? 'empty'
    : isLoadingCatalog
      ? 'loading'
      : catalogError
        ? 'error'
        : selectedCanonicalOption
          ? 'canonical'
          : 'provisional'

  useEffect(() => {
    if (contract.kind === 'reference') onResolutionChange?.(referenceState)
  }, [contract.kind, onResolutionChange, referenceState])

  if (contract.kind === 'reference') {
    return (
      <div className="admin-import-reference-editor" data-reference-state={referenceState}>
        <SearchableSelect
          allowCustomValue
          disabled={false}
          help={contract.help}
          label={contract.label}
          onChange={onChange}
          options={availableOptions}
          placeholder={`Buscar ${contract.label.toLocaleLowerCase('es')}…`}
          value={value}
        />

        <div className="admin-import-reference-status" aria-live="polite">
          {referenceState === 'loading' ? (
            <span className="is-loading">Cargando opciones disponibles…</span>
          ) : referenceState === 'error' ? (
            <>
              <span className="is-error">No se pudo cargar el catálogo. Reintenta antes de guardar esta fila.</span>
              <button className="button button-secondary" onClick={() => setRetryToken((current) => current + 1)} type="button">
                Reintentar catálogo
              </button>
            </>
          ) : referenceState === 'canonical' ? (
            <span className="is-canonical">Referencia canónica seleccionada: {selectedCanonicalOption?.label}</span>
          ) : referenceState === 'provisional' ? (
            <span className="is-provisional">Referencia textual provisional. Selecciona una opción canónica antes de guardar.</span>
          ) : (
            <span className="is-empty">Selecciona una referencia canónica.</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <label htmlFor={controlId}>
      {contract.label}
      {contract.kind === 'select' || contract.kind === 'boolean' ? (
        <select id={controlId} onChange={(event) => onChange(event.target.value)} value={value}>
          <option value="">Seleccionar</option>
          {contract.options?.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : contract.kind === 'textarea' ? (
        <textarea id={controlId} onChange={(event) => onChange(event.target.value)} value={value} />
      ) : (
        <input id={controlId} onChange={(event) => onChange(event.target.value)} type={contract.kind} value={value} />
      )}
      {contract.help && <small className="meta">{contract.help}</small>}
    </label>
  )
}
