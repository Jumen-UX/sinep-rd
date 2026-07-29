'use client'

import { useThemePreference, type ThemePreference } from '@/components/theme/useThemePreference'

export function PublicDashboardThemeControl() {
  const { preference, ready, updatePreference } = useThemePreference()

  return (
    <label data-compact="true" data-ui="theme-control">
      <span>Tema</span>
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
