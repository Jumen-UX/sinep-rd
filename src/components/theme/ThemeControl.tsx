'use client'

import { useEffect, useState } from 'react'

const THEME_STORAGE_KEY = 'sinep-theme'
const THEME_CHANGE_EVENT = 'sinep-theme-change'

type ThemePreference = 'light' | 'dark' | 'system'
type ResolvedTheme = Exclude<ThemePreference, 'system'>

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

function resolveTheme(preference: ThemePreference, media: MediaQueryList): ResolvedTheme {
  if (preference !== 'system') return preference
  return media.matches ? 'dark' : 'light'
}

function applyTheme(preference: ThemePreference, media: MediaQueryList) {
  const resolvedTheme = resolveTheme(preference, media)
  document.documentElement.dataset.theme = resolvedTheme
  document.documentElement.style.colorScheme = resolvedTheme
}

export function ThemeControl({ compact = false }: { compact?: boolean }) {
  const [preference, setPreference] = useState<ThemePreference>('system')

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const storedPreference = window.localStorage.getItem(THEME_STORAGE_KEY)
    const initialPreference = isThemePreference(storedPreference) ? storedPreference : 'system'

    setPreference(initialPreference)
    applyTheme(initialPreference, media)

    function handleSystemChange() {
      const currentPreference = window.localStorage.getItem(THEME_STORAGE_KEY)
      if (!isThemePreference(currentPreference) || currentPreference === 'system') {
        applyTheme('system', media)
      }
    }

    function handleThemeChange(event: Event) {
      const nextPreference = (event as CustomEvent<ThemePreference>).detail
      if (!isThemePreference(nextPreference)) return
      setPreference(nextPreference)
      applyTheme(nextPreference, media)
    }

    media.addEventListener('change', handleSystemChange)
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange)

    return () => {
      media.removeEventListener('change', handleSystemChange)
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange)
    }
  }, [])

  function updatePreference(nextPreference: ThemePreference) {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference)
    window.dispatchEvent(new CustomEvent<ThemePreference>(THEME_CHANGE_EVENT, { detail: nextPreference }))
  }

  return (
    <label data-compact={compact ? 'true' : undefined} data-ui="theme-control">
      <span>{compact ? 'Tema' : 'Apariencia'}</span>
      <select
        aria-label="Seleccionar apariencia"
        onChange={(event) => updatePreference(event.target.value as ThemePreference)}
        value={preference}
      >
        <option value="light">Claro</option>
        <option value="dark">Oscuro</option>
        <option value="system">Automático</option>
      </select>
    </label>
  )
}

export { THEME_STORAGE_KEY, type ThemePreference }
