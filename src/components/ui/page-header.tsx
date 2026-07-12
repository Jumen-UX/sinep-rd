import * as React from 'react'

import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageHeaderProps extends React.ComponentProps<'header'> {
  eyebrow?: string
  title: string
  description?: string
  breadcrumbs?: BreadcrumbItem[]
  actions?: React.ReactNode
  metadata?: React.ReactNode
}

function PageHeader({
  className,
  eyebrow,
  title,
  description,
  breadcrumbs,
  actions,
  metadata,
  ...props
}: PageHeaderProps) {
  return (
    <header className={cn('grid gap-5 border-b border-[var(--border)] pb-6', className)} {...props}>
      {breadcrumbs?.length ? (
        <nav aria-label="Ruta de navegación">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
            {breadcrumbs.map((item, index) => (
              <li key={`${item.label}-${index}`} className="flex items-center gap-2">
                {index > 0 ? <span aria-hidden="true">/</span> : null}
                {item.href ? (
                  <a className="rounded-sm hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" href={item.href}>
                    {item.label}
                  </a>
                ) : (
                  <span aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}>{item.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          {eyebrow ? <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary)]">{eyebrow}</p> : null}
          <h1 className="m-0 text-3xl font-bold tracking-tight text-[var(--text-strong)] sm:text-4xl">{title}</h1>
          {description ? <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--text-muted)]">{description}</p> : null}
          {metadata ? <div className="mt-4 flex flex-wrap items-center gap-2">{metadata}</div> : null}
        </div>

        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}

export { PageHeader, type BreadcrumbItem, type PageHeaderProps }
