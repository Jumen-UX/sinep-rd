'use client'

import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'

type WizardStep = {
  label: string
  description?: string
}

type AdminWizardProgressProps = {
  steps: WizardStep[]
  currentStep: number
  onStepChange?: (step: number) => void
  maxReachableStep?: number
}

export default function AdminWizardProgress({
  steps,
  currentStep,
  onStepChange,
  maxReachableStep = currentStep,
}: AdminWizardProgressProps) {
  const completed = Math.max(0, Math.min(steps.length, currentStep))
  const progress = steps.length > 1 ? Math.round((completed / (steps.length - 1)) * 100) : 100
  const reachableStep = Math.max(currentStep, Math.min(steps.length - 1, maxReachableStep))

  return (
    <aside
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-sm)] xl:sticky xl:top-4 xl:self-start"
      aria-label="Progreso del asistente"
    >
      <div className="flex items-center justify-between gap-3 px-2 pb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary)]">Progreso</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-strong)]">Paso {currentStep + 1} de {steps.length}</p>
        </div>
        <StatusBadge tone="institutional">{progress}%</StatusBadge>
      </div>

      <div
        className="mx-2 mb-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"
        role="progressbar"
        aria-label="Progreso del asistente"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <span className="block h-full rounded-full bg-[var(--primary)] transition-[width]" style={{ width: `${progress}%` }} />
      </div>

      <ol className="grid gap-1">
        {steps.map((step, index) => {
          const isComplete = index < currentStep
          const isCurrent = index === currentStep
          const canNavigate = Boolean(onStepChange) && index <= reachableStep
          const content = (
            <>
              <span className="grid size-7 shrink-0 place-items-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-bold text-[var(--text-strong)]">
                {isComplete ? '✓' : index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm text-[var(--text-strong)]">{step.label}</strong>
                {step.description ? <small className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{step.description}</small> : null}
              </span>
              <StatusBadge tone={isComplete ? 'success' : isCurrent ? 'institutional' : 'neutral'} className="shrink-0">
                {isComplete ? 'Listo' : isCurrent ? 'Actual' : 'Pendiente'}
              </StatusBadge>
            </>
          )

          const className = cn(
            'flex w-full items-start gap-3 rounded-[var(--radius-md)] px-3 py-3 text-left transition-colors',
            isCurrent ? 'bg-[var(--primary-soft)]' : canNavigate ? 'hover:bg-[var(--surface-hover)]' : 'opacity-70',
          )

          return (
            <li key={`${index}-${step.label}`}>
              {canNavigate ? (
                <button className={className} onClick={() => onStepChange?.(index)} type="button" aria-current={isCurrent ? 'step' : undefined}>
                  {content}
                </button>
              ) : (
                <div className={className} aria-current={isCurrent ? 'step' : undefined}>{content}</div>
              )}
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
