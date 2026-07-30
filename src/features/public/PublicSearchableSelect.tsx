'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'

export type PublicSearchableOption = {
  value: string
  label: string
}

type Props = {
  label: string
  value: string
  options: PublicSearchableOption[]
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function PublicSearchableSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = 'Buscar y seleccionar',
}: Props) {
  const inputId = useId()
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedOption = options.find((option) => option.value === value) ?? null
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(selectedOption?.label ?? '')
  const [activeIndex, setActiveIndex] = useState(0)

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalize(query)
    if (!normalizedQuery || selectedOption?.label === query) return options
    return options.filter((option) => normalize(option.label).includes(normalizedQuery))
  }, [options, query, selectedOption?.label])

  useEffect(() => {
    if (!open) setQuery(selectedOption?.label ?? '')
  }, [open, selectedOption?.label])

  useEffect(() => {
    if (!open || filteredOptions.length === 0) return
    const safeIndex = Math.min(activeIndex, filteredOptions.length - 1)
    if (safeIndex !== activeIndex) {
      setActiveIndex(safeIndex)
      return
    }
    optionRefs.current[safeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, filteredOptions.length, open])

  function selectOption(option: PublicSearchableOption) {
    onChange(option.value)
    setQuery(option.label)
    setOpen(false)
    setActiveIndex(0)
  }

  function openList() {
    if (disabled || open) return
    setQuery('')
    setOpen(true)
    setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)))
  }

  function closeList() {
    setOpen(false)
    setQuery(selectedOption?.label ?? '')
    setActiveIndex(0)
  }

  function moveActive(delta: number) {
    if (filteredOptions.length === 0) return
    setActiveIndex((current) => {
      const safeCurrent = Math.min(Math.max(current, 0), filteredOptions.length - 1)
      return Math.min(Math.max(safeCurrent + delta, 0), filteredOptions.length - 1)
    })
  }

  return (
    <label htmlFor={inputId}>
      {label}
      <div
        className="public-combobox"
        onBlur={(event) => {
          if (!rootRef.current?.contains(event.relatedTarget as Node | null)) closeList()
        }}
        ref={rootRef}
      >
        <input
          aria-activedescendant={open && filteredOptions[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          autoComplete="off"
          className="public-combobox-input"
          disabled={disabled}
          id={inputId}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setActiveIndex(0)
          }}
          onClick={openList}
          onFocus={openList}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setOpen(true)
              moveActive(1)
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setOpen(true)
              moveActive(-1)
            } else if (event.key === 'Home' && open && filteredOptions.length > 0) {
              event.preventDefault()
              setActiveIndex(0)
            } else if (event.key === 'End' && open && filteredOptions.length > 0) {
              event.preventDefault()
              setActiveIndex(filteredOptions.length - 1)
            } else if (event.key === 'Enter' && open && filteredOptions[activeIndex]) {
              event.preventDefault()
              selectOption(filteredOptions[activeIndex])
            } else if (event.key === 'Escape') {
              event.preventDefault()
              closeList()
            }
          }}
          placeholder={placeholder}
          role="combobox"
          value={query}
        />
        <button
          aria-label={open ? `Cerrar opciones de ${label}` : `Abrir opciones de ${label}`}
          className="public-combobox-toggle"
          disabled={disabled}
          onClick={() => (open ? closeList() : openList())}
          tabIndex={-1}
          type="button"
        >
          <span aria-hidden="true">⌄</span>
        </button>
        {open ? (
          <div className="public-combobox-list" id={listboxId} role="listbox">
            {filteredOptions.length === 0 ? (
              <div className="public-combobox-empty" role="status">Sin resultados</div>
            ) : filteredOptions.map((option, index) => (
              <button
                aria-selected={option.value === value}
                className={`public-combobox-option ${index === activeIndex ? 'active' : ''}`}
                id={`${listboxId}-${index}`}
                key={option.value || '__all__'}
                onClick={() => selectOption(option)}
                onMouseEnter={() => setActiveIndex(index)}
                ref={(node) => { optionRefs.current[index] = node }}
                role="option"
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </label>
  )
}
