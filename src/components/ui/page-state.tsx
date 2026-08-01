import * as React from 'react'

import { Alert } from '@/components/ui/alert'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

export type PageStateKind = 'loading' | 'error' | 'empty' | 'no-results'

type PageStateProps = {
  kind: PageStateKind
  title: string
  description?: string
  action?: React.ReactNode
  secondaryAction?: React.ReactNode
  compact?: boolean
}

function LoadingState({
  title,
  description,
  compact,
}: Pick<PageStateProps, 'title' | 'description' | 'compact'>) {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]',
        compact ? 'px-5 py-6' : 'px-6 py-8',
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="size-5 animate-spin rounded-full border-2 border-[var(--primary)] border-r-transparent motion-reduce:animate-none"
        />
        <div>
          <h2 className="text-base font-semibold text-[var(--text-strong)]">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-[var(--text)]">{description}</p> : null}
        </div>
      </div>
      <div aria-hidden="true" className="mt-5 grid gap-3">
        <span className="h-3 w-2/3 animate-pulse rounded-full bg-[var(--surface-muted)] motion-reduce:animate-none" />
        <span className="h-3 w-full animate-pulse rounded-full bg-[var(--surface-muted)] motion-reduce:animate-none" />
        <span className="h-3 w-5/6 animate-pulse rounded-full bg-[var(--surface-muted)] motion-reduce:animate-none" />
      </div>
    </section>
  )
}

function PageState({
  kind,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
}: PageStateProps) {
  if (kind === 'loading') {
    return <LoadingState title={title} description={description} compact={compact} />
  }

  if (kind === 'error') {
    return (
      <Alert
        announce="assertive"
        actions={action || secondaryAction ? <>{action}{secondaryAction}</> : undefined}
        tone="danger"
        title={title}
      >
        {description ?? 'No fue posible completar la solicitud. Intenta nuevamente o contacta al equipo de soporte si el problema continúa.'}
      </Alert>
    )
  }

  return (
    <EmptyState
      compact={compact}
      title={title}
      description={description}
      action={action}
      secondaryAction={secondaryAction}
      data-state={kind}
    />
  )
}

export { LoadingState, PageState, type PageStateProps }
