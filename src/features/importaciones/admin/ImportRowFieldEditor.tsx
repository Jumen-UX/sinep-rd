'use client'

import { useEffect, useMemo, useState } from 'react'
import { SearchableSelect, type SearchableSelectOption } from '@/components/admin/SearchableSelect'
import { getImportRowFieldContract } from '@/features/importaciones/domain/import-row-field-contract'
import { getImportReferenceOptions } from '@/features/importaciones/services/import-reference-catalog-service'

type Props = {
  fieldName: string
  importType: string
  value: string
  onChange: (value: string) => void
  referenceOptions?: SearchableSelectOption[]
}

export function ImportRowFieldEditor({
  fieldName,
  importType,
  value,
  onChange,
  referenceOptions,
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

  if (contract.kind === 'reference') {
    const referenceState = isLoadingCatalog
      ? 'loading'
      : catalogError
        ? 'error'
        : selectedCanonicalOption
          ? 'canonical'
          : value.trim()
            ? 'provisional'
            : 'empty'

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
          {isLoadingCatalog ? (
            <span className="is-loading">Cargando opciones disponibles…</span>
          ) : catalogError ? (
            <>
              <span className="is-error">No se pudo cargar el catálogo. Puedes conservar una referencia textual exacta.</span>
              <button className="button button-secondary" onClick={() => setRetryToken((current) => current + 1)} type="button">
                Reintentar catálogo
              </button>
            </>
          ) : selectedCanonicalOption ? (
            <span className="is-canonical">Referencia canónica seleccionada: {selectedCanonicalOption.label}</span>
          ) : value.trim() ? (
            <span className="is-provisional">Referencia textual provisional. Debe resolverse durante la validación del lote.</span>
          ) : (
            <span className="is-empty">Selecciona una referencia canónica o escribe una referencia exacta.</span>
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
        <input
          id={controlId}
          onChange={(event) => onChange(event.target.value)}
          type={contract.kind}
          value={value}
        />
      )}
      {contract.help && <small className="meta">{contract.help}</small>}
    </label>
  )
}
