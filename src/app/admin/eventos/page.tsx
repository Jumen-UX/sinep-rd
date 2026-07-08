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

type SummaryFacet = { key?: string; name?: string; month?: number; count: number }

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

const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const workModes: Array<{ key: WorkMode; title: string; description: string }> = [
  { key: 'all', title: 'Todo el registro', description: 'Eventos históricos, nuevos y ocurrencias generadas.' },
  { key: 'historical', title: 'Carga histórica', description: 'Reconstrucción de hechos ya ocurridos con nivel de evidencia.' },
  { key: 'new', title: 'Evento nuevo', description: 'Cambios presentes o futuros que deberán pasar por flujo de aprobación.' },
  { key: 'calendar', title: 'Fechas', description: 'Aniversarios y ocurrencias generadas desde datos base.' },
  { key: 'pending', title: 'Pendientes', description: 'Datos con documento o evidencia pendiente de completar.' },
]

const pageStyles = `
  .events-page select,.events-page input{border:1px solid var(--border);border-radius:14px;font:inherit;padding:12px 14px;width:100%}
  .events-hero{align-items:stretch;grid-template-columns:minmax(0,1fr) minmax(280px,.42fr)}
  .events-summary-card{background:#fbf8f1;border:1px solid var(--border);border-radius:18px;display:grid;gap:10px;padding:20px}.events-summary-card strong{font-size:34px;letter-spacing:-.04em;line-height:1}
  .events-toolbar,.events-tabs,.events-layout,.events-metrics,.events-timeline,.facets-grid,.derived-list,.impact-list,.event-detail-grid,.action-link-grid{display:grid;gap:14px}
  .events-toolbar{align-items:end;grid-template-columns:minmax(180px,.6fr) minmax(180px,.6fr) minmax(220px,1fr) minmax(200px,.8fr)}.events-toolbar label{color:var(--muted);display:grid;font-size:14px;font-weight:800;gap:7px}
  .events-tabs{grid-template-columns:repeat(5,minmax(0,1fr))}.events-tab,.event-card-button{appearance:none;background:#fff;border:1px solid var(--border);cursor:pointer;font:inherit;text-align:left}.events-tab{border-radius:18px;display:grid;gap:6px;padding:16px}.events-tab.active,.event-card-button.active{border-color:rgba(122,31,31,.55);box-shadow:0 16px 38px rgba(122,31,31,.12)}
  .events-layout{align-items:start;grid-template-columns:minmax(0,1fr) minmax(320px,.42fr)}.events-metrics{grid-template-columns:repeat(4,minmax(0,1fr))}.events-metric,.event-card-button,.facet-card,.derived-card,.impact-card,.detail-tile{background:#fff;border:1px solid var(--border);border-radius:16px;display:grid;gap:7px;padding:14px}.events-metric strong{font-size:28px;letter-spacing:-.04em}.event-card-button{border-left:5px solid rgba(122,31,31,.25);width:100%}
  .event-card-main{align-items:start;display:flex;gap:12px;justify-content:space-between}.event-date-box{align-items:center;background:#fbf8f1;border:1px solid var(--border);border-radius:14px;display:grid;flex:0 0 76px;justify-items:center;padding:10px}.event-date-box strong{font-size:22px;line-height:1}.event-date-box span{color:var(--muted);font-size:12px;font-weight:800;text-transform:uppercase}.event-info{display:grid;gap:6px;min-width:0}.event-info h3{margin:0}.badge-row,.button-row{display:flex;flex-wrap:wrap;gap:7px}.mini-badge{background:#fbf8f1;border:1px solid var(--border);border-radius:999px;color:var(--primary);display:inline-flex;font-size:12px;font-weight:900;padding:6px 9px}.mini-badge.warning{background:#fff7ed;color:#9a3412}.mini-badge.success{background:#f0fdf4;color:#166534}.facet-card.highlight,.derived-card.highlight,.impact-card.highlight{background:#fbf8f1;border-style:dashed}.event-detail-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.action-link-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.detail-backlink{margin-bottom:8px}.detail-backlink a{color:var(--primary);font-weight:800;text-decoration:none}@media(max-width:1080px){.events-hero,.events-toolbar,.events-tabs,.events-layout,.events-metrics,.event-detail-grid,.action-link-grid{grid-template-columns:1fr}}
`

function eventKey(event: EventRegistryRow) { return `${event.source_kind}:${event.event_id}` }
function formatDate(value?: string | null) { return value ? new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`)) : 'Sin fecha' }
function dayValue(value?: string | null) { return value ? new Date(`${value}T00:00:00`).getDate().toString().padStart(2, '0') : '—' }
function monthLabel(month?: number | null) { return month && month >= 1 && month <= 12 ? monthNames[month - 1] : 'Sin mes' }
function loadModeLabel(value?: string | null) { if (value === 'carga_historica') return 'Carga histórica'; if (value === 'evento_nuevo') return 'Evento nuevo'; if (value === 'evento_calendario') return 'Fecha derivada'; if (value === 'foto_inicial') return 'Foto inicial'; return value ?? 'Sin modo' }
function evidenceLabel(value?: string | null) { if (value === 'verified') return 'Verificado'; if (value === 'documentado' || value === 'confirmado_oficial') return 'Documentado'; if (value === 'pendiente_documento') return 'Documento pendiente'; if (value === 'generado_desde_dato_base') return 'Generado desde dato base'; if (value === 'generado_sin_fuente_directa') return 'Sin fuente directa'; if (value === 'fuente_secundaria') return 'Fuente secundaria'; if (value === 'importado_vigente') return 'Importado vigente'; return value ?? 'Sin evidencia' }
function isEvidencePending(event: EventRegistryRow) { return !['verified', 'documentado', 'confirmado_oficial'].includes(event.evidence_status ?? '') }
function isCanonicalEvent(event: EventRegistryRow | null) { return event?.source_kind === 'canonical_event' }

function derivedPagesFor(event: EventRegistryRow | null) {
  if (!event) return []
  const pages = ['Página del evento']
  if (event.event_year) pages.push(`Página del año ${event.event_year}`)
  if (event.event_month) pages.push(`Página de ${monthLabel(event.event_month)}`)
  if (event.event_year && event.event_month) pages.push(`${monthLabel(event.event_month)} de ${event.event_year}`)
  if (event.related_entity_name) pages.push(`Página de ${event.related_entity_name}`)
  if (event.event_type_name) pages.push(`Categoría: ${event.event_type_name}`)
  if (event.source_name) pages.push(`Fuente: ${event.source_name}`)
  return pages
}

function impactNotesFor(event: EventRegistryRow | null) {
  if (!event) return []
  if (event.load_mode === 'evento_calendario') return ['No cambia el estado actual; aparece como fecha derivada o aniversario.', 'Debe enlazarse al dato base que originó la fecha.', 'Puede alimentar calendario, recordatorios y páginas de fecha.']
  if (event.load_mode === 'carga_historica') return ['Reconstruye el pasado y alimenta la línea histórica de las entidades relacionadas.', 'Puede confirmar, corregir o completar una ficha vigente importada.', 'Debe conservar nivel de evidencia.']
  if (event.load_mode === 'foto_inicial') return ['Crea o confirma un estado vigente importado.', 'Deja pendiente la reconstrucción del evento originario.', 'Debe revisarse con fuente oficial o secundaria.']
  return ['Debe entrar como borrador o pendiente de revisión.', 'Antes de aplicar, el sistema debe mostrar relaciones que creará, cerrará o modificará.', 'Al aprobarse, actualiza el estado vigente sin borrar la historia anterior.']
}

function EventDetailPanel({ event }: { event: EventRegistryRow | null }) {
  if (!event) return <div className="facet-card highlight"><strong>Selecciona un evento</strong><span className="meta">Aquí se mostrará la ficha, páginas derivadas e impacto.</span></div>

  return (
    <div className="facets-grid">
      <div className="facet-card highlight"><strong>Ficha del evento</strong><span className="meta">{event.title}</span></div>
      <div className="event-detail-grid">
        <div className="detail-tile"><strong>Fecha</strong><span className="meta">{formatDate(event.event_date)}</span></div>
        <div className="detail-tile"><strong>Tipo</strong><span className="meta">{event.event_type_name ?? event.event_type_key ?? '—'}</span></div>
        <div className="detail-tile"><strong>Modo</strong><span className="meta">{loadModeLabel(event.load_mode)}</span></div>
        <div className="detail-tile"><strong>Evidencia</strong><span className="meta">{evidenceLabel(event.evidence_status)}</span></div>
        <div className="detail-tile"><strong>Entidad</strong><span className="meta">{event.related_entity_name ?? '—'}</span></div>
        <div className="detail-tile"><strong>Fuente</strong><span className="meta">{event.source_name ?? '—'}</span></div>
      </div>
      {isCanonicalEvent(event) && (
        <>
          <div className="derived-card highlight"><strong>Flujo operativo</strong><span className="meta">Evento creado por el asistente. Puede revisarse, planificarse y contratar su aplicación sin modificar todavía el estado vigente.</span></div>
          <div className="action-link-grid">
            <Link className="button button-primary" href={`/admin/eventos/${event.event_id}`}>Revisar evento</Link>
            <Link className="button button-secondary" href={`/admin/eventos/${event.event_id}/plan`}>Plan de acciones</Link>
            <Link className="button button-secondary" href={`/admin/eventos/${event.event_id}/contrato`}>Contrato de aplicación</Link>
            <Link className="button button-secondary" href="/admin/eventos/pendientes">Cola de revisión</Link>
          </div>
        </>
      )}
      {!isCanonicalEvent(event) && <div className="derived-card highlight"><strong>Evento histórico/base</strong><span className="meta">Este registro alimenta vistas históricas. Para revisión operativa crea o migra un evento canónico pendiente.</span></div>}
      <div className="derived-card highlight"><strong>Páginas derivadas que alimenta</strong><span className="meta">Vistas generadas desde el evento.</span></div>
      <div className="derived-list">{derivedPagesFor(event).map((page) => <div className="derived-card" key={page}><span className="meta">{page}</span></div>)}</div>
      <div className="impact-card highlight"><strong>Vista previa de impacto</strong><span className="meta">Qué cambia y qué queda histórico.</span></div>
      <div className="impact-list">{impactNotesFor(event).map((note) => <div className="impact-card" key={note}><span className="meta">{note}</span></div>)}</div>
    </div>
  )
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
  const [selectedEventKey, setSelectedEventKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadEvents() {
    setLoading(true)
    setError(null)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { router.push('/admin/login'); return }
    const [summaryRes, eventsRes] = await Promise.all([
      supabase.rpc('get_event_registry_summary'),
      supabase.rpc('get_event_registry_stream', { p_year: yearFilter ? Number(yearFilter) : null, p_month: monthFilter ? Number(monthFilter) : null, p_event_type: typeFilter || null, p_entity_id: null, p_limit: 180 }),
    ])
    if (summaryRes.error) setError(summaryRes.error.message)
    if (eventsRes.error) setError(eventsRes.error.message)
    const loadedEvents = (eventsRes.data ?? []) as EventRegistryRow[]
    setSummary((summaryRes.data ?? null) as EventRegistrySummary | null)
    setEvents(loadedEvents)
    if (!selectedEventKey || !loadedEvents.some((event) => eventKey(event) === selectedEventKey)) setSelectedEventKey(loadedEvents[0] ? eventKey(loadedEvents[0]) : '')
    setLoading(false)
  }

  useEffect(() => { loadEvents(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [yearFilter, monthFilter, typeFilter])

  const filteredEvents = events.filter((event) => {
    if (workMode === 'historical' && event.load_mode !== 'carga_historica') return false
    if (workMode === 'new' && event.load_mode !== 'evento_nuevo') return false
    if (workMode === 'calendar' && event.load_mode !== 'evento_calendario') return false
    if (workMode === 'pending' && !isEvidencePending(event) && event.workflow_status !== 'pending_review') return false
    if (searchText.trim()) {
      const search = searchText.trim().toLowerCase()
      const haystack = [event.title, event.related_entity_name, event.event_type_name, event.source_name].filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(search)) return false
    }
    return true
  })

  const selectedEvent = filteredEvents.find((event) => eventKey(event) === selectedEventKey) ?? filteredEvents[0] ?? null
  const years = useMemo(() => { const min = summary?.min_year ?? 1500; const max = summary?.max_year ?? new Date().getFullYear(); return Array.from({ length: max - min + 1 }, (_, index) => max - index) }, [summary?.min_year, summary?.max_year])

  if (loading) return <main className="container"><div className="empty-state">Cargando registro de eventos...</div></main>

  return (
    <main className="container dashboard-page events-page">
      <style>{pageStyles}</style>
      <div className="detail-backlink"><Link href="/admin">← Volver al panel administrativo</Link></div>
      <section className="dashboard-hero card events-hero">
        <div><p className="eyebrow">SINEP Core · motor histórico-documental</p><h1>Eventos</h1><p className="lead">Centro para reconstruir la historia inicial y luego alimentar el sistema con eventos nuevos. El evento es la unidad de verdad; la página es una vista derivada.</p><div className="button-row"><Link className="button button-primary" href="/admin/eventos/nuevo">Preparar evento</Link><Link className="button button-secondary" href="/admin/eventos/pendientes">Cola de revisión</Link></div></div>
        <div className="events-summary-card"><span className="mini-badge">Registro navegable</span><strong>{summary?.total_events ?? 0}</strong><span className="meta">eventos y fechas en el índice · {summary?.verified_or_documented ?? 0} documentados/verificados</span></div>
      </section>
      {error && <div className="error-box">{error}</div>}
      <section className="events-metrics"><div className="events-metric"><strong>{summary?.historical_events ?? 0}</strong><span>Carga histórica</span></div><div className="events-metric"><strong>{summary?.new_events ?? 0}</strong><span>Eventos nuevos</span></div><div className="events-metric"><strong>{summary?.calendar_occurrences ?? 0}</strong><span>Fechas derivadas</span></div><div className="events-metric"><strong>{summary?.pending_evidence ?? 0}</strong><span>Evidencia pendiente</span></div></section>
      <section className="card dashboard-section"><div className="events-toolbar"><label>Año<select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}><option value="">Todos los años</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label><label>Mes<select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}><option value="">Todos los meses</option>{monthNames.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></label><label>Tipo de evento<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">Todos los tipos</option>{(summary?.event_types ?? []).map((facet) => <option key={facet.key} value={facet.key}>{facet.name ?? facet.key} · {facet.count}</option>)}</select></label><label>Buscar<input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Diócesis, febrero, fuente..." /></label></div></section>
      <section className="events-tabs">{workModes.map((mode) => <button className={`events-tab ${workMode === mode.key ? 'active' : ''}`} key={mode.key} onClick={() => setWorkMode(mode.key)} type="button"><strong>{mode.title}</strong><span>{mode.description}</span></button>)}</section>
      <section className="events-layout"><div className="card dashboard-section"><div className="section-heading"><div><p className="eyebrow">Línea de eventos</p><h2>{filteredEvents.length} resultados</h2><p className="meta">Selecciona un evento para ver qué páginas alimenta y abrir su flujo operativo cuando aplique.</p></div></div><div className="events-timeline">{filteredEvents.length === 0 && <div className="empty-state">No hay eventos con esos filtros.</div>}{filteredEvents.map((event) => <button className={`event-card-button ${selectedEvent && eventKey(event) === eventKey(selectedEvent) ? 'active' : ''}`} key={eventKey(event)} onClick={() => setSelectedEventKey(eventKey(event))} type="button"><div className="event-card-main"><div className="event-date-box"><strong>{dayValue(event.event_date)}</strong><span>{monthLabel(event.event_month).slice(0, 3)}</span><span>{event.event_year ?? '—'}</span></div><div className="event-info"><h3>{event.title}</h3><p className="meta">{formatDate(event.event_date)} · {event.event_type_name ?? event.event_type_key ?? 'Tipo no definido'}</p><div className="badge-row"><span className="mini-badge">{loadModeLabel(event.load_mode)}</span><span className={`mini-badge ${isEvidencePending(event) ? 'warning' : 'success'}`}>{evidenceLabel(event.evidence_status)}</span>{event.workflow_status === 'pending_review' && <span className="mini-badge warning">Pendiente de revisión</span>}{event.related_entity_name && <span className="mini-badge">{event.related_entity_name}</span>}{event.source_name && <span className="mini-badge">Fuente: {event.source_name}</span>}</div></div></div></button>)}</div></div><aside className="facets-grid"><EventDetailPanel event={selectedEvent} /><div className="facet-card highlight"><strong>Asistentes</strong><div className="action-link-grid"><Link className="button button-primary" href="/admin/eventos/nuevo">Preparar evento</Link><Link className="button button-secondary" href="/admin/eventos/pendientes">Cola de revisión</Link></div></div></aside></section>
    </main>
  )
}
