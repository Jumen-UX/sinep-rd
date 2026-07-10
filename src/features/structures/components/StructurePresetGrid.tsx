import type { StructurePreset } from '../types'

type StructurePresetGridProps = {
  presets: StructurePreset[]
  disabled?: boolean
  onApply: (preset: StructurePreset) => void
}

export function StructurePresetGrid({ presets, disabled = false, onApply }: StructurePresetGridProps) {
  return (
    <div className="catalog-preset-grid">
      {presets.map((preset) => (
        <article className="catalog-preset-card" key={preset.key}>
          <div className="catalog-preset-header">
            <h3>{preset.title}</h3>
            <button
              className="catalog-mini-button"
              disabled={disabled}
              onClick={() => onApply(preset)}
              type="button"
            >
              Aplicar
            </button>
          </div>
          <small>{preset.description}</small>
          <div className="catalog-preset-steps" aria-label={`Niveles de ${preset.title}`}>
            {preset.levels.map((level) => <span key={level.levelKey}>{level.name}</span>)}
          </div>
        </article>
      ))}
    </div>
  )
}
