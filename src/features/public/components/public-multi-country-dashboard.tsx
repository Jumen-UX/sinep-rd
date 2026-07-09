'use client'

import { useEffect, useRef } from 'react'

type Country = {
  key: string
  iso2?: string | null
  name: string
  official_name?: string | null
}

type Diocese = {
  id: string
  slug: string
  name: string
  entity_type_name: string | null
  ecclesiastical_province_name: string | null
  current_ordinary_name: string | null
  country_iso2?: string | null
  country_name?: string | null
}

type Parish = {
  id: string
  diocese_id: string | null
  diocese_name: string | null
  diocese_slug: string | null
}

type DashboardData = {
  countries?: Country[]
  dioceses?: Diocese[]
  parishes?: Parish[]
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeForSearch(value: string) {
  return normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-DO').format(value)
}

function isSpecialJurisdiction(item: Diocese) {
  const label = normalizeForSearch(`${item.entity_type_name ?? ''} ${item.name}`)
  return label.includes('ordinariato') || label.includes('militar') || label.includes('castrense') || label.includes('personal')
}

function isArchdiocese(item: Diocese) {
  return normalizeForSearch(item.entity_type_name ?? '').includes('arquidiocesis')
}

function isDiocese(item: Diocese) {
  const type = normalizeForSearch(item.entity_type_name ?? '')
  return type.includes('diocesis') && !type.includes('arquidiocesis')
}

function findComboboxInput(labelText: string) {
  const labels = Array.from(document.querySelectorAll<HTMLLabelElement>('label'))
  const label = labels.find((item) => normalize(item.textContent ?? '').startsWith(labelText))
  return label?.querySelector<HTMLInputElement>('input.public-combobox-input') ?? null
}

function selectedCountryName() {
  return normalize(findComboboxInput('País')?.value ?? '') || 'República Dominicana'
}

function countryKey(country: Country) {
  return (country.iso2 ?? country.key).toUpperCase()
}

function selectedCountry(data: DashboardData) {
  const selectedName = selectedCountryName()
  return (data.countries ?? []).find((country) => country.name === selectedName || country.key === selectedName) ?? null
}

function countryDioceses(data: DashboardData, country: Country) {
  const key = countryKey(country)
  return (data.dioceses ?? []).filter((diocese) => {
    if (diocese.country_iso2) return diocese.country_iso2.toUpperCase() === key
    return !!diocese.country_name && normalize(diocesesCountryName(diocese)) === normalize(country.name)
  })
}

function diocesesCountryName(diocese: Diocese) {
  return diocese.country_name ?? ''
}

function scopedParishes(parishes: Parish[], dioceses: Diocese[]) {
  const ids = new Set(dioceses.map((item) => item.id))
  const slugs = new Set(dioceses.map((item) => item.slug))
  return parishes.filter((parish) => (!!parish.diocese_id && ids.has(parish.diocese_id)) || (!!parish.diocese_slug && slugs.has(parish.diocese_slug)))
}

function metricCard(icon: string, label: string, value: string | number, detail: string) {
  const card = document.createElement('article')
  card.className = 'public-metric-card'
  card.innerHTML = `<span class="public-metric-icon" aria-hidden="true">${icon}</span><strong>${label}</strong><b>${value}</b><small>${detail}</small>`
  return card
}

function sectionHeader(eyebrow: string, title: string, description: string) {
  const header = document.createElement('div')
  header.className = 'public-section-title'
  header.innerHTML = `<p class="eyebrow">${eyebrow}</p><h2>${title}</h2><p>${description}</p>`
  return header
}

function emptyNote(title: string, detail: string) {
  const note = document.createElement('div')
  note.className = 'public-empty'
  note.innerHTML = `<strong>${title}</strong><br /><span>${detail}</span>`
  return note
}

function provinceCard(name: string, count: number) {
  const card = document.createElement('article')
  card.className = 'public-province-card'
  card.innerHTML = `<span class="public-node-icon" aria-hidden="true">⌂</span><span><strong>${name}</strong><span>${count} jurisdicciones territoriales</span></span><span class="public-link">Provincia →</span>`
  return card
}

function jurisdictionCard(item: Diocese) {
  const link = document.createElement('a')
  link.className = 'public-directory-item'
  link.href = `/entidades/${item.slug}`
  link.innerHTML = `<strong>${item.name}</strong><span>${item.entity_type_name ?? 'Jurisdicción'} · ${item.current_ordinary_name ?? 'Sin ordinario registrado'}</span><span class="public-link">Ver estructura →</span>`
  return link
}

function setDefaultTerritorialHidden(panel: HTMLElement, hidden: boolean) {
  const nodes = Array.from(panel.children).filter((child) => child.id !== 'public-multi-country-panel' && !(child as HTMLElement).classList.contains('public-scope-card')) as HTMLElement[]
  for (const node of nodes) {
    if (hidden) {
      node.dataset.multiCountryHidden = 'true'
      node.hidden = true
    } else if (node.dataset.multiCountryHidden === 'true') {
      node.hidden = false
      delete node.dataset.multiCountryHidden
    }
  }
}

function renderMultiCountryDashboard(data: DashboardData) {
  const panel = document.querySelector<HTMLElement>('#panel-territorial')
  if (!panel) return

  const country = selectedCountry(data)
  if (!country || countryKey(country) === 'DO') {
    document.querySelector<HTMLElement>('#public-multi-country-panel')?.remove()
    setDefaultTerritorialHidden(panel, false)
    return
  }

  const dioceses = countryDioceses(data, country)
  const territorial = dioceses.filter((item) => !isSpecialJurisdiction(item))
  const special = dioceses.filter(isSpecialJurisdiction)
  const parishes = scopedParishes(data.parishes ?? [], dioceses)
  const provinceCounts = new Map<string, number>()
  for (const item of territorial) {
    const province = item.ecclesiastical_province_name ?? 'Sin provincia eclesiástica'
    provinceCounts.set(province, (provinceCounts.get(province) ?? 0) + 1)
  }

  const signature = `${countryKey(country)}|${dioceses.length}|${parishes.length}|${territorial.length}|${special.length}`
  let container = document.querySelector<HTMLElement>('#public-multi-country-panel')
  if (!container) {
    container = document.createElement('section')
    container.id = 'public-multi-country-panel'
    container.className = 'public-multi-country-panel'
    panel.querySelector('.public-scope-card')?.insertAdjacentElement('afterend', container)
  }

  setDefaultTerritorialHidden(panel, true)

  if (container.dataset.signature === signature) return
  container.dataset.signature = signature

  const metrics = document.createElement('section')
  metrics.className = 'public-metrics-grid'
  metrics.setAttribute('aria-label', `Resumen territorial de ${country.name}`)
  metrics.append(
    metricCard('◎', 'País', 1, country.name),
    metricCard('▥', 'Provincias eclesiásticas', provinceCounts.size, 'Agrupaciones metropolitanas'),
    metricCard('⌂', 'Arquidiócesis', territorial.filter(isArchdiocese).length, 'Sedes metropolitanas'),
    metricCard('✛', 'Diócesis territoriales', territorial.filter(isDiocese).length, 'Jurisdicciones diocesanas'),
    metricCard('盾', 'Jurisdicción especial', special.length, 'No adscrita a provincia'),
    metricCard('⌂', 'Parroquias reportadas', formatNumber(parishes.length), 'Solo parroquias registradas en BD'),
  )

  const content = document.createElement('section')
  content.className = 'public-content-grid public-country-content-grid'

  const provincesArticle = document.createElement('article')
  provincesArticle.className = 'public-panel public-section-card'
  provincesArticle.append(sectionHeader('Provincias eclesiásticas', 'Selecciona una provincia', `Agrupaciones de iglesias locales en ${country.name}.`))
  const provinceList = document.createElement('div')
  provinceList.className = 'public-province-list'
  for (const [name, count] of Array.from(provinceCounts.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'))) {
    provinceList.append(provinceCard(name, count))
  }
  if (provinceCounts.size === 0) provinceList.append(emptyNote('Sin provincias publicadas', 'Este país no tiene provincias eclesiásticas públicas registradas todavía.'))
  provincesArticle.append(provinceList)

  const territorialArticle = document.createElement('article')
  territorialArticle.className = 'public-panel public-section-card'
  territorialArticle.append(sectionHeader('Jurisdicciones territoriales', `${territorial.length} resultados`, 'Arquidiócesis y diócesis integradas en provincias eclesiásticas.'))
  const territorialGrid = document.createElement('div')
  territorialGrid.className = 'public-directory-grid'
  for (const item of territorial.slice(0, 8)) territorialGrid.append(jurisdictionCard(item))
  if (territorial.length === 0) territorialGrid.append(emptyNote('Sin jurisdicciones territoriales', 'No hay arquidiócesis o diócesis públicas registradas para este país.'))
  territorialArticle.append(territorialGrid)

  const specialArticle = document.createElement('article')
  specialArticle.className = 'public-panel public-section-card'
  specialArticle.append(sectionHeader('Jurisdicciones especiales', `${special.length} resultado${special.length === 1 ? '' : 's'}`, 'Ordinariatos o jurisdicciones personales del país seleccionado.'))
  const specialGrid = document.createElement('div')
  specialGrid.className = 'public-directory-grid'
  for (const item of special) specialGrid.append(jurisdictionCard(item))
  if (special.length === 0) specialGrid.append(emptyNote('Sin jurisdicciones especiales', 'No hay ordinariatos o jurisdicciones personales públicas registradas para este país.'))
  specialArticle.append(specialGrid)

  content.append(provincesArticle, territorialArticle, specialArticle)
  container.replaceChildren(metrics, content)
}

export function PublicMultiCountryDashboard() {
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
        renderMultiCountryDashboard(data)
      } catch (error) {
        console.warn('No se pudo activar el dashboard multi-país', error)
      }
    }

    load()

    const observer = new MutationObserver(() => {
      if (dataRef.current) renderMultiCountryDashboard(dataRef.current)
    })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    const timer = window.setInterval(() => {
      if (dataRef.current) renderMultiCountryDashboard(dataRef.current)
    }, 800)

    return () => {
      cancelled = true
      observer.disconnect()
      window.clearInterval(timer)
    }
  }, [])

  return null
}
