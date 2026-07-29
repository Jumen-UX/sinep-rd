'use client'

import { useThemePreference, type ThemePreference } from './useThemePreference'

export function ThemeControl({ compact = false }: { compact?: boolean }) {
  const { preference, ready, updatePreference } = useThemePreference()

  return (
    <label data-compact={compact ? 'true' : undefined} data-ui="theme-control">
      <span>{compact ? 'Tema' : 'Apariencia'}</span>
      <select
        aria-label="Seleccionar apariencia"
        disabled={!ready}
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

export { THEME_STORAGE_KEY, type ThemePreference } from './useThemePreference'
