import * as React from 'react'

import { cn } from '@/lib/utils'

type FormSectionProps = React.ComponentProps<'section'> & {
  eyebrow?: string
  title: string
  description?: string
  actions?: React.ReactNode
}

function FormSection({ className, eyebrow, title, description, actions, children, ...props }: FormSectionProps) {
  return (
    <section className={cn('grid gap-5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] sm:p-6', className)} {...props}>
      <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary)]">{eyebrow}</p> : null}
          <h2 className="m-0 text-xl font-semibold text-[var(--text-strong)]">{title}</h2>
          {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  )
}

type FieldGroupProps = React.ComponentProps<'div'> & {
  columns?: 1 | 2 | 3
}

function FieldGroup({ className, columns = 1, ...props }: FieldGroupProps) {
  const layout = columns === 3
    ? 'md:grid-cols-2 xl:grid-cols-3'
    : columns === 2
      ? 'md:grid-cols-2'
      : 'grid-cols-1'

  return <div className={cn('grid gap-4', layout, className)} {...props} />
}

function FormActions({ className, ...props }: React.ComponentProps<'footer'>) {
  return (
    <footer
      className={cn('flex flex-col-reverse gap-2 border-t border-[var(--border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-end', className)}
      {...props}
    />
  )
}

export { FieldGroup, FormActions, FormSection, type FieldGroupProps, type FormSectionProps }
