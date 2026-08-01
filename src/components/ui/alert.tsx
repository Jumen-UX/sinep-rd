import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const alertVariants = cva(
  'grid gap-1 rounded-[var(--radius-md)] border px-4 py-3 text-sm leading-6',
  {
    variants: {
      tone: {
        neutral: 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)]',
        info: 'border-[var(--border-info)] bg-[var(--info-soft)] text-[var(--info)]',
        success: 'border-[var(--border-success)] bg-[var(--success-soft)] text-[var(--success)]',
        warning: 'border-[var(--border-warning)] bg-[var(--warning-soft)] text-[var(--warning)]',
        danger: 'border-[var(--border-danger)] bg-[var(--danger-soft)] text-[var(--danger)]',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
)

type AlertAnnouncement = 'off' | 'polite' | 'assertive'

type AlertProps = React.ComponentProps<'section'> &
  VariantProps<typeof alertVariants> & {
    title?: string
    icon?: React.ReactNode
    actions?: React.ReactNode
    announce?: AlertAnnouncement
  }

function Alert({
  className,
  tone,
  title,
  icon,
  actions,
  announce = 'off',
  children,
  role,
  ...props
}: AlertProps) {
  const announcementProps = announce === 'off'
    ? {}
    : {
        role: role ?? (announce === 'assertive' ? 'alert' : 'status'),
        'aria-live': announce,
        'aria-atomic': true,
      }

  return (
    <section
      className={cn(
        alertVariants({ tone }),
        icon ? 'grid-cols-[auto_1fr] items-start gap-x-3' : undefined,
        className,
      )}
      role={role}
      {...announcementProps}
      {...props}
    >
      {icon ? <span aria-hidden="true" className="mt-0.5 grid size-6 place-items-center rounded-full border border-current/20">{icon}</span> : null}
      <div className="min-w-0">
        {title ? <h3 className="m-0 text-sm font-semibold text-current">{title}</h3> : null}
        <div className={cn(title ? 'mt-1' : undefined, 'text-current/90')}>{children}</div>
        {actions ? <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  )
}

export { Alert, alertVariants, type AlertAnnouncement, type AlertProps }
