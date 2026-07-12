import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const statusBadgeVariants = cva(
  'inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none',
  {
    variants: {
      tone: {
        neutral: 'border-[var(--border-strong)] bg-[var(--surface-muted)] text-[var(--text-muted)]',
        info: 'border-[#bdd7ea] bg-[var(--info-soft)] text-[var(--info)]',
        success: 'border-[#b9dfc1] bg-[var(--success-soft)] text-[var(--success)]',
        warning: 'border-[#ecd49b] bg-[var(--warning-soft)] text-[var(--warning)]',
        danger: 'border-[#edc0bb] bg-[var(--danger-soft)] text-[var(--danger)]',
        institutional: 'border-[#dcc7c7] bg-[var(--primary-soft)] text-[var(--primary)]',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
)

type StatusBadgeProps = React.ComponentProps<'span'> &
  VariantProps<typeof statusBadgeVariants> & {
    dot?: boolean
  }

function StatusBadge({ className, tone, dot = false, children, ...props }: StatusBadgeProps) {
  return (
    <span data-slot="status-badge" className={cn(statusBadgeVariants({ tone }), className)} {...props}>
      {dot ? <span aria-hidden="true" className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  )
}

export { StatusBadge, statusBadgeVariants }
