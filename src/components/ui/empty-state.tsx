import * as React from 'react'

import { cn } from '@/lib/utils'

interface EmptyStateProps extends React.ComponentProps<'section'> {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  secondaryAction?: React.ReactNode
  compact?: boolean
}

function EmptyState({
  className,
  icon,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  ...props
}: EmptyStateProps) {
  return (
    <section
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] text-center',
        compact ? 'min-h-48 px-5 py-8' : 'min-h-72 px-6 py-12',
        className,
      )}
      {...props}
    >
      {icon ? (
        <div className="mb-4 grid size-12 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--primary)]" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <h2 className="text-lg font-semibold text-[var(--text-strong)]">{title}</h2>
      {description ? <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-muted)]">{description}</p> : null}
      {action || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </section>
  )
}

export { EmptyState, type EmptyStateProps }
