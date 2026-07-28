'use client'

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useAdminNavigation } from '@/features/admin/navigation/AdminNavigationProvider'
import { createClient } from '@/lib/supabase/client'
import {
  generateCalendarOccurrences,
  loadAdminCalendarEvents,
  loadCalendarEventTypes,
  loadCalendarScopeOptions,
  loadEventReminders,
  loadEventVisibilitySettings,
  saveEventReminder,
  saveEventVisibilitySetting,
  type AdminCalendarEventRow,
  type CalendarEventTypeOption,
  type CalendarScopeOption,
  type EventReminderRow,
  type EventVisibilitySettingRow,
  type SaveEventReminderInput,
  type SaveVisibilitySettingInput,
} from '../services/calendar-admin-service'

const monthNames = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

const diocesanScopeTypes = new Set([
  'archdiocese',
  'diocese',
  'apostolic_vicariate',
  'military_ordinariate',
])

const channels: Array<{ key: SaveEventReminderInput['channel']; label: string }> = [
  { key: 'internal', label: 'Aviso interno' },
  { key: 'email', label: 'Correo electrónico' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'ical', label: 'Calendario iCal' },
  { key: 'other', label: 'Otro canal' },
]

const visibilityOptions: Array<{
  key: SaveVisibilitySettingInput['defaultVisibility']
  label: string
}> = [
  { key: 'public', label: 'Pública' },
  { key: 'internal', label: 'Interna' },
  { key: 'private', label: 'Privada' },
  { key: 'confidential', label: 'Confidencial' },
]

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(
    new Date(`${value}T00:00:00`),
  )
}

function dateRange(year: number, month: number | null) {
  if (month) {
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    return {
      from,
      to: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    }
  }

  return { from: `${year}-01-01`, to: `${year}-12-31` }
}

function visibilityLabel(value: string) {
  if (value === 'public') return 'Pública'
  if (value === 'internal') return 'Interna'
  if (value === 'private') return 'Privada'
  if (value === 'confidential') return 'Confidencial'
  return value
}

function sourceLabel(value: AdminCalendarEventRow['source_kind']) {
  return value === 'commemorative' ? 'Conmemoración manual' : 'Fecha derivada'
}

function relatedLabel(event: AdminCalendarEventRow) {
  return event.related_person_name
    ?? event.related_entity_name
    ?? event.related_organization_unit_name
    ?? 'Ámbito territorial'
}

export default function CalendarWorkspace() {
  const supabase = useMemo(() => createClient(), [])
  const { context, loading: navigationLoading } = useAdminNavigation()
  const currentYear = new Date().getFullYear()
  const [scopeOptions, setScopeOptions] = useState<CalendarScopeOption[]>([])
  const [eventTypes, setEventTypes] = useState<CalendarEventTypeOption[]>([])
  const [selectedScopeId, setSelectedScopeId] = useState('')
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState<number | null>(null)
  const [eventTypeKey, setEventTypeKey] = useState('')
  const [includeNonPublic, setIncludeNonPublic] = useState(true)
  const [events, setEvents] = useState<AdminCalendarEventRow[]>([])
  const [reminders, setReminders] = useState<EventReminderRow[]>([])
  const [visibilitySettings, setVisibilitySettings] = useState<EventVisibilitySettingRow[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [loadingWorkspace, setLoadingWorkspace] = useState(false)
  const [workingAction, setWorkingAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reminderTypeKey, setReminderTypeKey] = useState('')
  const [reminderDays, setReminderDays] = useState(7)
  const [reminderChannel, setReminderChannel] = useState<SaveEventReminderInput['channel']>('internal')
  const [visibilityTypeKey, setVisibilityTypeKey] = useState('')
  const [defaultVisibility, setDefaultVisibility] = useState<SaveVisibilitySettingInput['defaultVisibility']>('internal')
  const [canBePublic, setCanBePublic] = useState(true)
  const [requiresApproval, setRequiresApproval] = useState(true)

  const permissionKeys = useMemo(
    () => new Set(context?.permissionKeys ?? []),
    [context?.permissionKeys],
  )
  const canGenerate = permissionKeys.has('events.apply')
  const canManageReminders = permissionKeys.has('events.manage_reminders')
  const canManageVisibility = permissionKeys.has('events.manage_visibility')
  const selectedScope = scopeOptions.find((option) => option.scope_entity_id === selectedScopeId) ?? null
  const selectedScopeSupportsVisibility = Boolean(
    selectedScope && diocesanScopeTypes.has(selectedScope.entity_type_key),
  )

  const years = useMemo(
    () => Array.from({ length: 11 }, (_, index) => currentYear + 5 - index),
    [currentYear],
  )

  const loadCatalog = useCallback(async () => {
    if (!context || context.accessState !== 'ready') {
      setLoadingCatalog(false)
      return
    }

    setLoadingCatalog(true)
    setError(null)

    try {
      const rootEntityId = ['national', 'diocese', 'parish', 'entity'].includes(context.activeScope.type)
        ? context.activeScope.entityId
        : null
      const [scopes, types] = await Promise.all([
        loadCalendarScopeOptions(supabase, rootEntityId),
        loadCalendarEventTypes(supabase),
      ])

      setScopeOptions(scopes)
      setEventTypes(types)
      setSelectedScopeId((current) => {
        if (current && scopes.some((scope) => scope.scope_entity_id === current)) return current
        if (
          context.activeScope.entityId
          && scopes.some((scope) => scope.scope_entity_id === context.activeScope.entityId)
        ) {
          return context.activeScope.entityId
        }
        return scopes[0]?.scope_entity_id ?? ''
      })
      setReminderTypeKey((current) => current || types[0]?.key || '')
      setVisibilityTypeKey((current) => current || types[0]?.key || '')
    } catch (loadError) {
      setScopeOptions([])
      setEventTypes([])
      setSelectedScopeId('')
      setError(errorMessage(loadError, 'No se pudo preparar el espacio de calendario.'))
    } finally {
      setLoadingCatalog(false)
    }
  }, [context, supabase])

  const refreshWorkspace = useCallback(async () => {
    if (!selectedScopeId) {
      setEvents([])
      setReminders([])
      setVisibilitySettings([])
      return
    }

    setLoadingWorkspace(true)
    setError(null)

    try {
      const range = dateRange(year, month)
      const [calendarRows, reminderRows, visibilityRows] = await Promise.all([
        loadAdminCalendarEvents(supabase, {
          ...range,
          scopeEntityId: selectedScopeId,
          eventTypeKey: eventTypeKey || null,
          includeNonPublic,
          limit: 1000,
        }),
        loadEventReminders(supabase, selectedScopeId, true),
        loadEventVisibilitySettings(supabase, selectedScopeId),
      ])

      setEvents(calendarRows)
      setReminders(reminderRows)
      setVisibilitySettings(visibilityRows)
    } catch (loadError) {
      setEvents([])
      setReminders([])
      setVisibilitySettings([])
      setError(errorMessage(loadError, 'No se pudo cargar el calendario del ámbito seleccionado.'))
    } finally {
      setLoadingWorkspace(false)
    }
  }, [eventTypeKey, includeNonPublic, month, selectedScopeId, supabase, year])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  useEffect(() => {
    void refreshWorkspace()
  }, [refreshWorkspace])

  async function handleGenerate() {
    if (!selectedScopeId || !canGenerate) return

    setWorkingAction('generate')
    setError(null)
    setNotice(null)

    try {
      const result = await generateCalendarOccurrences(supabase, year, selectedScopeId)
      setNotice(
        `${result.affected_occurrences} fechas creadas o actualizadas para ${year} en ${selectedScope?.label ?? 'el ámbito seleccionado'}.`,
      )
      await refreshWorkspace()
    } catch (actionError) {
      setError(errorMessage(actionError, 'No se pudieron generar las fechas.'))
    } finally {
      setWorkingAction(null)
    }
  }

  async function handleReminderSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedScopeId || !reminderTypeKey || !canManageReminders) return

    setWorkingAction('reminder')
    setError(null)
    setNotice(null)

    try {
      await saveEventReminder(supabase, {
        scopeEntityId: selectedScopeId,
        eventTypeKey: reminderTypeKey,
        daysBefore: reminderDays,
        channel: reminderChannel,
        isActive: true,
      })
      setNotice('Recordatorio guardado dentro del ámbito seleccionado.')
      await refreshWorkspace()
    } catch (actionError) {
      setError(errorMessage(actionError, 'No se pudo guardar el recordatorio.'))
    } finally {
      setWorkingAction(null)
    }
  }

  async function handleVisibilitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      !selectedScopeId
      || !visibilityTypeKey
      || !canManageVisibility
      || !selectedScopeSupportsVisibility
    ) return

    setWorkingAction('visibility')
    setError(null)
    setNotice(null)

    try {
      await saveEventVisibilitySetting(supabase, {
        dioceseId: selectedScopeId,
        eventTypeKey: visibilityTypeKey,
        defaultVisibility,
        canBePublic,
        requiresApproval,
      })
      setNotice('Regla de visibilidad guardada para la diócesis seleccionada.')
      await refreshWorkspace()
    } catch (actionError) {
      setError(errorMessage(actionError, 'No se pudo guardar la regla de visibilidad.'))
    } finally {
      setWorkingAction(null)
    }
  }

  if (navigationLoading || loadingCatalog) {
    return <div className="empty-state" role="status" aria-live="polite">Preparando calendario territorial...</div>
  }

  if (!context || context.accessState !== 'ready') {
    return <div className="empty-state" role="status">El calendario requiere un acceso administrativo activo.</div>
  }

  if (scopeOptions.length === 0) {
    return (
      <div className="empty-state" role="status">
        No hay entidades autorizadas disponibles para consultar el calendario.
      </div>
    )
  }

  return (
    <section aria-labelledby="calendar-workspace-title">
      {error && <div className="error-box" role="alert" aria-live="assertive">{error}</div>}
      {notice && <div className="success-box" role="status" aria-live="polite">{notice}</div>}

      <section className="card dashboard-section" id="calendar-controls">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Calendario contextual</p>
            <h2 id="calendar-workspace-title">Fechas, aniversarios y recordatorios</h2>
            <p className="meta">
              La consulta y las acciones se limitan a la entidad seleccionada y sus descendientes autorizados.
            </p>
          </div>
        </div>

        <div className="events-toolbar">
          <label>
            Ámbito
            <select value={selectedScopeId} onChange={(event) => setSelectedScopeId(event.target.value)}>
              {scopeOptions.map((option) => (
                <option key={option.scope_entity_id} value={option.scope_entity_id}>
                  {option.label} · {option.entity_type_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Año
            <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
              {years.map((optionYear) => <option key={optionYear} value={optionYear}>{optionYear}</option>)}
            </select>
          </label>
          <label>
            Mes
            <select
              value={month ?? ''}
              onChange={(event) => setMonth(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">Todo el año</option>
              {monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
            </select>
          </label>
          <label>
            Tipo de evento
            <select value={eventTypeKey} onChange={(event) => setEventTypeKey(event.target.value)}>
              <option value="">Todos los tipos</option>
              {eventTypes.map((type) => <option key={type.id} value={type.key}>{type.name}</option>)}
            </select>
          </label>
        </div>

        <div className="button-row">
          <label>
            Información incluida
            <select
              value={includeNonPublic ? 'all' : 'public'}
              onChange={(event) => setIncludeNonPublic(event.target.value === 'all')}
            >
              <option value="all">Pública e interna autorizada</option>
              <option value="public">Solo pública</option>
            </select>
          </label>
          {canGenerate && (
            <button
              className="button button-primary"
              disabled={workingAction !== null}
              onClick={() => void handleGenerate()}
              type="button"
            >
              {workingAction === 'generate' ? 'Generando...' : `Generar fechas de ${year}`}
            </button>
          )}
        </div>
      </section>

      <section className="events-layout" id="calendar-results">
        <div className="card dashboard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Agenda territorial</p>
              <h2 aria-live="polite">{events.length} fechas visibles</h2>
              <p className="meta">
                {selectedScope?.label ?? 'Ámbito seleccionado'} · {selectedScope?.country_iso2 ?? '—'}
              </p>
            </div>
          </div>

          {loadingWorkspace ? (
            <div className="empty-state" role="status" aria-live="polite">Cargando fechas...</div>
          ) : (
            <div className="events-timeline">
              {events.length === 0 && (
                <div className="empty-state" role="status">
                  No hay fechas para este período. Genera las ocurrencias o cambia los filtros.
                </div>
              )}
              {events.map((calendarEvent) => {
                const date = new Date(`${calendarEvent.event_date}T00:00:00`)
                return (
                  <article className="event-card-button" key={`${calendarEvent.source_kind}:${calendarEvent.event_id}`}>
                    <div className="event-card-main">
                      <div className="event-date-box" aria-hidden="true">
                        <strong>{String(date.getDate()).padStart(2, '0')}</strong>
                        <span>{monthNames[date.getMonth()].slice(0, 3)}</span>
                        <span>{date.getFullYear()}</span>
                      </div>
                      <div className="event-info">
                        <h3>{calendarEvent.title}</h3>
                        <p className="meta">
                          {formatDate(calendarEvent.event_date)} · {calendarEvent.event_type_name}
                        </p>
                        <div className="badge-row">
                          <span className="mini-badge">{sourceLabel(calendarEvent.source_kind)}</span>
                          <span className="mini-badge">{relatedLabel(calendarEvent)}</span>
                          <span className="mini-badge">{visibilityLabel(calendarEvent.visibility)}</span>
                          {calendarEvent.is_jubilee && (
                            <span className="mini-badge success">{calendarEvent.jubilee_name ?? 'Jubileo'}</span>
                          )}
                          {calendarEvent.years_count !== null && (
                            <span className="mini-badge">{calendarEvent.years_count} años</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>

        <aside className="facets-grid" aria-label="Herramientas del calendario">
          <div className="facet-card highlight">
            <strong>Ámbito activo</strong>
            <span className="meta">{selectedScope?.label}</span>
            <span className="meta">{selectedScope?.entity_type_name} · {selectedScope?.country_iso2}</span>
          </div>

          <div className="facet-card">
            <strong>Recordatorios</strong>
            <span className="meta">{reminders.length} configurados en este ámbito y sus descendientes.</span>
            {canManageReminders ? (
              <form className="form-grid" onSubmit={handleReminderSubmit}>
                <label className="full-width">
                  Tipo de evento
                  <select value={reminderTypeKey} onChange={(event) => setReminderTypeKey(event.target.value)} required>
                    {eventTypes.map((type) => <option key={type.id} value={type.key}>{type.name}</option>)}
                  </select>
                </label>
                <label>
                  Días antes
                  <input
                    max={365}
                    min={0}
                    onChange={(event) => setReminderDays(Number(event.target.value))}
                    type="number"
                    value={reminderDays}
                  />
                </label>
                <label>
                  Canal
                  <select
                    value={reminderChannel}
                    onChange={(event) => setReminderChannel(event.target.value as SaveEventReminderInput['channel'])}
                  >
                    {channels.map((channel) => <option key={channel.key} value={channel.key}>{channel.label}</option>)}
                  </select>
                </label>
                <button
                  className="button button-primary full-width"
                  disabled={workingAction !== null || !reminderTypeKey}
                  type="submit"
                >
                  {workingAction === 'reminder' ? 'Guardando...' : 'Crear recordatorio'}
                </button>
              </form>
            ) : (
              <span className="meta">Tu acceso permite consultar, pero no configurar recordatorios.</span>
            )}
            <div className="derived-list">
              {reminders.slice(0, 5).map((reminder) => (
                <div className="derived-card" key={reminder.id}>
                  <strong>{reminder.event_type_name}</strong>
                  <span className="meta">
                    {reminder.days_before} días antes · {channels.find((channel) => channel.key === reminder.channel)?.label ?? reminder.channel}
                  </span>
                  <span className="meta">{reminder.scope_entity_name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="facet-card">
            <strong>Visibilidad por diócesis</strong>
            <span className="meta">{visibilitySettings.length} reglas visibles en el ámbito seleccionado.</span>
            {canManageVisibility && selectedScopeSupportsVisibility ? (
              <form className="form-grid" onSubmit={handleVisibilitySubmit}>
                <label className="full-width">
                  Tipo de evento
                  <select value={visibilityTypeKey} onChange={(event) => setVisibilityTypeKey(event.target.value)} required>
                    {eventTypes.map((type) => <option key={type.id} value={type.key}>{type.name}</option>)}
                  </select>
                </label>
                <label>
                  Visibilidad inicial
                  <select
                    value={defaultVisibility}
                    onChange={(event) => setDefaultVisibility(event.target.value as SaveVisibilitySettingInput['defaultVisibility'])}
                  >
                    {visibilityOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                  </select>
                </label>
                <label>
                  Puede publicarse
                  <select value={canBePublic ? 'yes' : 'no'} onChange={(event) => setCanBePublic(event.target.value === 'yes')}>
                    <option value="yes">Sí</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label className="full-width">
                  Requiere aprobación
                  <select value={requiresApproval ? 'yes' : 'no'} onChange={(event) => setRequiresApproval(event.target.value === 'yes')}>
                    <option value="yes">Sí</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <button
                  className="button button-primary full-width"
                  disabled={workingAction !== null || !visibilityTypeKey}
                  type="submit"
                >
                  {workingAction === 'visibility' ? 'Guardando...' : 'Guardar regla'}
                </button>
              </form>
            ) : (
              <span className="meta">
                {canManageVisibility
                  ? 'Selecciona una diócesis, arquidiócesis o vicariato apostólico para editar sus reglas.'
                  : 'Tu acceso permite consultar, pero no editar reglas de visibilidad.'}
              </span>
            )}
            <div className="derived-list">
              {visibilitySettings.slice(0, 5).map((setting) => (
                <div className="derived-card" key={setting.id}>
                  <strong>{setting.event_type_name}</strong>
                  <span className="meta">
                    {setting.diocese_name} · {visibilityLabel(setting.default_visibility)}
                  </span>
                  <span className="meta">
                    {setting.can_be_public ? 'Puede publicarse' : 'Solo uso interno'} · {setting.requires_approval ? 'Requiere aprobación' : 'Sin aprobación adicional'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </section>
  )
}
