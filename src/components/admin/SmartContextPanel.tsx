import type { ReactNode } from 'react'

type SmartContextPanelProps = {
  title?: string
  eyebrow?: string
  children: ReactNode
}

export default function SmartContextPanel({ title = 'Panel inteligente', eyebrow = 'Contexto', children }: SmartContextPanelProps) {
  return (
    <aside
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] xl:sticky xl:top-4 xl:self-start"
      aria-label={title}
    >
      <div className="border-b border-[var(--border-subtle)] pb-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary)]">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--text-strong)]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Revisa el estado del registro mientras completas el asistente.</p>
      </div>
      <div className="mt-4 grid gap-3 [&_.admin-context-block]:rounded-[var(--radius-md)] [&_.admin-context-block]:border [&_.admin-context-block]:border-[var(--border-subtle)] [&_.admin-context-block]:bg-[var(--surface-muted)] [&_.admin-context-block]:p-3 [&_.admin-context-block_span]:block [&_.admin-context-block_span]:text-xs [&_.admin-context-block_span]:font-semibold [&_.admin-context-block_span]:uppercase [&_.admin-context-block_span]:tracking-wide [&_.admin-context-block_span]:text-[var(--text-subtle)] [&_.admin-context-block_strong]:mt-1 [&_.admin-context-block_strong]:block [&_.admin-context-block_strong]:text-sm [&_.admin-context-block_strong]:text-[var(--text-strong)]">
        {children}
      </div>
    </aside>
  )
}
