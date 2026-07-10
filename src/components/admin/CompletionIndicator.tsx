type CompletionIndicatorProps = {
  completed: number
  total: number
  missing?: string[]
}

export default function CompletionIndicator({ completed, total, missing = [] }: CompletionIndicatorProps) {
  const safeTotal = Math.max(total, 1)
  const percentage = Math.max(0, Math.min(100, Math.round((completed / safeTotal) * 100)))

  return (
    <section className="admin-completion-card" aria-label="Completitud de la ficha">
      <div className="admin-completion-heading">
        <span>Completitud</span>
        <strong>{percentage}%</strong>
      </div>
      <div className="admin-completion-bar" aria-hidden="true">
        <span style={{ width: `${percentage}%` }} />
      </div>
      {missing.length > 0 ? (
        <div>
          <small>Datos pendientes</small>
          <ul>{missing.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      ) : (
        <p className="meta">La ficha no tiene datos esenciales pendientes.</p>
      )}
    </section>
  )
}
