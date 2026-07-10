import type { ReactNode } from 'react'
import Link from 'next/link'

type EntitySectionCardProps = {
  eyebrow?: string
  title: string
  description?: string
  editHref?: string
  editLabel?: string
  status?: string
  children: ReactNode
}

export default function EntitySectionCard({
  eyebrow,
  title,
  description,
  editHref,
  editLabel = 'Editar',
  status,
  children,
}: EntitySectionCardProps) {
  return (
    <article className="card admin-entity-section-card">
      <div className="section-heading">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
          {description && <p className="meta">{description}</p>}
        </div>
        <div className="admin-entity-section-actions">
          {status && <span className="admin-status-pill active">{status}</span>}
          {editHref && <Link className="button button-secondary" href={editHref}>{editLabel}</Link>}
        </div>
      </div>
      <div className="admin-entity-section-content">{children}</div>
    </article>
  )
}
