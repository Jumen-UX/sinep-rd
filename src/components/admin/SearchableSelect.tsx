'use client'

import { useId, useMemo, useState } from 'react'

export type SearchableSelectOption = {
  value: string
  label: string
  description?: string
}

type Props = {
  label: string
  value: string
  options: SearchableSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  help?: string
  allowCustomValue?: boolean
  disabled?: boolean
}

export function SearchableSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Buscar…',
  help,
  allowCustomValue = false,
  disabled = false,
}: Props) {
  const inputId = useId()
  const listId = `${inputId}-options`
  const selected = options.find((option) => option.value === value)
  const [query, setQuery] = useState(selected?.label ?? value)
  const [open, setOpen] = useState(false)

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es')
    if (!normalized) return options.slice(0, 20)
    return options
      .filter((option) => `${option.label} ${option.description ?? ''}`.toLocaleLowerCase('es').includes(normalized))
      .slice(0, 20)
  }, [options, query])

  function commitCustomValue() {
    if (!allowCustomValue) return
    onChange(query.trim())
    setOpen(false)
  }

  return (
    <label htmlFor={inputId}>
      {label}
      <div className="admin-searchable-select">
        <input
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          autoComplete="off"
          disabled={disabled}
          id={inputId}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            if (allowCustomValue) onChange(event.target.value)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && filteredOptions.length === 1) {
              event.preventDefault()
              const option = filteredOptions[0]
              onChange(option.value)
              setQuery(option.label)
              setOpen(false)
            } else if (event.key === 'Enter') {
              commitCustomValue()
            } else if (event.key === 'Escape') {
              setOpen(false)
            }
          }}
          placeholder={placeholder}
          role="combobox"
          value={query}
        />
        {open && (
          <div className="admin-searchable-select-menu" id={listId} role="listbox">
            {filteredOptions.length > 0 ? filteredOptions.map((option) => (
              <button
                aria-selected={option.value === value}
                key={option.value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value)
                  setQuery(option.label)
                  setOpen(false)
                }}
                role="option"
                type="button"
              >
                <strong>{option.label}</strong>
                {option.description && <span>{option.description}</span>}
              </button>
            )) : (
              <p className="meta">No hay coincidencias.</p>
            )}
          </div>
        )}
      </div>
      {help && <small className="meta">{help}</small>}
    </label>
  )
}
