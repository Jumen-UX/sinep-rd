'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import styles from './profile-combobox.module.css'

export type ProfileComboboxOption = {
  value: string
  label: string
  keywords?: string
}

type Props = {
  id: string
  value: string
  options: ProfileComboboxOption[]
  onChange: (value: string) => void
  searchable?: boolean
  searchPlaceholder?: string
  emptyMessage?: string
  ariaLabel: string
}

export default function ProfileCombobox({
  id,
  value,
  options,
  onChange,
  searchable = false,
  searchPlaceholder = 'Buscar…',
  emptyMessage = 'No hay resultados.',
  ariaLabel,
}: Props) {
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const selectedOption = options.find((option) => option.value === value) ?? options[0]
  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return options
    return options.filter((option) => `${option.label} ${option.value} ${option.keywords ?? ''}`.toLocaleLowerCase().includes(normalized))
  }, [options, query])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }

    const selectedIndex = filteredOptions.findIndex((option) => option.value === value)
    const nextIndex = selectedIndex >= 0 ? selectedIndex : 0
    setActiveIndex(nextIndex)

    window.requestAnimationFrame(() => {
      rootRef.current?.scrollIntoView({ block: 'nearest' })
      if (searchable) searchRef.current?.focus()
      else optionRefs.current[nextIndex]?.focus()
    })
  }, [filteredOptions, open, searchable, value])

  function closeAndRestoreFocus() {
    setOpen(false)
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  function selectOption(option: ProfileComboboxOption) {
    onChange(option.value)
    closeAndRestoreFocus()
  }

  function moveActive(delta: number) {
    if (filteredOptions.length === 0) return
    const next = (activeIndex + delta + filteredOptions.length) % filteredOptions.length
    setActiveIndex(next)
    optionRefs.current[next]?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeAndRestoreFocus()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveActive(1)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveActive(-1)
      return
    }
    if (event.key === 'Home' && filteredOptions.length > 0) {
      event.preventDefault()
      setActiveIndex(0)
      optionRefs.current[0]?.focus()
      return
    }
    if (event.key === 'End' && filteredOptions.length > 0) {
      event.preventDefault()
      const last = filteredOptions.length - 1
      setActiveIndex(last)
      optionRefs.current[last]?.focus()
    }
  }

  return (
    <div className={`${styles.root} ${open ? styles.rootOpen : ''}`} ref={rootRef}>
      <button
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={styles.trigger}
        id={id}
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        <span>{selectedOption?.label ?? value}</span>
        <svg aria-hidden="true" className={styles.chevron} viewBox="0 0 20 20"><path d="m5.5 7.5 4.5 4.5 4.5-4.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
      </button>

      {open ? (
        <div className={styles.popover} data-searchable={searchable} onKeyDown={handleKeyDown}>
          {searchable ? (
            <div className={styles.searchWrap}>
              <svg aria-hidden="true" viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" fill="none" r="5.5" stroke="currentColor" strokeWidth="1.6" /><path d="m13 13 4 4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" /></svg>
              <input
                aria-label={searchPlaceholder}
                autoComplete="off"
                className={styles.search}
                onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }}
                placeholder={searchPlaceholder}
                ref={searchRef}
                value={query}
              />
            </div>
          ) : null}

          <div aria-label={ariaLabel} className={styles.listbox} id={listboxId} role="listbox">
            {filteredOptions.length === 0 ? <p className={styles.empty}>{emptyMessage}</p> : filteredOptions.map((option, index) => {
              const selected = option.value === value
              return (
                <button
                  aria-selected={selected}
                  className={`${styles.option} ${selected ? styles.selected : ''}`}
                  key={option.value}
                  onClick={() => selectOption(option)}
                  onFocus={() => setActiveIndex(index)}
                  ref={(node) => { optionRefs.current[index] = node }}
                  role="option"
                  tabIndex={index === activeIndex ? 0 : -1}
                  type="button"
                >
                  <span>{option.label}</span>
                  {selected ? <span aria-hidden="true" className={styles.check}>✓</span> : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
