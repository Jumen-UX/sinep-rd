'use client'

import { useEffect } from 'react'

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function findComboboxInput(labelText: string) {
  const labels = Array.from(document.querySelectorAll<HTMLLabelElement>('label'))
  const label = labels.find((item) => normalize(item.textContent ?? '').startsWith(labelText))
  return label?.querySelector<HTMLInputElement>('input.public-combobox-input') ?? null
}

function chooseComboboxOption(labelText: string, optionText: string) {
  const input = findComboboxInput(labelText)
  if (!input) return

  input.focus()
  input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'ArrowDown' }))

  window.setTimeout(() => {
    const options = Array.from(document.querySelectorAll<HTMLButtonElement>('.public-combobox-option'))
    const option = options.find((item) => normalize(item.textContent ?? '') === optionText)
    option?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
  }, 70)
}

function isJurisdictionListAnchor(anchor: HTMLAnchorElement) {
  if (!anchor.getAttribute('href')?.startsWith('/entidades/')) return false

  const section = anchor.closest<HTMLElement>('.public-section-card')
  const sectionText = normalize(section?.textContent ?? '')

  return sectionText.includes('Jurisdicciones territoriales')
    || sectionText.includes('Jurisdicciones de la provincia')
    || sectionText.includes('Jurisdicciones especiales')
}

function extractJurisdictionName(anchor: HTMLAnchorElement) {
  const strong = anchor.querySelector('strong')
  return normalize(strong?.textContent ?? '')
}

export function PublicJurisdictionStructureNavigation() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null
      const anchor = target?.closest<HTMLAnchorElement>('a.public-row, a.public-directory-item')
      if (!anchor || !isJurisdictionListAnchor(anchor)) return

      const jurisdictionName = extractJurisdictionName(anchor)
      if (!jurisdictionName) return

      event.preventDefault()
      event.stopPropagation()
      chooseComboboxOption('Jurisdicción', jurisdictionName)
    }

    document.addEventListener('click', handleClick, true)

    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  return null
}
