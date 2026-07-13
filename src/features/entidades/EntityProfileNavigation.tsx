'use client'

import styles from './EntityProfileNavigation.module.css'

type EntityProfileNavigationProps = {
  relationshipCount: number
  timelineCount: number
  statisticsCount: number
  positionCount: number
  hasAuthority: boolean
}

const baseItems = [
  { href: '#datos', label: 'Datos', key: 'data' },
  { href: '#autoridad', label: 'Autoridad', key: 'authority' },
  { href: '#jerarquia', label: 'Jerarquía', key: 'relationships' },
  { href: '#historia', label: 'Historia', key: 'timeline' },
  { href: '#estadisticas', label: 'Estadísticas', key: 'statistics' },
  { href: '#organigrama', label: 'Organigrama', key: 'positions' },
] as const

export default function EntityProfileNavigation({
  relationshipCount,
  timelineCount,
  statisticsCount,
  positionCount,
  hasAuthority,
}: EntityProfileNavigationProps) {
  const counts: Record<(typeof baseItems)[number]['key'], number | null> = {
    data: null,
    authority: hasAuthority ? 1 : 0,
    relationships: relationshipCount,
    timeline: timelineCount,
    statistics: statisticsCount,
    positions: positionCount,
  }

  const visibleItems = baseItems.filter((item) => item.key === 'data' || (counts[item.key] ?? 0) > 0)

  return (
    <nav className={styles.navigation} aria-label="Secciones de la ficha institucional">
      <div className={styles.track}>
        {visibleItems.map((item) => (
          <a className={styles.link} href={item.href} key={item.key}>
            <span>{item.label}</span>
            {counts[item.key] !== null && <strong>{counts[item.key]}</strong>}
          </a>
        ))}
      </div>
    </nav>
  )
}
