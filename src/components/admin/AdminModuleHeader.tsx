import type { ReactNode } from 'react'

type AdminModuleHeaderProps = {
  badge: string
  title: string
  eyebrow: string
  heading: string
  description: string
  actions?: ReactNode
  tags?: string[]
  illustration?: ReactNode
}

export default function AdminModuleHeader({
  badge,
  title,
  eyebrow,
  heading,
  description,
  actions,
  tags = [],
  illustration = '◎',
}: AdminModuleHeaderProps) {
  return (
    <>
      <header className="admin-top-header">
        <div className="admin-top-title">
          <span className="admin-mini-mark">{badge}</span>
          <strong>{title}</strong>
        </div>
        {actions && <div className="admin-top-actions">{actions}</div>}
      </header>

      <section className="admin-welcome-panel">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{heading}</h1>
          <p className="lead">{description}</p>
          {tags.length > 0 && (
            <div className="role-list admin-role-list">
              {tags.map((tag) => <span className="role-pill" key={tag}>{tag}</span>)}
            </div>
          )}
        </div>
        <div className="admin-welcome-illustration" aria-hidden="true">{illustration}</div>
      </section>
    </>
  )
}
