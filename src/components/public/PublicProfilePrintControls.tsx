'use client'

import { useId, useMemo, useState } from 'react'
import styles from './PublicProfilePrintControls.module.css'

export type PublicProfilePrintSection = {
  id: string
  label: string
  defaultSelected?: boolean
}

type Props = {
  sections: PublicProfilePrintSection[]
}

export function PublicProfilePrintControls({ sections }: Props) {
  const groupId = useId()
  const initialSelection = useMemo(
    () => new Set(sections.filter((section) => section.defaultSelected !== false).map((section) => section.id)),
    [sections],
  )
  const [selected, setSelected] = useState(initialSelection)

  function toggleSection(sectionId: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }

  function printSelectedSections() {
    const profile = document.querySelector<HTMLElement>('[data-print-profile]')
    if (!profile) return

    const printableSections = profile.querySelectorAll<HTMLElement>('[data-print-section]')
    printableSections.forEach((section) => {
      const sectionId = section.dataset.printSection
      section.toggleAttribute('data-print-hidden', Boolean(sectionId && !selected.has(sectionId)))
    })

    const cleanup = () => {
      printableSections.forEach((section) => section.removeAttribute('data-print-hidden'))
      window.removeEventListener('afterprint', cleanup)
    }

    window.addEventListener('afterprint', cleanup)
    window.print()
  }

  return (
    <section className={styles.controls} data-print-controls aria-labelledby={`${groupId}-title`}>
      <div>
        <p className="eyebrow">Versión para impresión</p>
        <h2 id={`${groupId}-title`}>Seleccionar contenido</h2>
        <p className="meta">Marca únicamente las secciones que deben aparecer en la impresión o al guardar como PDF.</p>
      </div>

      <fieldset className={styles.options}>
        <legend className="sr-only">Secciones de la ficha</legend>
        {sections.map((section) => (
          <label key={section.id}>
            <input
              checked={selected.has(section.id)}
              onChange={() => toggleSection(section.id)}
              type="checkbox"
            />
            <span>{section.label}</span>
          </label>
        ))}
      </fieldset>

      <button
        className="button button-primary"
        disabled={selected.size === 0}
        onClick={printSelectedSections}
        type="button"
      >
        Imprimir selección
      </button>
    </section>
  )
}
