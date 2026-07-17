'use client'

import { useEffect, useId, useMemo, useState } from 'react'

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
  const helpId = `${inputId}-help`
  const statusId = `${inputId}-status`
  const selected = options.find((option) => option.value === value)
  const [query, setQuery] = useState(selected?.label ?? value)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es')
    if (!normalized) return options.slice(0, 20)
    return options
      .filter((option) => `${option.label} ${option.description ?? ''}`.toLocaleLowerCase('es').includes(normalized))
      .slice(0, 20)
  }, [options, query])

  const activeOption = activeIndex >= 0 ? filteredOptions[activeIndex] : undefined
  const activeOptionId = activeOption ? `${listId}-${activeIndex}` : undefined

  useEffect(() => {
    setQuery(selected?.label ?? value)
  }, [selected?.label, value])

  useEffect(() => {
    setActiveIndex((current) => current >= filteredOptions.length ? filteredOptions.length - 1 : current)
  }, [filteredOptions.length])

  function selectOption(option: SearchableSelectOption) {
    onChange(option.value)
    setQuery(option.label)
    setOpen(false)
    setActiveIndex(-1)
  }

  function commitCustomValue() {
    if (!allowCustomValue) return
    onChange(query.trim())
    setOpen(false)
    setActiveIndex(-1)
  }

  function moveActiveIndex(direction: 1 | -1) {
    if (filteredOptions.length === 0) return
    setOpen(true)
    setActiveIndex((current) => {
      if (current < 0) return direction === 1 ? 0 : filteredOptions.length - 1
      return (current + direction + filteredOptions.length) % filteredOptions.length
    })
  }

  return (
    <label htmlFor={inputId}>
      {label}
      <div className="admin-searchable-select">
        <input
          aria-activedescendant={activeOptionId}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-describedby={[help ? helpId : null, open ? statusId : null].filter(Boolean).join(' ') || undefined}
          aria-expanded={open}
          aria-haspopup="listbox"
          autoComplete="off"
          disabled={disabled}
          id={inputId}
          onBlur={() => window.setTimeout(() => {
            setOpen(false)
            setActiveIndex(-1)
          }, 120)}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setActiveIndex(-1)
            if (allowCustomValue) onChange(event.target.value)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              moveActiveIndex(1)
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              moveActiveIndex(-1)
            } else if (event.key === 'Home' && open && filteredOptions.length > 0) {
              event.preventDefault()
              setActiveIndex(0)
            } else if (event.key === 'End' && open && filteredOptions.length > 0) {
              event.preventDefault()
              setActiveIndex(filteredOptions.length - 1)
            } else if (event.key === 'Enter' && activeOption) {
              event.preventDefault()
              selectOption(activeOption)
            } else if (event.key === 'Enter' && filteredOptions.length === 1) {
              event.preventDefault()
              selectOption(filteredOptions[0])
            } else if (event.key === 'Enter') {
              commitCustomValue()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              setOpen(false)
              setActiveIndex(-1)
              setQuery(selected?.label ?? value)
            } else if (event.key === 'Tab') {
              setOpen(false)
              setActiveIndex(-1)
            }
          }}
          placeholder={placeholder}
          role="combobox"
          value={query}
        />
        {open && (
          <div className="admin-searchable-select-menu" id={listId} role="listbox">
            {filteredOptions.length > 0 ? filteredOptions.map((option, index) => (
              <button
                aria-selected={option.value === value}
                className={index === activeIndex ? 'is-active' : undefined}
                id={`${listId}-${index}`}
                key={option.value}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option)}
                role="option"
                tabIndex={-1}
                type="button"
              >
                <strong>{option.label}</strong>
                {option.description && <span>{option.description}</span>}
              </button>
            )) : (
              <p className="meta" id={statusId} role="status">No hay coincidencias.</p>
            )}
          </div>
        )}
      </div>
      {help && <small className="meta" id={helpId}>{help}</small>}
    </label>
  )
}
