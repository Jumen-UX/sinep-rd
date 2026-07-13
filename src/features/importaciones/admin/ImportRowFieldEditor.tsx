'use client'

import { useEffect, useState } from 'react'
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
  }, [contract.kind, contract.referenceType, referenceOptions])

  if (contract.kind === 'reference') {
    const help = [
      contract.help,
      isLoadingCatalog ? 'Cargando opciones disponibles…' : null,
      catalogError ? 'No se pudo cargar el catálogo; puedes conservar una referencia textual exacta.' : null,
    ].filter(Boolean).join(' ')

    return (
      <SearchableSelect
        allowCustomValue
        disabled={false}
        help={help}
        label={contract.label}
        onChange={onChange}
        options={referenceOptions ?? catalogOptions}
        placeholder={`Buscar ${contract.label.toLocaleLowerCase('es')}…`}
        value={value}
      />
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
