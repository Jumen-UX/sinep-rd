'use client'

import Link from 'next/link'
import styles from './EntityDynamicOrganizationChart.module.css'

export type EntityOrganizationPosition = {
  id: string
  person_name: string | null
  person_slug: string | null
  position_title: string | null
  organization_chart_name: string | null
  organization_chart_key: string | null
  organization_unit_name: string | null
  direct_entity_name: string | null
  direct_entity_slug: string | null
  direct_entity_type_name: string | null
  hierarchy_path: string | null
  predecessor_person_name?: string | null
  predecessor_person_slug?: string | null
  successor_person_name?: string | null
  successor_person_slug?: string | null
  start_date?: string | null
  term_start_date?: string | null
  term_end_date?: string | null
  actual_end_date?: string | null
  is_current: boolean
  assignment_status: string | null
}

type OrganizationUnit = {
  key: string
  name: string
  path: string | null
  positions: EntityOrganizationPosition[]
}

type OrganizationChart = {
  key: string
  name: string
  units: OrganizationUnit[]
}

function chartKey(position: EntityOrganizationPosition) {
  return position.organization_chart_key
    ?? position.organization_chart_name
    ?? 'estructura-general'
}

function chartName(position: EntityOrganizationPosition) {
  return position.organization_chart_name ?? 'Estructura general'
}

function unitKey(position: EntityOrganizationPosition) {
  return position.organization_unit_name
    ?? position.direct_entity_name
    ?? 'unidad-principal'
}

function unitName(position: EntityOrganizationPosition) {
  return position.organization_unit_name
    ?? position.direct_entity_name
    ?? 'Unidad principal'
}

export function buildEntityOrganizationCharts(positions: EntityOrganizationPosition[]): OrganizationChart[] {
  const charts = new Map<string, { name: string; units: Map<string, OrganizationUnit> }>()

  positions
    .filter((position) => position.is_current)
    .forEach((position) => {
      const nextChartKey = chartKey(position)
      const nextUnitKey = unitKey(position)
      const chart = charts.get(nextChartKey) ?? {
        name: chartName(position),
        units: new Map<string, OrganizationUnit>(),
      }
      const unit = chart.units.get(nextUnitKey) ?? {
        key: nextUnitKey,
        name: unitName(position),
        path: position.hierarchy_path,
        positions: [],
      }

      unit.positions.push(position)
      chart.units.set(nextUnitKey, unit)
      charts.set(nextChartKey, chart)
    })

  return [...charts.entries()]
    .map(([key, chart]) => ({
      key,
      name: chart.name,
      units: [...chart.units.values()]
        .map((unit) => ({
          ...unit,
          positions: [...unit.positions].sort((left, right) =>
            (left.position_title ?? '').localeCompare(right.position_title ?? '', 'es'),
          ),
        }))
        .sort((left, right) => left.name.localeCompare(right.name, 'es')),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'es'))
}

function statusLabel(value: string | null) {
  const labels: Record<string, string> = {
    active: 'Activo',
    term_expired_still_serving: 'Continúa en funciones',
    vacant: 'Vacante',
    suspended: 'Suspendido',
  }
  return value ? labels[value] ?? value : 'No indicado'
}

function formatDate(value: string | null | undefined) {
  if (!value) return null
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

function PersonLink({ name, slug }: { name: string; slug?: string | null }) {
  return slug ? <Link href={`/personas/${slug}`}>{name}</Link> : <strong>{name}</strong>
}

export default function EntityDynamicOrganizationChart({
  positions,
}: {
  positions: EntityOrganizationPosition[]
}) {
  const charts = buildEntityOrganizationCharts(positions)

  if (charts.length === 0) return null

  return (
    <section className="card dashboard-section" id="organigrama" aria-labelledby="entity-organization-chart-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Organización actual</p>
          <h2 id="entity-organization-chart-title">Organigrama dinámico</h2>
          <p className="meta">La estructura se genera desde los esquemas y unidades realmente configurados para esta entidad.</p>
        </div>
        <span className="role-pill">{positions.filter((position) => position.is_current).length} posiciones</span>
      </div>

      <div className={styles.charts}>
        {charts.map((chart) => (
          <article className={styles.chart} key={chart.key}>
            <header className={styles.chartHeader}>
              <span className={styles.chartMarker} aria-hidden="true">⌘</span>
              <div>
                <p className="eyebrow">Esquema organizativo</p>
                <h3>{chart.name}</h3>
              </div>
            </header>

            <div className={styles.units}>
              {chart.units.map((unit) => (
                <section className={styles.unit} key={unit.key}>
                  <div className={styles.unitHeading}>
                    <div>
                      <h4>{unit.name}</h4>
                      {unit.path && <p className="meta">{unit.path}</p>}
                    </div>
                    <span>{unit.positions.length}</span>
                  </div>

                  <div className={styles.positions}>
                    {unit.positions.map((position) => {
                      const startDate = formatDate(position.term_start_date ?? position.start_date)
                      const endDate = formatDate(position.actual_end_date ?? position.term_end_date)

                      return (
                        <article className={styles.position} key={position.id}>
                          <div className={styles.positionHeading}>
                            <div>
                              <strong>{position.position_title ?? 'Posición sin título'}</strong>
                              <span>{position.direct_entity_type_name ?? position.direct_entity_name ?? 'Entidad principal'}</span>
                            </div>
                            <span className="admin-status-pill active">{statusLabel(position.assignment_status)}</span>
                          </div>

                          <div className={styles.holder}>
                            {position.person_name ? (
                              <PersonLink name={position.person_name} slug={position.person_slug} />
                            ) : (
                              <strong>Vacante</strong>
                            )}
                            {position.direct_entity_slug && (
                              <Link className="inline-link" href={`/entidades/${position.direct_entity_slug}`}>
                                Ver entidad
                              </Link>
                            )}
                          </div>

                          {(startDate || endDate) && (
                            <p className={styles.term}>
                              {startDate ?? 'Inicio no indicado'} – {endDate ?? 'actual'}
                            </p>
                          )}

                          {(position.predecessor_person_name || position.successor_person_name) && (
                            <div className={styles.succession} aria-label={`Sucesión de ${position.position_title ?? 'la posición'}`}>
                              <div>
                                <span>Predecesor</span>
                                {position.predecessor_person_name
                                  ? <PersonLink name={position.predecessor_person_name} slug={position.predecessor_person_slug} />
                                  : <strong>Sin registro</strong>}
                              </div>
                              <span className={styles.successionArrow} aria-hidden="true">→</span>
                              <div>
                                <span>Sucesor</span>
                                {position.successor_person_name
                                  ? <PersonLink name={position.successor_person_name} slug={position.successor_person_slug} />
                                  : <strong>No designado</strong>}
                              </div>
                            </div>
                          )}
                        </article>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
