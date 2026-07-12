import * as React from 'react'

import { cn } from '@/lib/utils'

interface DataTableProps extends React.ComponentProps<'div'> {
  toolbar?: React.ReactNode
  footer?: React.ReactNode
  caption?: string
  children: React.ReactNode
}

function DataTable({ className, toolbar, footer, caption, children, ...props }: DataTableProps) {
  return (
    <div className={cn('overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]', className)} {...props}>
      {toolbar ? <div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">{toolbar}</div> : null}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          {children}
        </table>
      </div>
      {footer ? <div className="border-t border-[var(--border)] px-4 py-3">{footer}</div> : null}
    </div>
  )
}

function DataTableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead className={cn('bg-[var(--surface-muted)] text-xs uppercase tracking-wide text-[var(--text-muted)]', className)} {...props} />
}

function DataTableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody className={cn('divide-y divide-[var(--border)]', className)} {...props} />
}

function DataTableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return <tr className={cn('transition-colors hover:bg-[var(--surface-hover)] focus-within:bg-[var(--surface-hover)]', className)} {...props} />
}

function DataTableHead({ className, scope = 'col', ...props }: React.ComponentProps<'th'>) {
  return <th className={cn('h-11 px-4 font-semibold', className)} scope={scope} {...props} />
}

function DataTableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return <td className={cn('px-4 py-3 align-middle text-[var(--text)]', className)} {...props} />
}

export { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow, type DataTableProps }
