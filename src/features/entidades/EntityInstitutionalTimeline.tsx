'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import styles from './EntityInstitutionalTimeline.module.css'

export type EntityEvolutionEvent = {
  id: string
  event_type: string | null
  event_date: string | null
  title: string | null
  from_entity_display_name: string | null
  from_entity_slug: string | null
  from_entity_name: string | null
  to_entity_display_name: string | null
  to_entity_slug: string | null
  to_entity_name: string | null
  related_entity_display_name: string | null
  related_entity_slug: string | null
  related_entity_name: string | null
  territory_summary: string | null
}

export type EntityAuthorityAppointment = {
  id: string
  person_name: string | null
  person_slug: string | null
  office_name: string | null
  office_key: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  notes_public: string | null
}

type TimelineItem = {
  id: string
  date: string | null
  endDate?: string | null
  category: 'Evento institucional' | 'Autoridad'
  title: string
  detail: string
  personSlug?: string | null
  relatedSlug?: string | null
  current?: boolean
}

export type EntityTimelinePayload = {
  entity?: { erected_at?: string | null; name?: string | null }
  evolution_events?: EntityEvolutionEvent[]
  appointment_history?: EntityAuthorityAppointment[]
}

const eventLabels: Record<string, string> = {
  erection: 'Erección canónica',
  elevation: 'Elevación institucional',
  dismemberment: 'Desmembramiento',
  erection_by_dismemberment: 'Erección por desmembramiento',
  territory_loss: 'Pérdida territorial',
  territory_gain: 'Recepción territorial',
  territorial_reorganization: 'Reorganización territorial',
  name_change: 'Cambio de nombre',
  province_change: 'Cambio de provincia eclesiástica',
  suppression: 'Supresión',
  merger: 'Fusión',
  seat_transfer: 'Traslado de sede',
  dependency_change: 'Cambio de dependencia',
}

const authorityOfficeKeys = new Set([
  'metropolitan_archbishop',
  'diocesan_bishop',
  'coadjutor_archbishop',
  'coadjutor_bishop',
  'apostolic_administrator',
  'apostolic_vicar',
  'apostolic_prefect',
  'bishop_emeritus',
])

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

function relatedEntity(event: EntityEvolutionEvent) {
  const candidates = [
    [event.related_entity_display_name ?? event.related_entity_name, event.related_entity_slug],
    [event.to_entity_display_name ?? event.to_entity_name, event.to_entity_slug],
    [event.from_entity_display_name ?? event.from_entity_name, event.from_entity_slug],
  ] as const
  return candidates.find(([name]) => Boolean(name)) ?? [null, null]
}

export function buildEntityInstitutionalTimeline(payload: EntityTimelinePayload): TimelineItem[] {
  const events = (payload.evolution_events ?? []).map((event): TimelineItem => {
    const [relatedName, relatedSlug] = relatedEntity(event)
    return {
      id: `event-${event.id}`,
      date: event.event_date,
      category: 'Evento institucional',
      title: event.title ?? eventLabels[event.event_type ?? ''] ?? event.event_type ?? 'Evento institucional',
      detail: [event.territory_summary, relatedName].filter(Boolean).join(' · ') || 'Sin detalles adicionales',
      relatedSlug,
    }
  })

  const authorities = (payload.appointment_history ?? [])
    .filter((appointment) => appointment.office_key && authorityOfficeKeys.has(appointment.office_key))
    .map((appointment): TimelineItem => ({
      id: `authority-${appointment.id}`,
      date: appointment.start_date,
      endDate: appointment.end_date,
      category: 'Autoridad',
      title: appointment.person_name ?? 'Autoridad no identificada',
      detail: [appointment.office_name, appointment.notes_public].filter(Boolean).join(' · ') || 'Sin detalles adicionales',
      personSlug: appointment.person_slug,
      current: appointment.is_current,
    }))

  const erectionFallback: TimelineItem[] = payload.entity?.erected_at && !events.some((item) => item.date === payload.entity?.erected_at)
    ? [{
        id: 'entity-erection-fallback',
        date: payload.entity.erected_at,
        category: 'Evento institucional',
        title: 'Erección canónica',
        detail: `Inicio histórico de ${payload.entity.name ?? 'la entidad'}`,
      }]
    : []

  return [...events, ...authorities, ...erectionFallback].sort((left, right) => {
    if (!left.date && !right.date) return left.title.localeCompare(right.title, 'es')
    if (!left.date) return 1
    if (!right.date) return -1
    return right.date.localeCompare(left.date)
  })
}

export default function EntityInstitutionalTimeline({ payload }: { payload: EntityTimelinePayload }) {
  const items = useMemo(() => buildEntityInstitutionalTimeline(payload), [payload])

  return (
    <section className={`card dashboard-section ${styles.section}`} id="historia-institucional" aria-labelledby="entity-institutional-timeline-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Historia oficial</p>
          <h2 id="entity-institutional-timeline-title">Cronología institucional</h2>
          <p className="meta">Evolución canónica, territorial y sucesión de autoridades registradas para esta entidad.</p>
        </div>
        <span className="role-pill">{items.length} hitos</span>
      </div>

      {items.length === 0 && <div className="empty-state">No hay hechos históricos publicados para esta entidad.</div>}

      {items.length > 0 && (
        <ol className={styles.timeline}>
          {items.map((item) => (
            <li className={styles.item} key={item.id}>
              <div className={styles.marker} aria-hidden="true" />
              <article className={styles.content}>
                <div className={styles.heading}>
                  <div>
                    <span className={styles.category}>{item.category}</span>
                    <h3>
                      {item.personSlug ? <Link href={`/personas/${item.personSlug}`}>{item.title}</Link> : item.title}
                    </h3>
                  </div>
                  {item.current && <span className="admin-status-pill active">Vigente</span>}
                </div>
                <p className={styles.date}>{formatDate(item.date)}{item.endDate ? ` — ${formatDate(item.endDate)}` : ''}</p>
                <p className="meta">{item.detail}</p>
                {item.relatedSlug && <Link className="inline-link" href={`/entidades/${item.relatedSlug}`}>Ver entidad relacionada</Link>}
              </article>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
