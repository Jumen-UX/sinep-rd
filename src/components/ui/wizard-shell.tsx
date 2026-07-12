import * as React from 'react'

import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'

interface WizardStep {
  id: string
  label: string
  description?: string
  status?: 'complete' | 'current' | 'upcoming' | 'error'
}

interface WizardShellProps extends React.ComponentProps<'div'> {
  steps: WizardStep[]
  currentStepId: string
  onStepChange?: (stepId: string) => void
  children: React.ReactNode
  summary?: React.ReactNode
  footer?: React.ReactNode
}

function WizardShell({
  className,
  steps,
  currentStepId,
  onStepChange,
  children,
  summary,
  footer,
  ...props
}: WizardShellProps) {
  return (
    <div className={cn('grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)_22rem]', className)} {...props}>
      <WizardNavigation steps={steps} currentStepId={currentStepId} onStepChange={onStepChange} />

      <section className="min-w-0 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
        <div className="p-5 sm:p-6">{children}</div>
        {footer ? <div className="border-t border-[var(--border)] px-5 py-4 sm:px-6">{footer}</div> : null}
      </section>

      {summary ? (
        <aside className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] xl:sticky xl:top-4 xl:self-start" aria-label="Resumen del registro">
          {summary}
        </aside>
      ) : null}
    </div>
  )
}

interface WizardNavigationProps extends React.ComponentProps<'nav'> {
  steps: WizardStep[]
  currentStepId: string
  onStepChange?: (stepId: string) => void
}

function WizardNavigation({ className, steps, currentStepId, onStepChange, ...props }: WizardNavigationProps) {
  return (
    <nav className={cn('rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-sm)] xl:sticky xl:top-4 xl:self-start', className)} aria-label="Pasos del asistente" {...props}>
      <ol className="grid gap-1">
        {steps.map((step, index) => {
          const isCurrent = step.id === currentStepId
          const status = step.status ?? (isCurrent ? 'current' : 'upcoming')
          const tone = status === 'complete' ? 'success' : status === 'error' ? 'danger' : isCurrent ? 'institutional' : 'neutral'

          return (
            <li key={step.id}>
              <button
                type="button"
                className={cn(
                  'flex w-full items-start gap-3 rounded-[var(--radius-md)] px-3 py-3 text-left transition-colors',
                  isCurrent ? 'bg-[var(--primary-soft)]' : 'hover:bg-[var(--surface-hover)]',
                )}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => onStepChange?.(step.id)}
                disabled={!onStepChange}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-bold text-[var(--text-strong)]">
                  {status === 'complete' ? '✓' : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--text-strong)]">{step.label}</span>
                  {step.description ? <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{step.description}</span> : null}
                </span>
                <StatusBadge tone={tone} className="shrink-0">
                  {status === 'complete' ? 'Listo' : status === 'error' ? 'Revisar' : isCurrent ? 'Actual' : 'Pendiente'}
                </StatusBadge>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

interface WizardSummaryProps extends React.ComponentProps<'div'> {
  title?: string
  items: Array<{ label: string; value: React.ReactNode; empty?: boolean }>
}

function WizardSummary({ className, title = 'Resumen', items, ...props }: WizardSummaryProps) {
  return (
    <div className={cn('grid gap-4', className)} {...props}>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary)]">Vista previa</p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--text-strong)]">{title}</h2>
      </div>
      <dl className="grid gap-3">
        {items.map((item) => (
          <div key={item.label} className="border-b border-[var(--border-subtle)] pb-3 last:border-b-0 last:pb-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--text-subtle)]">{item.label}</dt>
            <dd className={cn('mt-1 text-sm leading-6', item.empty ? 'text-[var(--text-subtle)]' : 'text-[var(--text-strong)]')}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export { WizardNavigation, WizardShell, WizardSummary, type WizardShellProps, type WizardStep, type WizardSummaryProps }
