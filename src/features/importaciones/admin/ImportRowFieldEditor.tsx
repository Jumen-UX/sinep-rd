import { SearchableSelect, type SearchableSelectOption } from '@/components/admin/SearchableSelect'
import { getImportRowFieldContract } from '@/features/importaciones/domain/import-row-field-contract'

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
  referenceOptions = [],
}: Props) {
  const contract = getImportRowFieldContract(importType, fieldName)
  const controlId = `import-row-${fieldName}`

  if (contract.kind === 'reference') {
    return (
      <SearchableSelect
        allowCustomValue
        help={contract.help}
        label={contract.label}
        onChange={onChange}
        options={referenceOptions}
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
