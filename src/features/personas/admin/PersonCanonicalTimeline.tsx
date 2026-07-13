import type { AdminPersonDetail } from '../services/person-admin-service'
import styles from './PersonCanonicalTimeline.module.css'

type TimelineItem = {
  id: string
  date: string | null
  endDate?: string | null
  category: string
  title: string
  detail: string
  current?: boolean
}

const ordinationLabels: Record<string, string> = {
  diaconate: 'Ordenación diaconal',
  presbyterate: 'Ordenación presbiteral',
  episcopate: 'Ordenación episcopal',
}

const dimensionLabels: Record<string, string> = {
  incardination: 'Incardinación',
  canonical_status: 'Estado canónico',
  episcopal_role: 'Función episcopal',
  dignity: 'Dignidad eclesiástica',
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Fecha no registrada'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function buildPersonCanonicalTimeline(person: AdminPersonDetail): TimelineItem[] {
  const ordinations: TimelineItem[] = person.ordination_history.map((ordination) => ({
    id: `ordination-${ordination.degree}`,
    date: ordination.ordination_date,
    category: 'Orden sagrado',
    title: ordinationLabels[ordination.degree] ?? ordination.degree,
    detail: [ordination.ordination_place, ordination.principal_ordainer_name]
      .filter(Boolean)
      .join(' · ') || 'Sin detalles adicionales',
  }))

  const dimensions: TimelineItem[] = person.clerical_history.map((record, index) => ({
    id: `dimension-${record.dimension_type}-${record.dimension_key}-${index}`,
    date: record.start_date,
    endDate: record.end_date,
    category: dimensionLabels[record.dimension_type] ?? record.dimension_type,
    title: record.display_title ?? record.dimension_key,
    detail: [record.related_entity_name, record.detail_text].filter(Boolean).join(' · ') || 'Sin detalles adicionales',
    current: record.is_current,
  }))

  return [...ordinations, ...dimensions].sort((left, right) => {
    if (!left.date && !right.date) return left.title.localeCompare(right.title, 'es')
    if (!left.date) return 1
    if (!right.date) return -1
    return right.date.localeCompare(left.date)
  })
}

export default function PersonCanonicalTimeline({ person }: { person: AdminPersonDetail }) {
  const items = buildPersonCanonicalTimeline(person)

  return (
    <section className={`card ${styles.card}`} id="historial" aria-labelledby="person-canonical-timeline-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Trayectoria canónica</p>
          <h2 id="person-canonical-timeline-title">Línea de tiempo</h2>
          <p className="meta">Ordenaciones y cambios de estado, pertenencia, función o dignidad registrados para esta persona.</p>
        </div>
        <span className="role-pill">{items.length} hitos</span>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">No hay hitos canónicos registrados.</div>
      ) : (
        <ol className={styles.timeline}>
          {items.map((item) => (
            <li className={styles.item} key={item.id}>
              <div className={styles.marker} aria-hidden="true" />
              <div className={styles.content}>
                <div className={styles.heading}>
                  <div>
                    <span className={styles.category}>{item.category}</span>
                    <h3>{item.title}</h3>
                  </div>
                  {item.current && <span className="admin-status-pill active">Vigente</span>}
                </div>
                <p className={styles.date}>
                  {formatDate(item.date)}{item.endDate ? ` — ${formatDate(item.endDate)}` : ''}
                </p>
                <p className="meta">{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
