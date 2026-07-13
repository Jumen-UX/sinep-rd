'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import styles from './PersonAssignmentHistory.module.css'

export type AssignmentHistoryItem = {
  id: string
  position_title: string | null
  organization_chart_name: string | null
  organization_unit_name: string | null
  direct_entity_name: string | null
  direct_entity_slug: string | null
  direct_entity_type_name: string | null
  parish_name: string | null
  parish_slug: string | null
  zone_name: string | null
  zone_slug: string | null
  vicariate_name: string | null
  vicariate_slug: string | null
  diocese_name: string | null
  diocese_slug: string | null
  organization_unit_name: string | null
  organization_unit_slug: string | null
  predecessor_person_name: string | null
  predecessor_person_slug: string | null
  successor_person_name: string | null
  successor_person_slug: string | null
  start_date: string | null
  term_start_date: string | null
  term_end_date: string | null
  actual_end_date: string | null
  is_current: boolean
  assignment_status: string | null
  selection_method: string | null
  notes_public: string | null
}

type Props = {
  personId: string
  onCountChange?: (count: number) => void
  onItemsChange?: (items: AssignmentHistoryItem[]) => void
}

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return 'Fecha no válida'
  return new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function statusLabel(value: string | null, current: boolean) {
  if (current) return 'Vigente'
  const labels: Record<string, string> = {
    active: 'Activo',
    term_expired_still_serving: 'Período vencido, continúa',
    renewed: 'Renovado',
    replaced: 'Sustituido',
    vacant: 'Vacante',
    suspended: 'Suspendido',
    ended: 'Finalizado',
  }
  return labels[value ?? ''] ?? value ?? 'Finalizado'
}

export function assignmentEntityTarget(item: AssignmentHistoryItem) {
  const candidates = [
    [item.direct_entity_name, item.direct_entity_slug],
    [item.organization_unit_name, item.organization_unit_slug],
    [item.parish_name, item.parish_slug],
    [item.zone_name, item.zone_slug],
    [item.vicariate_name, item.vicariate_slug],
    [item.diocese_name, item.diocese_slug],
  ] as const
  return candidates.find(([name]) => Boolean(name)) ?? [null, null]
}

function PersonLink({ name, slug }: { name: string | null; slug: string | null }) {
  if (!name) return <span>—</span>
  if (!slug) return <span>{name}</span>
  return <Link href={`/personas/${slug}`}>{name}</Link>
}

export default function PersonAssignmentHistory({ personId, onCountChange, onItemsChange }: Props) {
  const [items, setItems] = useState<AssignmentHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data, error: queryError } = await supabase
        .from('public_position_assignments_with_hierarchy')
        .select('id,position_title,organization_chart_name,organization_unit_name,direct_entity_name,direct_entity_slug,direct_entity_type_name,parish_name,parish_slug,zone_name,zone_slug,vicariate_name,vicariate_slug,diocese_name,diocese_slug,organization_unit_name,organization_unit_slug,predecessor_person_name,predecessor_person_slug,successor_person_name,successor_person_slug,start_date,term_start_date,term_end_date,actual_end_date,is_current,assignment_status,selection_method,notes_public')
        .eq('person_id', personId)
        .order('start_date', { ascending: false, nullsFirst: false })

      if (cancelled) return
      if (queryError) {
        setError(queryError.message)
        setItems([])
        onCountChange?.(0)
        onItemsChange?.([])
      } else {
        const nextItems = (data ?? []) as AssignmentHistoryItem[]
        setItems(nextItems)
        onCountChange?.(nextItems.length)
        onItemsChange?.(nextItems)
      }
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [onCountChange, onItemsChange, personId])

  const currentCount = useMemo(() => items.filter((item) => item.is_current).length, [items])

  return (
    <section className={`card ${styles.section}`} id="nombramientos" aria-labelledby="person-assignment-history-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Trayectoria de servicio</p>
          <h2 id="person-assignment-history-title">Nombramientos y asignaciones</h2>
          <p className="meta">Historial cronológico de oficios, entidades, períodos y sucesiones registrados.</p>
        </div>
        {!loading && !error && <span className="role-pill">{items.length} registros · {currentCount} vigentes</span>}
      </div>

      {loading && <div className="empty-state">Cargando trayectoria de servicio...</div>}
      {error && <div className="error-box">No se pudo cargar el historial de nombramientos: {error}</div>}
      {!loading && !error && items.length === 0 && <div className="empty-state">No hay nombramientos registrados para esta persona.</div>}

      {!loading && !error && items.length > 0 && (
        <div className={styles.timeline}>
          {items.map((item) => {
            const [entityName, entitySlug] = assignmentEntityTarget(item)
            return (
              <article className={styles.item} key={item.id}>
                <div className={styles.marker} aria-hidden="true" />
                <div className={styles.card}>
                  <div className={styles.header}>
                    <div>
                      <p className="eyebrow">{item.organization_chart_name ?? item.direct_entity_type_name ?? 'Nombramiento'}</p>
                      <h3>{item.position_title ?? 'Cargo sin título registrado'}</h3>
                    </div>
                    <span className={`role-pill ${item.is_current ? styles.current : ''}`}>{statusLabel(item.assignment_status, item.is_current)}</span>
                  </div>

                  <dl className={styles.details}>
                    <div><dt>Entidad</dt><dd>{entityName && entitySlug ? <Link href={`/entidades/${entitySlug}`}>{entityName}</Link> : entityName ?? 'No registrada'}</dd></div>
                    <div><dt>Período</dt><dd>{formatDate(item.term_start_date ?? item.start_date)} — {item.is_current ? 'actual' : formatDate(item.actual_end_date ?? item.term_end_date)}</dd></div>
                    <div><dt>Unidad</dt><dd>{item.organization_unit_name ?? item.organization_chart_name ?? 'No registrada'}</dd></div>
                    <div><dt>Forma de selección</dt><dd>{item.selection_method ?? 'No registrada'}</dd></div>
                  </dl>

                  {(item.predecessor_person_name || item.successor_person_name) && (
                    <div className={styles.succession}>
                      <span>Predecesor: <PersonLink name={item.predecessor_person_name} slug={item.predecessor_person_slug} /></span>
                      <span>Sucesor: <PersonLink name={item.successor_person_name} slug={item.successor_person_slug} /></span>
                    </div>
                  )}

                  {item.notes_public && <p className={styles.notes}>{item.notes_public}</p>}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
