'use client'

type WizardStep = {
  label: string
  description?: string
}

type AdminWizardProgressProps = {
  steps: WizardStep[]
  currentStep: number
  onStepChange?: (step: number) => void
}

export default function AdminWizardProgress({ steps, currentStep, onStepChange }: AdminWizardProgressProps) {
  const completed = Math.max(0, Math.min(steps.length, currentStep))
  const progress = steps.length > 1 ? Math.round((completed / (steps.length - 1)) * 100) : 100

  return (
    <aside className="admin-wizard-progress" aria-label="Progreso del asistente">
      <div className="admin-wizard-progress-summary">
        <span>Paso {currentStep + 1} de {steps.length}</span>
        <strong>{progress}%</strong>
      </div>
      <div className="admin-wizard-progress-bar" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      <ol>
        {steps.map((step, index) => {
          const state = index < currentStep ? 'complete' : index === currentStep ? 'active' : 'pending'
          const content = (
            <>
              <span className="admin-wizard-step-number">{index < currentStep ? '✓' : index + 1}</span>
              <span>
                <strong>{step.label}</strong>
                {step.description && <small>{step.description}</small>}
              </span>
            </>
          )

          return (
            <li className={state} key={`${index}-${step.label}`}>
              {onStepChange && index <= currentStep ? (
                <button onClick={() => onStepChange(index)} type="button">{content}</button>
              ) : (
                <div>{content}</div>
              )}
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
