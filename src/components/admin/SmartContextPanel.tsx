import type { ReactNode } from 'react'

type SmartContextPanelProps = {
  title?: string
  eyebrow?: string
  children: ReactNode
}

export default function SmartContextPanel({ title = 'Panel inteligente', eyebrow = 'Contexto', children }: SmartContextPanelProps) {
  return (
    <aside className="card admin-smart-context-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="admin-smart-context-content">{children}</div>
    </aside>
  )
}
