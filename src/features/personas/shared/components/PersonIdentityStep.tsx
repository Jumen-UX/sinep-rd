'use client'

export type PersonIdentityMode = 'existing' | 'new'

export type PersonIdentityOption = {
  id: string
  display_name: string
  slug?: string | null
}

type PersonIdentityStepProps = {
  mode: PersonIdentityMode
  onModeChange: (mode: PersonIdentityMode) => void
  selectedPersonId: string
  onSelectedPersonChange: (personId: string) => void
  people: PersonIdentityOption[]
  existingActionLabel: string
  newActionLabel: string
  selectPlaceholder: string
  existingSummary: string
  emptySelectionLabel?: string
}

export function PersonIdentityStep({
  mode,
  onModeChange,
  selectedPersonId,
  onSelectedPersonChange,
  people,
  existingActionLabel,
  newActionLabel,
  selectPlaceholder,
  existingSummary,
  emptySelectionLabel = 'Sin persona seleccionada',
}: PersonIdentityStepProps) {
  const selectedPerson = people.find((person) => person.id === selectedPersonId)

  function selectMode(nextMode: PersonIdentityMode) {
    onModeChange(nextMode)
    if (nextMode === 'new') onSelectedPersonChange('')
  }

  return (
    <section aria-labelledby="person-identity-step-title">
      <p className="eyebrow">Identidad de la persona</p>
      <h2 id="person-identity-step-title">¿La persona ya está registrada?</h2>
      <p className="meta">
        Busca y reutiliza una ficha existente antes de crear una identidad nueva. Los ministerios,
        ordenaciones, estados y servicios se agregan sobre la misma persona.
      </p>

      <div className="dashboard-grid dashboard-summary" role="group" aria-label="Origen de la identidad">
        <button
          className={`metric-card metric-button ${mode === 'existing' ? 'active-filter' : ''}`}
          type="button"
          aria-pressed={mode === 'existing'}
          onClick={() => selectMode('existing')}
        >
          <strong>Persona existente</strong>
          <span>{existingActionLabel}</span>
        </button>
        <button
          className={`metric-card metric-button ${mode === 'new' ? 'active-filter' : ''}`}
          type="button"
          aria-pressed={mode === 'new'}
          onClick={() => selectMode('new')}
        >
          <strong>Identidad nueva</strong>
          <span>{newActionLabel}</span>
        </button>
      </div>

      {mode === 'existing' && (
        <>
          <label>
            Persona
            <select
              value={selectedPersonId}
              onChange={(event) => onSelectedPersonChange(event.target.value)}
            >
              <option value="">{selectPlaceholder}</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>{person.display_name}</option>
              ))}
            </select>
          </label>
          <div className="empty-state" aria-live="polite">
            <strong>{selectedPerson?.display_name ?? emptySelectionLabel}</strong>
            <span>{existingSummary}</span>
          </div>
        </>
      )}
    </section>
  )
}
