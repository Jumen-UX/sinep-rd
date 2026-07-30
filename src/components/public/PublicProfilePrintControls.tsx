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
  exportData?: Record<string, unknown>
  exportFileName?: string
  exportProfileType?: string
}

export function PublicProfilePrintControls({
  sections,
  exportData,
  exportFileName = 'ficha-publica.json',
  exportProfileType = 'public_profile',
}: Props) {
  const groupId = useId()
  const initialSelection = useMemo(
    () => new Set(sections.filter((section) => section.defaultSelected !== false).map((section) => section.id)),
    [sections],
  )
  const [selected, setSelected] = useState(initialSelection)
  const [status, setStatus] = useState('')

  function toggleSection(sectionId: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
    setStatus('')
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

  function exportSelectedSections() {
    if (!exportData || selected.size === 0) return

    const selectedSections = sections.filter((section) => selected.has(section.id))
    const content = Object.fromEntries(
      selectedSections
        .filter((section) => Object.hasOwn(exportData, section.id))
        .map((section) => [section.id, exportData[section.id]]),
    )
    const payload = {
      schema: 'sinep.public-profile-export',
      schemaVersion: 1,
      profileType: exportProfileType,
      generatedAt: new Date().toISOString(),
      selectedSections: selectedSections.map(({ id, label }) => ({ id, label })),
      content,
    }
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json;charset=utf-8' })
    const objectUrl = URL.createObjectURL(blob)
    const download = document.createElement('a')

    download.href = objectUrl
    download.download = exportFileName
    document.body.appendChild(download)
    download.click()
    download.remove()
    URL.revokeObjectURL(objectUrl)
    setStatus('Archivo JSON generado con las secciones seleccionadas.')
  }

  const selectionDisabled = selected.size === 0

  return (
    <section className={styles.controls} data-print-controls aria-labelledby={`${groupId}-title`}>
      <div>
        <p className="eyebrow">Versión para impresión y exportación</p>
        <h2 id={`${groupId}-title`}>Seleccionar contenido</h2>
        <p className="meta">Marca únicamente las secciones que deben aparecer al imprimir, guardar como PDF o descargar datos públicos.</p>
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

      <div className={styles.actions}>
        <button
          className="button button-primary"
          disabled={selectionDisabled}
          onClick={printSelectedSections}
          type="button"
        >
          Imprimir selección
        </button>
        {exportData ? (
          <button
            className="button button-secondary"
            disabled={selectionDisabled}
            onClick={exportSelectedSections}
            type="button"
          >
            Descargar JSON
          </button>
        ) : null}
      </div>
      <p className={styles.status} role="status" aria-live="polite">{status}</p>
    </section>
  )
}
