'use client'

import { useEffect, useRef } from 'react'

type Diocese = {
  id: string
  slug: string
  name: string
  entity_type_name: string | null
  ecclesiastical_province_name: string | null
}

type PastoralEntity = {
  id: string
  name: string
  slug: string
  diocese_id: string | null
  diocese_name: string | null
  diocese_slug: string | null
  level_name: string | null
  level_order: number | null
}

type DashboardData = {
  dioceses: Diocese[]
  pastoral_entities: PastoralEntity[]
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeForSearch(value: string) {
  return normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function isSpecialJurisdiction(item: Diocese) {
  const label = normalizeForSearch(`${item.entity_type_name ?? ''} ${item.name}`)
  return label.includes('ordinariato') || label.includes('militar') || label.includes('castrense') || label.includes('personal')
}

function findComboboxInput(labelText: string) {
  const labels = Array.from(document.querySelectorAll<HTMLLabelElement>('label'))
  const label = labels.find((item) => normalize(item.textContent ?? '').startsWith(labelText))
  return label?.querySelector<HTMLInputElement>('input.public-combobox-input') ?? null
}

function selectedComboboxValue(labelText: string) {
  return normalize(findComboboxInput(labelText)?.value ?? '')
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

function clickMetricByLabel(labelText: string) {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button.public-metric-card'))
  const target = buttons.find((button) => normalize(button.textContent ?? '').includes(labelText))
  target?.click()
}

function buildCard(icon: string, title: string, subtitle: string, actionLabel: string, onClick: () => void) {
  const card = document.createElement('article')
  card.className = 'public-province-card'

  const marker = document.createElement('span')
  marker.className = 'public-node-icon'
  marker.setAttribute('aria-hidden', 'true')
  marker.textContent = icon

  const button = document.createElement('button')
  button.type = 'button'
  button.addEventListener('click', onClick)

  const strong = document.createElement('strong')
  strong.textContent = title

  const span = document.createElement('span')
  span.textContent = subtitle

  const action = document.createElement('span')
  action.className = 'public-link'
  action.textContent = actionLabel

  button.append(strong, span)
  card.append(marker, button, action)
  return card
}

function groupCount<T>(items: T[], keyFn: (item: T) => string) {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = keyFn(item)
    if (!key) continue
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

function renderPastoralPanel(data: DashboardData) {
  const pastoralPanel = document.querySelector<HTMLElement>('#panel-pastoral')
  if (!pastoralPanel) return

  const country = selectedComboboxValue('País') || 'República Dominicana'
  const province = selectedComboboxValue('Provincia eclesiástica')
  const jurisdiction = selectedComboboxValue('Jurisdicción')
  const hasProvince = province && province !== 'Todas las provincias'
  const hasJurisdiction = jurisdiction && jurisdiction !== 'Todas las jurisdicciones'
  const mode = hasJurisdiction ? 'jurisdiction' : hasProvince ? 'province' : 'country'
  const signature = `${mode}|${country}|${province}|${jurisdiction}|${data.dioceses.length}|${data.pastoral_entities.length}`

  let container = pastoralPanel.querySelector<HTMLElement>('#public-pastoral-scope-panel')
  if (!container) {
    container = document.createElement('section')
    container.id = 'public-pastoral-scope-panel'
    container.className = 'public-content-grid public-province-content-grid'
    const metrics = pastoralPanel.querySelector('.public-metrics-grid')
    metrics?.insertAdjacentElement('afterend', container)
  }

  if (container.dataset.signature === signature) return
  container.dataset.signature = signature

  const territorialDioceses = data.dioceses.filter((item) => !isSpecialJurisdiction(item))
  const selectedJurisdiction = data.dioceses.find((item) => item.name === jurisdiction)
  const selectedJurisdictionSlugs = selectedJurisdiction ? new Set([selectedJurisdiction.slug]) : new Set<string>()
  const selectedProvinceDioceses = hasProvince ? territorialDioceses.filter((item) => item.ecclesiastical_province_name === province) : []
  const provinceNames = Array.from(groupCount(territorialDioceses, (item) => item.ecclesiastical_province_name ?? '').entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'))
  const scopeEntities = selectedJurisdiction
    ? data.pastoral_entities.filter((item) => !!item.diocese_slug && selectedJurisdictionSlugs.has(item.diocese_slug))
    : hasProvince
      ? data.pastoral_entities.filter((item) => selectedProvinceDioceses.some((diocese) => diocese.slug === item.diocese_slug))
      : data.pastoral_entities

  const levelCounts = Array.from(groupCount(scopeEntities, (item) => item.level_name ?? 'Sin nivel').entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'))

  const filterArticle = document.createElement('article')
  filterArticle.className = 'public-panel public-section-card'
  filterArticle.innerHTML = `<div class="public-section-title"><p class="eyebrow">Filtros pastorales</p><h2>${mode === 'country' ? 'Provincias eclesiásticas' : mode === 'province' ? 'Jurisdicciones de la provincia' : 'Niveles configurados'}</h2><p>Usa estas tarjetas para bajar el ámbito pastoral sin depender solo de los selectores superiores.</p></div>`
  const filterList = document.createElement('div')
  filterList.className = 'public-province-list'

  if (mode === 'country') {
    for (const [name, count] of provinceNames) {
      filterList.append(buildCard('⌂', name, `${count} jurisdicciones territoriales`, 'Filtrar →', () => chooseComboboxOption('Provincia eclesiástica', name)))
    }
  }

  if (mode === 'province') {
    for (const item of selectedProvinceDioceses) {
      filterList.append(buildCard('✝', item.name, item.entity_type_name ?? 'Jurisdicción', 'Filtrar →', () => chooseComboboxOption('Jurisdicción', item.name)))
    }
  }

  if (mode === 'jurisdiction') {
    for (const [name, count] of levelCounts.slice(0, 6)) {
      filterList.append(buildCard('▥', name, `${count} registros publicados`, 'Ver nivel →', () => clickMetricByLabel(name)))
    }
  }

  if (filterList.children.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'public-empty'
    empty.innerHTML = '<strong>Sin filtros pastorales publicados</strong><br /><span>Cuando existan niveles o nodos pastorales públicos para este ámbito, aparecerán aquí.</span>'
    filterList.append(empty)
  }

  filterArticle.append(filterList)

  const summaryArticle = document.createElement('article')
  summaryArticle.className = 'public-panel public-section-card'
  summaryArticle.innerHTML = `<div class="public-section-title"><p class="eyebrow">Estructura pastoral</p><h2>${scopeEntities.length} nodos publicados</h2><p>${mode === 'country' ? country : mode === 'province' ? province : jurisdiction}</p></div>`
  const summaryGrid = document.createElement('div')
  summaryGrid.className = 'public-directory-grid'

  for (const [name, count] of levelCounts.slice(0, 6)) {
    const item = document.createElement('button')
    item.className = 'public-directory-item public-directory-button'
    item.type = 'button'
    item.addEventListener('click', () => clickMetricByLabel(name))
    item.innerHTML = `<strong>${name}</strong><span>${count} registros · Nivel pastoral</span>`
    summaryGrid.append(item)
  }

  if (summaryGrid.children.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'public-empty'
    empty.innerHTML = '<strong>Vista pastoral en preparación</strong><br /><span>Falta publicar la estructura pastoral para este ámbito.</span>'
    summaryGrid.append(empty)
  }

  summaryArticle.append(summaryGrid)
  container.replaceChildren(filterArticle, summaryArticle)
}

export function PublicPastoralEnhancements() {
  const dataRef = useRef<DashboardData | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch('/api/dashboard/vistas')
        if (!response.ok) return
        const data = await response.json() as DashboardData
        if (cancelled) return
        dataRef.current = data
        renderPastoralPanel(data)
      } catch (error) {
        console.warn('No se pudo mejorar la vista pastoral', error)
      }
    }

    load()

    const observer = new MutationObserver(() => {
      if (dataRef.current) renderPastoralPanel(dataRef.current)
    })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    const timer = window.setInterval(() => {
      if (dataRef.current) renderPastoralPanel(dataRef.current)
    }, 800)

    return () => {
      cancelled = true
      observer.disconnect()
      window.clearInterval(timer)
    }
  }, [])

  return null
}
