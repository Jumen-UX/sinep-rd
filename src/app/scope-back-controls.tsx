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

function selectedComboboxValue(labelText: string) {
  const input = findComboboxInput(labelText)
  return normalize(input?.value ?? '')
}

function isDefaultValue(value: string, defaults: string[]) {
  const normalized = normalize(value).toLowerCase()
  return !normalized || defaults.some((item) => normalized === item.toLowerCase())
}

function clickButtonByText(text: string) {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((item) => normalize(item.textContent ?? '').includes(text))
  button?.click()
}

function chooseComboboxOption(labelText: string, optionText: string) {
  const input = findComboboxInput(labelText)
  if (!input) return

  input.focus()
  input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'ArrowDown' }))

  window.setTimeout(() => {
    const option = Array.from(document.querySelectorAll<HTMLButtonElement>('.public-combobox-option')).find((item) => normalize(item.textContent ?? '') === optionText)
    option?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
  }, 70)
}

function clearTerritorialLevel() {
  clickButtonByText('Limpiar filtro territorial')
}

function backToProvince() {
  clearTerritorialLevel()
  chooseComboboxOption('Jurisdicción', 'Todas las jurisdicciones')
}

function backToCountry() {
  const clearButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button.public-clear-button')).find((item) => normalize(item.textContent ?? '').includes('Limpiar filtros'))
  clearButton?.click()
}

function buildButton(label: string, action: () => void) {
  const button = document.createElement('button')
  button.className = 'public-scope-back-button'
  button.type = 'button'
  button.textContent = label
  button.addEventListener('click', action)
  return button
}

function buildCrumb(label: string, active = false) {
  const span = document.createElement('span')
  span.className = `public-scope-crumb ${active ? 'active' : ''}`
  span.textContent = label
  return span
}

function updateBackbar() {
  const filterPanel = document.querySelector<HTMLElement>('.public-filter-panel')
  if (!filterPanel) return

  let bar = document.querySelector<HTMLElement>('#public-scope-backbar')
  if (!bar) {
    bar = document.createElement('section')
    bar.id = 'public-scope-backbar'
    bar.className = 'public-scope-backbar'
    bar.setAttribute('aria-label', 'Ruta del ámbito seleccionado')
    filterPanel.insertAdjacentElement('afterend', bar)
  }

  const country = selectedComboboxValue('País') || 'República Dominicana'
  const province = selectedComboboxValue('Provincia eclesiástica')
  const jurisdiction = selectedComboboxValue('Jurisdicción')
  const hasProvince = !isDefaultValue(province, ['Todas las provincias'])
  const hasJurisdiction = !isDefaultValue(jurisdiction, ['Todas las jurisdicciones'])
  const hasTerritorialLevel = !!Array.from(document.querySelectorAll<HTMLButtonElement>('button.public-clear-button')).find((item) => normalize(item.textContent ?? '').includes('Limpiar filtro territorial'))

  if (!hasProvince && !hasJurisdiction && !hasTerritorialLevel) {
    bar.hidden = true
    bar.replaceChildren()
    return
  }

  bar.hidden = false

  const route = document.createElement('div')
  route.className = 'public-scope-route'
  route.append(buildCrumb(country, !hasProvince && !hasJurisdiction))

  if (hasProvince) {
    route.append(buildCrumb('›'))
    route.append(buildCrumb(province, !hasJurisdiction && !hasTerritorialLevel))
  }

  if (hasJurisdiction) {
    route.append(buildCrumb('›'))
    route.append(buildCrumb(jurisdiction, !hasTerritorialLevel))
  }

  if (hasTerritorialLevel) {
    route.append(buildCrumb('›'))
    route.append(buildCrumb('Filtro territorial', true))
  }

  const actions = document.createElement('div')
  actions.className = 'public-scope-back-actions'

  if (hasTerritorialLevel) actions.append(buildButton('← Volver a la diócesis', clearTerritorialLevel))
  if (hasJurisdiction) actions.append(buildButton('← Volver a la provincia', backToProvince))
  if (hasProvince || hasJurisdiction || hasTerritorialLevel) actions.append(buildButton('Volver al país', backToCountry))

  const label = document.createElement('span')
  label.className = 'public-scope-back-label'
  label.textContent = 'Ubicación actual'

  bar.replaceChildren(label, route, actions)
}

export function ScopeBackControls() {
  useEffect(() => {
    updateBackbar()

    const observer = new MutationObserver(() => updateBackbar())
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    const timer = window.setInterval(updateBackbar, 650)

    return () => {
      observer.disconnect()
      window.clearInterval(timer)
    }
  }, [])

  return null
}
