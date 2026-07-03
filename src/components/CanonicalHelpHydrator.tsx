'use client'

import { useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

type HelpRow = {
  office_display_name: string | null
  canonical_name: string | null
  short_definition: string | null
  full_definition: string | null
  canon_reference: string | null
  canonical_context: string | null
  source_url: string | null
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function findHelp(text: string, rows: HelpRow[]) {
  const normalizedText = normalize(text)
  return rows.find((row) => normalize(row.office_display_name ?? '') === normalizedText)
    ?? rows.find((row) => normalize(row.canonical_name ?? '') === normalizedText)
    ?? rows.find((row) => normalizedText.length > 4 && normalize(row.canonical_name ?? '').includes(normalizedText))
    ?? rows.find((row) => normalizedText.includes(normalize(row.canonical_name ?? '')) && row.canonical_name)
}

function labeledSmall(label: string, value: string) {
  const element = document.createElement('small')
  const strong = document.createElement('b')
  strong.textContent = label
  element.append(strong, ` ${value}`)
  return element
}

export default function CanonicalHelpHydrator() {
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      const { data } = await supabase
        .from('public_office_canonical_help')
        .select('office_display_name,canonical_name,short_definition,full_definition,canon_reference,canonical_context,source_url')
        .not('canonical_name', 'is', null)

      if (cancelled || !data) return

      const rows = data as HelpRow[]
      const candidates = Array.from(document.querySelectorAll('td strong, .bishop-line span, .timeline-item strong')) as HTMLElement[]

      candidates.forEach((node) => {
        if (node.dataset.canonicalHydrated === 'true') return
        const title = node.textContent?.trim() ?? ''
        if (!title || title.length > 90) return
        const help = findHelp(title, rows)
        if (!help?.canonical_name) return

        node.dataset.canonicalHydrated = 'true'
        const wrapper = document.createElement('span')
        wrapper.className = 'canonical-help-inline'

        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'canonical-help-button'
        button.textContent = 'ⓘ'
        button.title = help.short_definition ?? 'Ver definición canónica'

        const popover = document.createElement('span')
        popover.className = 'canonical-help-popover card'
        popover.style.display = 'none'

        const titleEl = document.createElement('strong')
        titleEl.textContent = help.canonical_name
        const shortEl = document.createElement('span')
        shortEl.textContent = help.short_definition ?? ''
        const fullEl = document.createElement('small')
        fullEl.textContent = help.full_definition ?? ''
        const referenceEl = labeledSmall('Base:', help.canon_reference ?? 'Código de Derecho Canónico')
        const contextEl = labeledSmall('Contexto:', help.canonical_context ?? 'Oficio eclesiástico')

        popover.append(titleEl, shortEl)
        if (help.full_definition) popover.append(fullEl)
        popover.append(referenceEl, contextEl)

        if (help.source_url) {
          const link = document.createElement('a')
          link.href = help.source_url
          link.target = '_blank'
          link.rel = 'noreferrer'
          link.textContent = 'Código de Derecho Canónico'
          popover.append(link)
        }

        button.addEventListener('click', () => {
          popover.style.display = popover.style.display === 'none' ? 'grid' : 'none'
        })

        wrapper.append(button, popover)
        node.insertAdjacentElement('afterend', wrapper)
      })
    }

    const timeout = window.setTimeout(hydrate, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [supabase])

  return null
}
