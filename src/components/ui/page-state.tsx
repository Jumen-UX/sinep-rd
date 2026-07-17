import * as React from 'react'

import { Alert } from '@/components/ui/alert'
import { EmptyState } from '@/components/ui/empty-state'

export type PageStateKind = 'loading' | 'error' | 'empty'

type PageStateProps = {
  kind: PageStateKind
  title: string
  description?: string
  action?: React.ReactNode
  secondaryAction?: React.ReactNode
  compact?: boolean
}

function PageState({
  kind,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
}: PageStateProps) {
  if (kind === 'error') {
    return (
      <Alert tone="danger" title={title} aria-live="assertive">
        {description ?? 'Ocurrió un error inesperado. Intenta nuevamente.'}
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
      aria-busy={kind === 'loading' ? true : undefined}
      aria-live={kind === 'loading' ? 'polite' : undefined}
    />
  )
}

export { PageState, type PageStateProps }
