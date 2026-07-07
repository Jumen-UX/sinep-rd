'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>
type WorkMode = 'all' | 'historical' | 'new' | 'calendar' | 'pending'

type EventRegistryRow = {
  source_kind: string
  event_id: string
  event_date: string | null
  event_year: number | null
  event_month: number | null
  event_day: number | null
  title: string
  event_type_key: string | null
  event_type_name: string | null
  related_entity_id: string | null
  related_entity_name: string | null
  related_entity_type_key: string | null
  source_name: string | null
  source_url: string | null
  evidence_status: string | null
  load_mode: string
  workflow_status: string
}

type SummaryFacet = {
  key?: string
  name?: string
  month?: number
  count: number
}

type EventRegistrySummary = {
  total_events: number
  historical_events: number
  new_events: number
  calendar_occurrences: number
  verified_or_documented: number
  pending_evidence: number
  min_year: number | null
  max_year: number | null
  months: SummaryFacet[]
  event_types: SummaryFacet[]
  load_modes: SummaryFacet[]
}

const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const workModes: Array<{ key: WorkMode; title: string; description: string }> = [
  { key: 'all', title: 'Todo el registro', description: 'Eventos históricos, nuevos y ocurrencias generadas.' },
  { key: 'historical', title: 'Carga histórica', description: 'Reconstrucción de hechos ya ocurridos con nivel de evidencia.' },
  { key: 'new', title: 'Evento nuevo', description: 'Cambios presentes o futuros que deberán pasar por flujo de aprobación.' },
  { key: 'calendar', title: 'Fechas', description: 'Aniversarios y ocurrencias generadas desde datos base.' },
  { key: 'pending', title: 'Pendientes', description: 'Datos con documento o evidencia pendiente de completar.' },
]

const pageStyles = `
  .events-page select,
  .events-page input {
    border: 1px solid var(--border);
    border-radius: 14px;
    font: inherit;
    padding: 12px 14px;
    width: 100%;
  }

  .events-hero {
    align-items: stretch;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 0.42fr);
  }

  .events-summary-card {
    background: #fbf8f1;
    border: 1px solid var(--border);
    border-radius: 18px;
    display: grid;
    gap: 10px;
    padding: 20px;
  }

  .events-summary-card strong {
    font-size: 34px;
    letter-spacing: -0.04em;
    line-height: 1;
  }

  .events-toolbar,
  .events-tabs,
  .events-layout,
  .events-metrics,
  .events-timeline,
  .event-card,
  .facets-grid,
  .event-principles,
  .flow-grid {
    display: grid;
    gap: 14px;
  }

  .events-toolbar {
    align-items: end;
    grid-template-columns: minmax(180px, 0.6fr) minmax(180px, 0.6fr) minmax(220px, 1fr) minmax(200px, 0.8fr);
  }

  .events-toolbar label {
    color: var(--muted);
    display: grid;
    font-size: 14px;
    font-weight: 800;
    gap: 7px;
  }

  .events-tabs {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .events-tab {
    appearance: none;
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 18px;
    cursor: pointer;
    display: grid;
    gap: 6px;
    padding: 16px;
    text-align: left;
  }

  .events-tab.active {
    border-color: rgba(122, 31, 31, 0.55);
    box-shadow: 0 16px 38px rgba(122, 31, 31, 0.12);
  }

  .events-layout {
    align-items: start;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 0.36fr);
  }

  .events-metrics {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .events-metric,
  .event-card,
  .facet-card,
  .principle-card,
  .flow-step {
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 16px;
    display: grid;
    gap: 7px;
    padding: 14px;
  }

  .events-metric strong {
    font-size: 28px;
    letter-spacing: -0.04em;
  }

  .event-card {
    border-left: 5px solid rgba(122, 31, 31, 0.25);
  }

  .event-card-main {
    align-items: start;
    display: flex;
    gap: 12px;
    justify-content: space-between;
  }

  .event-date-box {
    align-items: center;
    background: #fbf8f1;
    border: 1px solid var(--border);
    border-radius: 14px;
    display: grid;
    flex: 0 0 76px;
    justify-items: center;
    padding: 10px;
  }

  .event-date-box strong {
    font-size: 22px;
    line-height: 1;
  }

  .event-date-box span {
    color: var(--muted);
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .event-info {
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  .event-info h3 {
    margin: 0;
  }

  .badge-row {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .mini-badge {
    background: #fbf8f1;
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--primary);
    display: inline-flex;
    font-size: 12px;
    font-weight: 900;
    padding: 6px 9px;
  }

  .mini-badge.warning {
    background: #fff7ed;
    color: #9a3412;
  }

  .mini-badge.success {
    background: #f0fdf4;
    color: #166534;
  }

  .facets-grid,
  .event-principles,
  .flow-grid {
    grid-template-columns: 1fr;
  }

  .facet-card.highlight,
  .principle-card.highlight {
    background: #fbf8f1;
    border-style: dashed;
  }

  .detail-backlink {
    margin-bottom: 8px;
  }

  .detail-backlink a {
    color: var(--primary);
    font-weight: 800;
    text-decoration: none;
  }

  @media (max-width: 1080px) {
    .events-hero,
    .events-toolbar,
    .events-tabs,
    .events-layout,
    .events-metrics {
      grid-template-columns: 1fr;
    }
  }
`

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

function dayValue(value?: string | null) {
  if (!value) return '—'
  return new Date(`${value}T00:00:00`).getDate().toString().padStart(2, '0')
}

function monthLabel(month?: number | null) {
  if (!month || month < 1 || month > 12) return 'Sin mes'
  return monthNames[month - 1]
}

function loadModeLabel(value?: string | null) {
  if (value === 'carga_historica') return 'Carga histórica'
  if (value === 'evento_nuevo') return 'Evento nuevo'
  if (value === 'evento_calendario') return 'Fecha derivada'
  return value ?? 'Sin modo'
}

function evidenceLabel(value?: string | null) {
  if (value === 'verified') return 'Verificado'
  if (value === 'documentado') return 'Documentado'
  if (value === 'pendiente_documento') return 'Documento pendiente'
  if (value === 'generado_desde_dato_base') return 'Generado desde dato base'
  if (value === 'generado_sin_fuente_directa') return 'Sin fuente directa'
  return value ?? 'Sin evidencia'
}

function isEvidencePending(event: EventRegistryRow) {
  return !['verified', 'documentado'].includes(event.evidence_status ?? '')
}

export default function AdminEventosPage() {
  const router = useRouter()
  const supabase = useMemo<SupabaseClient>(() => createClient(), [])

  const [summary, setSummary] = useState<EventRegistrySummary | null>(null)
  const [events, setEvents] = useState<EventRegistryRow[]>([])
  const [workMode, setWorkMode] = useState<WorkMode>('all')
  const [yearFilter, setYearFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [searchText, setSearchText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadEvents() {
    setLoading(true)
    setError(null)

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    const yearValue = yearFilter ? Number(yearFilter) : null
    const monthValue = monthFilter ? Number(monthFilter) : null

    const [summaryRes, eventsRes] = await Promise.all([
      supabase.rpc('get_event_registry_summary'),
      supabase.rpc('get_event_registry_stream', {
        p_year: yearValue,
        p_month: monthValue,
        p_event_type: typeFilter || null,
        p_entity_id: null,
        p_limit: 180,
      }),
    ])

    if (summaryRes.error) setError(summaryRes.error.message)
    if (eventsRes.error) setError(eventsRes.error.message)

    setSummary((summaryRes.data ?? null) as EventRegistrySummary | null)
    setEvents((eventsRes.data ?? []) as EventRegistryRow[])
    setLoading(false)
  }

  useEffect(() => {
    loadEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearFilter, monthFilter, typeFilter])

  const filteredEvents = events.filter((event) => {
    if (workMode === 'historical' && event.load_mode !== 'carga_historica') return false
    if (workMode === 'new' && event.load_mode !== 'evento_nuevo') return false
    if (workMode === 'calendar' && event.load_mode !== 'evento_calendario') return false
    if (workMode === 'pending' && !isEvidencePending(event)) return false

    if (searchText.trim()) {
      const search = searchText.trim().toLowerCase()
      const haystack = [event.title, event.related_entity_name, event.event_type_name, event.source_name].filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(search)) return false
    }

    return true
  })

  const years = useMemo(() => {
    const min = summary?.min_year ?? 1500
    const max = summary?.max_year ?? new Date().getFullYear()
    const list: number[] = []
    for (let year = max; year >= min; year -= 1) list.push(year)
    return list
  }, [summary?.min_year, summary?.max_year])

  if (loading) {
    return <main className="container"><div className="empty-state">Cargando registro de eventos...</div></main>
  }

  return (
    <main className="container dashboard-page events-page">
      <style>{pageStyles}</style>
      <div className="detail-backlink"><Link href="/admin">← Volver al panel administrativo</Link></div>

      <section className="dashboard-hero card events-hero">
        <div>
          <p className="eyebrow">SINEP Core · motor histórico-documental</p>
          <h1>Eventos</h1>
          <p className="lead">Centro para reconstruir la historia inicial y luego alimentar el sistema con eventos nuevos. El evento es la unidad de verdad; la página es una vista derivada.</p>
        </div>
        <div className="events-summary-card">
          <span className="mini-badge">Registro navegable</span>
          <strong>{summary?.total_events ?? 0}</strong>
          <span className="meta">eventos y fechas en el índice · {summary?.verified_or_documented ?? 0} documentados/verificados</span>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="events-metrics">
        <div className="events-metric"><strong>{summary?.historical_events ?? 0}</strong><span>Carga histórica</span></div>
        <div className="events-metric"><strong>{summary?.new_events ?? 0}</strong><span>Eventos nuevos</span></div>
        <div className="events-metric"><strong>{summary?.calendar_occurrences ?? 0}</strong><span>Fechas derivadas</span></div>
        <div className="events-metric"><strong>{summary?.pending_evidence ?? 0}</strong><span>Evidencia pendiente</span></div>
      </section>

      <section className="card dashboard-section">
        <div className="events-toolbar">
          <label>Año
            <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
              <option value="">Todos los años</option>
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label>Mes
            <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}>
              <option value="">Todos los meses</option>
              {monthNames.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
            </select>
          </label>
          <label>Tipo de evento
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="">Todos los tipos</option>
              {(summary?.event_types ?? []).map((facet) => <option key={facet.key} value={facet.key}>{facet.name ?? facet.key} · {facet.count}</option>)}
            </select>
          </label>
          <label>Buscar
            <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Diócesis, febrero, fuente..." />
          </label>
        </div>
      </section>

      <section className="events-tabs">
        {workModes.map((mode) => (
          <button className={`events-tab ${workMode === mode.key ? 'active' : ''}`} key={mode.key} onClick={() => setWorkMode(mode.key)} type="button">
            <strong>{mode.title}</strong>
            <span>{mode.description}</span>
          </button>
        ))}
      </section>

      <section className="events-layout">
        <div className="card dashboard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Línea de eventos</p>
              <h2>{filteredEvents.length} resultados</h2>
              <p className="meta">Al hacer clic en un año, mes, entidad, tipo de evento o documento, la futura vista pública podrá generar páginas derivadas.</p>
            </div>
          </div>

          <div className="events-timeline">
            {filteredEvents.length === 0 && <div className="empty-state">No hay eventos con esos filtros.</div>}
            {filteredEvents.map((event) => (
              <article className="event-card" key={`${event.source_kind}-${event.event_id}`}>
                <div className="event-card-main">
                  <div className="event-date-box">
                    <strong>{dayValue(event.event_date)}</strong>
                    <span>{monthLabel(event.event_month).slice(0, 3)}</span>
                    <span>{event.event_year ?? '—'}</span>
                  </div>
                  <div className="event-info">
                    <h3>{event.title}</h3>
                    <p className="meta">{formatDate(event.event_date)} · {event.event_type_name ?? event.event_type_key ?? 'Tipo no definido'}</p>
                    <div className="badge-row">
                      <span className="mini-badge">{loadModeLabel(event.load_mode)}</span>
                      <span className={`mini-badge ${isEvidencePending(event) ? 'warning' : 'success'}`}>{evidenceLabel(event.evidence_status)}</span>
                      {event.related_entity_name && <span className="mini-badge">{event.related_entity_name}</span>}
                      {event.source_name && <span className="mini-badge">Fuente: {event.source_name}</span>}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="facets-grid">
          <div className="facet-card highlight">
            <strong>Principio del módulo</strong>
            <span className="meta">Primero se reconstruye la historia. Después el sistema queda vivo y se alimenta por eventos nuevos.</span>
          </div>

          <div className="facet-card">
            <strong>Páginas derivadas</strong>
            <span className="meta">Año, mes, entidad, persona, documento, territorio y categoría no serán artículos manuales: serán vistas generadas desde eventos.</span>
          </div>

          <div className="facet-card">
            <strong>Meses con eventos</strong>
            {(summary?.months ?? []).slice(0, 12).map((facet) => (
              <span className="meta" key={facet.month}>{monthLabel(facet.month)} · {facet.count}</span>
            ))}
          </div>

          <div className="facet-card">
            <strong>Tipos frecuentes</strong>
            {(summary?.event_types ?? []).slice(0, 8).map((facet) => (
              <span className="meta" key={facet.key}>{facet.name ?? facet.key} · {facet.count}</span>
            ))}
          </div>

          <div className="facet-card highlight">
            <strong>Asistentes pendientes</strong>
            <span className="meta">Registrar evento nuevo</span>
            <span className="meta">Carga histórica guiada</span>
            <span className="meta">Vista previa de impacto</span>
            <span className="meta">Adjuntar documento fuente</span>
          </div>
        </aside>
      </section>
    </main>
  )
}
