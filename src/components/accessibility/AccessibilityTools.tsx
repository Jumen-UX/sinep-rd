'use client'

import { useEffect, useId, useRef, useState } from 'react'

const ACCESSIBILITY_STORAGE_KEY = 'sinep-accessibility'
const ACCESSIBILITY_CHANGE_EVENT = 'sinep-accessibility-change'

type TextScale = 'default' | 'large' | 'xlarge'

type AccessibilityPreferences = {
  textScale: TextScale
  highContrast: boolean
  reduceMotion: boolean
  underlineLinks: boolean
}

const DEFAULT_PREFERENCES: AccessibilityPreferences = {
  textScale: 'default',
  highContrast: false,
  reduceMotion: false,
  underlineLinks: false,
}

function isTextScale(value: unknown): value is TextScale {
  return value === 'default' || value === 'large' || value === 'xlarge'
}

function normalizePreferences(value: unknown): AccessibilityPreferences {
  if (!value || typeof value !== 'object') return DEFAULT_PREFERENCES

  const candidate = value as Partial<AccessibilityPreferences>
  return {
    textScale: isTextScale(candidate.textScale) ? candidate.textScale : 'default',
    highContrast: candidate.highContrast === true,
    reduceMotion: candidate.reduceMotion === true,
    underlineLinks: candidate.underlineLinks === true,
  }
}

function readStoredPreferences(): AccessibilityPreferences {
  try {
    const storedValue = window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEY)
    return storedValue ? normalizePreferences(JSON.parse(storedValue)) : DEFAULT_PREFERENCES
  } catch {
    return DEFAULT_PREFERENCES
  }
}

function applyPreferences(preferences: AccessibilityPreferences) {
  const root = document.documentElement

  if (preferences.textScale === 'default') delete root.dataset.textScale
  else root.dataset.textScale = preferences.textScale

  if (preferences.highContrast) root.dataset.contrast = 'high'
  else delete root.dataset.contrast

  if (preferences.reduceMotion) root.dataset.reduceMotion = 'true'
  else delete root.dataset.reduceMotion

  if (preferences.underlineLinks) root.dataset.underlineLinks = 'true'
  else delete root.dataset.underlineLinks
}

export function AccessibilityTools() {
  const panelId = useId()
  const headingId = useId()
  const textScaleLabelId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(DEFAULT_PREFERENCES)

  useEffect(() => {
    const initialPreferences = readStoredPreferences()
    setPreferences(initialPreferences)
    applyPreferences(initialPreferences)
    setReady(true)

    function handlePreferenceChange(event: Event) {
      const nextPreferences = normalizePreferences(
        (event as CustomEvent<AccessibilityPreferences>).detail,
      )
      setPreferences(nextPreferences)
      applyPreferences(nextPreferences)
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== ACCESSIBILITY_STORAGE_KEY) return
      const nextPreferences = readStoredPreferences()
      setPreferences(nextPreferences)
      applyPreferences(nextPreferences)
    }

    window.addEventListener(ACCESSIBILITY_CHANGE_EVENT, handlePreferenceChange)
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener(ACCESSIBILITY_CHANGE_EVENT, handlePreferenceChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  useEffect(() => {
    if (!open) return

    closeButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [open])

  function updatePreferences(
    patch: Partial<AccessibilityPreferences>,
    message: string,
  ) {
    const nextPreferences = { ...preferences, ...patch }
    window.localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(nextPreferences))
    window.dispatchEvent(
      new CustomEvent<AccessibilityPreferences>(ACCESSIBILITY_CHANGE_EVENT, {
        detail: nextPreferences,
      }),
    )
    setAnnouncement(message)
  }

  function resetPreferences() {
    window.localStorage.removeItem(ACCESSIBILITY_STORAGE_KEY)
    window.dispatchEvent(
      new CustomEvent<AccessibilityPreferences>(ACCESSIBILITY_CHANGE_EVENT, {
        detail: DEFAULT_PREFERENCES,
      }),
    )
    setAnnouncement('Preferencias de accesibilidad restablecidas.')
  }

  return (
    <div className="accessibility-tools" data-ui="accessibility-tools" ref={containerRef}>
      {open && (
        <section
          aria-labelledby={headingId}
          aria-modal="false"
          className="accessibility-tools__panel"
          id={panelId}
          role="dialog"
        >
          <header className="accessibility-tools__header">
            <div>
              <p className="accessibility-tools__eyebrow">Preferencias personales</p>
              <h2 id={headingId}>Herramientas de accesibilidad</h2>
              <p>Los cambios se guardan en este dispositivo.</p>
            </div>
            <button
              aria-label="Cerrar herramientas de accesibilidad"
              className="accessibility-tools__close"
              onClick={() => {
                setOpen(false)
                triggerRef.current?.focus()
              }}
              ref={closeButtonRef}
              type="button"
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>

          <div
            aria-labelledby={textScaleLabelId}
            className="accessibility-tools__group"
            role="group"
          >
            <strong id={textScaleLabelId}>Tamaño del texto</strong>
            <div className="accessibility-tools__scale-options">
              {([
                ['default', 'Normal'],
                ['large', 'Grande'],
                ['xlarge', 'Muy grande'],
              ] as const).map(([value, label]) => (
                <button
                  aria-pressed={preferences.textScale === value}
                  disabled={!ready}
                  key={value}
                  onClick={() => updatePreferences(
                    { textScale: value },
                    `Tamaño del texto: ${label.toLowerCase()}.`,
                  )}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="accessibility-tools__toggles">
            <label>
              <input
                checked={preferences.highContrast}
                disabled={!ready}
                onChange={(event) => updatePreferences(
                  { highContrast: event.target.checked },
                  event.target.checked ? 'Alto contraste activado.' : 'Alto contraste desactivado.',
                )}
                type="checkbox"
              />
              <span>
                <strong>Alto contraste</strong>
                <small>Refuerza texto, bordes y estados de foco.</small>
              </span>
            </label>

            <label>
              <input
                checked={preferences.reduceMotion}
                disabled={!ready}
                onChange={(event) => updatePreferences(
                  { reduceMotion: event.target.checked },
                  event.target.checked ? 'Movimiento reducido activado.' : 'Movimiento reducido desactivado.',
                )}
                type="checkbox"
              />
              <span>
                <strong>Reducir movimiento</strong>
                <small>Minimiza animaciones y transiciones.</small>
              </span>
            </label>

            <label>
              <input
                checked={preferences.underlineLinks}
                disabled={!ready}
                onChange={(event) => updatePreferences(
                  { underlineLinks: event.target.checked },
                  event.target.checked ? 'Subrayado de enlaces activado.' : 'Subrayado de enlaces desactivado.',
                )}
                type="checkbox"
              />
              <span>
                <strong>Subrayar enlaces</strong>
                <small>Hace más visibles los elementos navegables.</small>
              </span>
            </label>
          </div>

          <button
            className="accessibility-tools__reset"
            disabled={!ready}
            onClick={resetPreferences}
            type="button"
          >
            Restablecer preferencias
          </button>

          <p aria-live="polite" className="sr-only" role="status">
            {announcement}
          </p>
        </section>
      )}

      <button
        aria-controls={panelId}
        aria-expanded={open}
        aria-label="Abrir herramientas de accesibilidad"
        className="accessibility-tools__trigger"
        disabled={!ready}
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        <span aria-hidden="true" className="accessibility-tools__icon">Aa</span>
        <span>Accesibilidad</span>
      </button>
    </div>
  )
}

export {
  ACCESSIBILITY_CHANGE_EVENT,
  ACCESSIBILITY_STORAGE_KEY,
  DEFAULT_PREFERENCES,
  type AccessibilityPreferences,
}
