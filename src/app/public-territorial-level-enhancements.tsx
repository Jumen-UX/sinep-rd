'use client'

import { useEffect, useRef } from 'react'

type Relationship = {
  id: string
  relationship_type: string | null
  parent_name: string | null
  parent_slug: string | null
  parent_type_key: string | null
  parent_type_name: string | null
  child_name: string | null
  child_slug: string | null
  child_type_key: string | null
  child_type_name: string | null
}

type Parish = {
  id: string
  diocese_id: string | null
  diocese_name: string | null
  diocese_slug: string | null
}

type TerritorialLevelsData = {
  relationships: Relationship[]
  parishes: Parish[]
}

type LevelGroup = {
  label: string
  count: number
  items: { name: string; slug: string | null; type: string }[]
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function pluralizeType(value: string) {
  const normalized = value.toLowerCase()
  if (normalized.includes('vicaría')) return 'Vicarías'
  if (normalized.includes('zona')) return 'Zonas pastorales'
  if (normalized.includes('parroquia')) return 'Parroquias'
  return value.endsWith('s') ? value : `${value}s`
}

function findComboboxInput(labelText: string) {
  const labels = Array.from(document.querySelectorAll<HTMLLabelElement>('label'))
  const label = labels.find((item) => normalize(item.textContent ?? '').startsWith(labelText))
  return label?.querySelector<HTMLInputElement>('input.public-combobox-input') ?? null
}

function selectedComboboxValue(labelText: string) {
  return normalize(findComboboxInput(labelText)?.value ?? '')
}

function groupByType(rows: Relationship[]) {
  const groups = new Map<string, LevelGroup>()

  for (const row of rows) {
    const type = row.child_type_name ?? 'Nivel territorial'
    const label = pluralizeType(type)
    const current = groups.get(label) ?? { label, count: 0, items: [] }
    current.count += 1
    current.items.push({ name: row.child_name ?? 'Entidad sin nombre', slug: row.child_slug, type })
    groups.set(label, current)
  }

  return Array.from(groups.values())
}

function updateMetric(label: string, group: LevelGroup | undefined) {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.public-metric-card'))
  const card = cards.find((item) => normalize(item.querySelector('strong')?.textContent ?? '') === label)
  if (!card) return

  const value = card.querySelector('b')
  const detail = card.querySelector('small')

  if (value) value.textContent = group ? String(group.count) : '0'
  if (detail) detail.textContent = group ? group.label : 'Por configurar'
}

function updateScopeSummary(levelCount: number) {
  const summaryItems = Array.from(document.querySelectorAll<HTMLElement>('.public-scope-summary span'))
  const target = summaryItems.find((item) => normalize(item.textContent ?? '').includes('niveles territoriales'))
  if (target) target.textContent = `${levelCount} niveles territoriales`
}

function buildLevelCard(group: LevelGroup, index: number) {
  const card = document.createElement('article')
  card.className = 'public-level-card'

  const header = document.createElement('div')
  header.className = 'public-section-title'
  header.innerHTML = `<p class="eyebrow">Nivel ${index + 1}</p><h2>${group.label}</h2><p>${group.count} registros publicados</p>`

  const grid = document.createElement('div')
  grid.className = 'public-directory-grid'

  for (const item of group.items.slice(0, 4)) {
    const href = item.slug ? `/entidades/${item.slug}` : '#'
    const link = document.createElement('a')
    link.className = 'public-directory-item'
    link.href = href
    link.innerHTML = `<strong>${item.name}</strong><span>${item.type}</span>`
    grid.append(link)
  }

  card.append(header, grid)
  return card
}

function buildParishGroup(parishes: Parish[]): LevelGroup | undefined {
  if (parishes.length === 0) return undefined
  return {
    label: 'Parroquias',
    count: parishes.length,
    items: parishes.slice(0, 4).map((item) => ({ name: item.diocese_name ? `Parroquia registrada en ${item.diocese_name}` : 'Parroquia registrada', slug: null, type: 'Parroquia' })),
  }
}

function renderTerritorialLevels(data: TerritorialLevelsData) {
  const panel = document.querySelector<HTMLElement>('#panel-territorial')
  if (!panel) return

  const jurisdiction = selectedComboboxValue('Jurisdicción')
  if (!jurisdiction || jurisdiction === 'Todas las jurisdicciones') return

  const directRows = data.relationships.filter((item) => item.parent_name === jurisdiction)
  const directSlugs = new Set(directRows.map((item) => item.child_slug).filter(Boolean) as string[])
  const nextRows = data.relationships.filter((item) => !!item.parent_slug && directSlugs.has(item.parent_slug))
  const scopedParishes = data.parishes.filter((item) => item.diocese_name === jurisdiction)

  const directGroups = groupByType(directRows)
  const nextGroups = groupByType(nextRows)
  const parishGroup = buildParishGroup(scopedParishes)
  const groups = [directGroups[0], nextGroups[0] ?? parishGroup].filter(Boolean) as LevelGroup[]
  const signature = `${jurisdiction}|${groups.map((item) => `${item.label}:${item.count}`).join('|')}|${scopedParishes.length}`

  const structureCard = panel.querySelector<HTMLElement>('.public-diocese-structure-card')
  if (!structureCard) return
  if (structureCard.dataset.territorialLevelsSignature === signature) return
  structureCard.dataset.territorialLevelsSignature = signature

  updateMetric('Nivel 1', groups[0])
  updateMetric('Nivel 2', groups[1])
  updateScopeSummary(groups.length)

  const levelGrid = structureCard.querySelector<HTMLElement>('.public-level-grid')
  if (!levelGrid) return

  if (groups.length === 0) {
    levelGrid.innerHTML = '<div class="public-empty"><strong>Niveles por configurar</strong><br><span>No hay niveles territoriales publicados para esta jurisdicción.</span></div>'
    return
  }

  levelGrid.replaceChildren(...groups.map((group, index) => buildLevelCard(group, index)))
}

export function PublicTerritorialLevelEnhancements() {
  const dataRef = useRef<TerritorialLevelsData | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch('/api/dashboard/territorial-levels')
        if (!response.ok) return
        const data = await response.json() as TerritorialLevelsData
        if (cancelled) return
        dataRef.current = data
        renderTerritorialLevels(data)
      } catch (error) {
        console.warn('No se pudieron mejorar los niveles territoriales', error)
      }
    }

    load()

    const observer = new MutationObserver(() => {
      if (dataRef.current) renderTerritorialLevels(dataRef.current)
    })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    const timer = window.setInterval(() => {
      if (dataRef.current) renderTerritorialLevels(dataRef.current)
    }, 700)

    return () => {
      cancelled = true
      observer.disconnect()
      window.clearInterval(timer)
    }
  }, [])

  return null
}
