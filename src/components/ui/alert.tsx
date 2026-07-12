import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const alertVariants = cva(
  'grid gap-1 rounded-[var(--radius-md)] border px-4 py-3 text-sm leading-6',
  {
    variants: {
      tone: {
        neutral: 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)]',
        info: 'border-[#bdd7ea] bg-[var(--info-soft)] text-[var(--info)]',
        success: 'border-[#b9dfc1] bg-[var(--success-soft)] text-[var(--success)]',
        warning: 'border-[#ecd49b] bg-[var(--warning-soft)] text-[var(--warning)]',
        danger: 'border-[#edc0bb] bg-[var(--danger-soft)] text-[var(--danger)]',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
)

type AlertProps = React.ComponentProps<'section'> &
  VariantProps<typeof alertVariants> & {
    title?: string
    icon?: React.ReactNode
  }

function Alert({ className, tone, title, icon, children, ...props }: AlertProps) {
  return (
    <section
      className={cn(
        alertVariants({ tone }),
        icon ? 'grid-cols-[auto_1fr] items-start gap-x-3' : undefined,
        className,
      )}
      role={tone === 'danger' ? 'alert' : 'status'}
      {...props}
    >
      {icon ? <span aria-hidden="true" className="mt-0.5 grid size-6 place-items-center rounded-full border border-current/20">{icon}</span> : null}
      <div className="min-w-0">
        {title ? <h3 className="m-0 text-sm font-semibold text-current">{title}</h3> : null}
        <div className={cn(title ? 'mt-1' : undefined, 'text-current/90')}>{children}</div>
      </div>
    </section>
  )
}

export { Alert, alertVariants, type AlertProps }
