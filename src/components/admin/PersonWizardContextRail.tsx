import { StatusBadge } from '@/components/ui/status-badge'

type PersonWizardContextRailProps = {
  title: string
  description: string
  dimensions: string[]
}

export default function PersonWizardContextRail({
  title,
  description,
  dimensions,
}: PersonWizardContextRailProps) {
  return (
    <aside className="person-wizard-context-rail" aria-label={`Resumen de ${title}`}>
      <div className="person-wizard-context-heading">
        <p className="eyebrow">Resumen permanente</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="person-wizard-context-list">
        {dimensions.map((dimension, index) => (
          <div key={dimension}>
            <span>{index + 1}</span>
            <strong>{dimension}</strong>
            <StatusBadge tone="neutral">Por completar</StatusBadge>
          </div>
        ))}
      </div>

      <p className="person-wizard-context-note">
        Cada dimensión se conserva por separado para evitar duplicar personas o mezclar sacramento, estado, función y cargo.
      </p>
    </aside>
  )
}
