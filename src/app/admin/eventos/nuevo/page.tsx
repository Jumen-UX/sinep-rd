'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>
type LoadMode = 'carga_historica' | 'evento_nuevo' | 'foto_inicial'
type AssistantStep = 'modo' | 'hecho' | 'afectados' | 'fuente' | 'impacto'

type EventTypeOption = {
  key: string
  name: string
  description: string | null
  applies_to: string
}

type EntityOption = {
  id: string
  name: string
  official_name: string | null
  entity_types?: {
    key: string
    name: string
  } | null
}

type EvidenceOption = {
  key: string
  name: string
  description: string
}

const loadModes: Array<{ key: LoadMode; title: string; description: string }> = [
  { key: 'carga_historica', title: 'Carga histórica', description: 'Reconstruye un hecho pasado: erección, elevación, desmembramiento, cambio territorial, nombramiento u otro evento histórico.' },
  { key: 'evento_nuevo', title: 'Evento nuevo', description: 'Registra un cambio presente o futuro detectado por documento, boletín, decreto o validación oficial.' },
  { key: 'foto_inicial', title: 'Foto inicial vigente', description: 'Carga el estado actual conocido cuando todavía falta reconstruir el evento originario o documento completo.' },
]

const steps: Array<{ key: AssistantStep; title: string; description: string }> = [
  { key: 'modo', title: 'Modo', description: 'Historia, evento nuevo o foto inicial.' },
  { key: 'hecho', title: 'Hecho', description: 'Fecha, tipo y título.' },
  { key: 'afectados', title: 'Afectados', description: 'Entidad principal y rol.' },
  { key: 'fuente', title: 'Fuente', description: 'Documento y evidencia.' },
  { key: 'impacto', title: 'Impacto', description: 'Revisión antes de guardar.' },
]

const evidenceOptions: EvidenceOption[] = [
  { key: 'confirmado_oficial', name: 'Confirmado oficial', description: 'Tiene documento oficial o fuente primaria validada.' },
  { key: 'fuente_secundaria', name: 'Fuente secundaria', description: 'Sustentado por directorio, página diocesana, base histórica u otra fuente confiable.' },
  { key: 'importado_vigente', name: 'Importado vigente', description: 'Dato de foto inicial del sistema, pendiente de reconstrucción documental completa.' },
  { key: 'pendiente_documento', name: 'Documento pendiente', description: 'Dato conocido, pero falta el documento de respaldo.' },
  { key: 'contradictorio', name: 'Contradictorio', description: 'Existen fuentes que no coinciden y requiere revisión.' },
  { key: 'corregido', name: 'Corregido', description: 'Dato corregido por una fuente posterior o validación editorial.' },
]

const pageStyles = `
  .event-assistant-page select,
  .event-assistant-page input,
  .event-assistant-page textarea {
    border: 1px solid var(--border);
    border-radius: 14px;
    font: inherit;
    padding: 12px 14px;
    width: 100%;
  }

  .event-assistant-page textarea { min-height: 96px; resize: vertical; }

  .assistant-hero { align-items: stretch; grid-template-columns: minmax(0, 1fr) minmax(280px, 0.42fr); }

  .assistant-summary-card,
  .step-card,
  .mode-card,
  .preview-card,
  .impact-card,
  .derived-card {
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 16px;
    display: grid;
    gap: 7px;
    padding: 14px;
  }

  .assistant-summary-card,
  .preview-card.highlight,
  .impact-card.highlight,
  .derived-card.highlight { background: #fbf8f1; }

  .assistant-layout,
  .assistant-stepper,
  .mode-grid,
  .form-grid,
  .preview-grid,
  .impact-grid,
  .derived-list { display: grid; gap: 14px; }

  .assistant-layout { align-items: start; grid-template-columns: minmax(0, 0.72fr) minmax(320px, 0.42fr); }
  .assistant-stepper { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .mode-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .form-grid, .preview-grid, .impact-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .form-grid .full-width, .preview-grid .full-width { grid-column: 1 / -1; }

  .form-grid label {
    color: var(--muted);
    display: grid;
    font-size: 14px;
    font-weight: 800;
    gap: 7px;
  }

  .step-card,
  .mode-card {
    appearance: none;
    cursor: pointer;
    font: inherit;
    text-align: left;
  }

  .step-card.active,
  .mode-card.active {
    border-color: rgba(122, 31, 31, 0.55);
    box-shadow: 0 16px 38px rgba(122, 31, 31, 0.12);
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

  .button-row { align-items: center; display: flex; flex-wrap: wrap; gap: 14px; margin-top: 14px; }
  .detail-backlink { margin-bottom: 8px; }
  .detail-backlink a { color: var(--primary); font-weight: 800; text-decoration: none; }

  @media (max-width: 1080px) {
    .assistant-hero,
    .assistant-layout,
    .assistant-stepper,
    .mode-grid,
    .form-grid,
    .preview-grid,
    .impact-grid { grid-template-columns: 1fr; }
  }
`

function modeLabel(mode: LoadMode) {
  return loadModes.find((item) => item.key === mode)?.title ?? mode
}

function buildTitle(eventTypeName: string, entityName: string) {
  if (!eventTypeName && !entityName) return ''
  if (!eventTypeName) return entityName
  if (!entityName) return eventTypeName
  return `${eventTypeName} de ${entityName}`
}

function nextStep(current: AssistantStep): AssistantStep {
  const index = steps.findIndex((step) => step.key === current)
  return steps[Math.min(index + 1, steps.length - 1)].key
}

function previousStep(current: AssistantStep): AssistantStep {
  const index = steps.findIndex((step) => step.key === current)
  return steps[Math.max(index - 1, 0)].key
}

function derivedPages(title: string, eventDate: string, entityName: string, eventTypeName: string, sourceName: string) {
  const pages = ['Página del evento']
  if (eventDate) {
    const date = new Date(`${eventDate}T00:00:00`)
    const year = date.getFullYear()
    const month = new Intl.DateTimeFormat('es-DO', { month: 'long' }).format(date)
    pages.push(`Página del año ${year}`)
    pages.push(`Página de ${month}`)
    pages.push(`${month} de ${year}`)
  }
  if (entityName) pages.push(`Página de ${entityName}`)
  if (eventTypeName) pages.push(`Categoría: ${eventTypeName}`)
  if (sourceName) pages.push(`Fuente: ${sourceName}`)
  if (title) pages.push('Búsqueda y línea histórica')
  return pages
}

export default function NuevoEventoPage() {
  const router = useRouter()
  const supabase = useMemo<SupabaseClient>(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedEventId, setSavedEventId] = useState<string | null>(null)
  const [step, setStep] = useState<AssistantStep>('modo')
  const [eventTypes, setEventTypes] = useState<EventTypeOption[]>([])
  const [entities, setEntities] = useState<EntityOption[]>([])

  const [loadMode, setLoadMode] = useState<LoadMode>('carga_historica')
  const [eventTypeKey, setEventTypeKey] = useState('erection')
  const [eventDate, setEventDate] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [entityId, setEntityId] = useState('')
  const [entityRole, setEntityRole] = useState('affected_jurisdiction')
  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [evidenceStatus, setEvidenceStatus] = useState('pendiente_documento')
  const [notes, setNotes] = useState('')

  async function loadOptions() {
    setError(null)
    setLoading(true)

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    const [eventTypeRes, entityRes] = await Promise.all([
      supabase.from('canonical_event_types').select('key,name,description,applies_to').eq('is_active', true).order('name'),
      supabase
        .from('ecclesiastical_entities')
        .select('id,name,official_name,entity_types(key,name)')
        .eq('status', 'active')
        .eq('visibility', 'public')
        .order('name')
        .limit(250),
    ])

    if (eventTypeRes.error) setError(eventTypeRes.error.message)
    if (entityRes.error) setError(entityRes.error.message)

    const loadedEventTypes = (eventTypeRes.data ?? []) as EventTypeOption[]
    const loadedEntities = (entityRes.data ?? []) as unknown as EntityOption[]

    setEventTypes(loadedEventTypes)
    setEntities(loadedEntities)
    setEventTypeKey(loadedEventTypes[0]?.key ?? 'erection')
    setEntityId(loadedEntities[0]?.id ?? '')
    setLoading(false)
  }

  async function saveDraft() {
    setError(null)
    setSavedEventId(null)

    if (!isReadyForPreview) {
      setError('Faltan datos mínimos para guardar el evento pendiente.')
      return
    }

    setSaving(true)

    const payload = {
      load_mode: loadMode,
      event_type_key: eventTypeKey,
      event_date: eventDate || null,
      effective_date: effectiveDate || null,
      title: computedTitle,
      description: description || null,
      entity_id: entityId || null,
      entity_role: entityRole,
      source_name: sourceName || null,
      source_url: sourceUrl || null,
      evidence_status: evidenceStatus,
      notes: notes || null,
    }

    const { data, error: saveError } = await supabase.rpc('admin_create_event_draft', { payload })

    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }

    setSavedEventId(String(data))
    setSaving(false)
    router.push('/admin/eventos')
  }

  useEffect(() => {
    loadOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedEventType = eventTypes.find((item) => item.key === eventTypeKey)
  const selectedEntity = entities.find((item) => item.id === entityId)
  const selectedEvidence = evidenceOptions.find((item) => item.key === evidenceStatus)
  const entityName = selectedEntity?.name ?? ''
  const eventTypeName = selectedEventType?.name ?? eventTypeKey
  const computedTitle = title || buildTitle(eventTypeName, entityName)
  const pages = derivedPages(computedTitle, eventDate || effectiveDate, entityName, eventTypeName, sourceName)
  const isReadyForPreview = Boolean(loadMode && eventTypeKey && computedTitle && (eventDate || loadMode === 'foto_inicial') && entityId)

  if (loading) {
    return <main className="container"><div className="empty-state">Cargando asistente de eventos...</div></main>
  }

  return (
    <main className="container dashboard-page event-assistant-page">
      <style>{pageStyles}</style>
      <div className="detail-backlink"><Link href="/admin/eventos">← Volver a eventos</Link></div>

      <section className="dashboard-hero card assistant-hero">
        <div>
          <p className="eyebrow">Asistente de eventos</p>
          <h1>Preparar evento</h1>
          <p className="lead">Crea un evento como pendiente de revisión. No aplica cambios al estado actual hasta que exista aprobación posterior.</p>
        </div>
        <div className="assistant-summary-card">
          <span className="mini-badge">{modeLabel(loadMode)}</span>
          <strong>{isReadyForPreview ? 'Listo para guardar' : 'Borrador visual'}</strong>
          <span className="meta">Se guardará como pendiente de revisión.</span>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {savedEventId && <div className="success-box">Evento pendiente creado: {savedEventId}</div>}

      <section className="assistant-stepper">
        {steps.map((item) => (
          <button className={`step-card ${step === item.key ? 'active' : ''}`} key={item.key} onClick={() => setStep(item.key)} type="button">
            <strong>{item.title}</strong>
            <span className="meta">{item.description}</span>
          </button>
        ))}
      </section>

      <section className="assistant-layout">
        <div className="card dashboard-section">
          {step === 'modo' && (
            <>
              <div className="section-heading"><div><p className="eyebrow">Paso 1</p><h2>Qué estás registrando</h2><p className="meta">La historia pasada, un cambio nuevo y la foto inicial vigente se tratan distinto, pero alimentan el mismo registro histórico-documental.</p></div></div>
              <div className="mode-grid">
                {loadModes.map((mode) => (
                  <button className={`mode-card ${loadMode === mode.key ? 'active' : ''}`} key={mode.key} onClick={() => setLoadMode(mode.key)} type="button">
                    <strong>{mode.title}</strong><span className="meta">{mode.description}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 'hecho' && (
            <>
              <div className="section-heading"><div><p className="eyebrow">Paso 2</p><h2>Datos del hecho</h2><p className="meta">El evento necesita tipo, fecha, título y una descripción suficiente para identificarlo.</p></div></div>
              <div className="form-grid">
                <label>Tipo de evento<select value={eventTypeKey} onChange={(event) => setEventTypeKey(event.target.value)}>{eventTypes.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</select></label>
                <label>Fecha del evento<input value={eventDate} onChange={(event) => setEventDate(event.target.value)} type="date" /></label>
                <label>Fecha efectiva<input value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} type="date" /></label>
                <label>Título<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={buildTitle(eventTypeName, entityName) || 'Ej. Erección de la Diócesis de X'} /></label>
                <label className="full-width">Descripción<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Resumen del hecho, contexto y resultado esperado." /></label>
              </div>
            </>
          )}

          {step === 'afectados' && (
            <>
              <div className="section-heading"><div><p className="eyebrow">Paso 3</p><h2>Entidad afectada</h2><p className="meta">Cada evento debe apuntar a una entidad principal. Luego agregaremos múltiples participantes y territorios.</p></div></div>
              <div className="form-grid">
                <label>Entidad principal<select value={entityId} onChange={(event) => setEntityId(event.target.value)}>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name} · {entity.entity_types?.name ?? 'Entidad'}</option>)}</select></label>
                <label>Rol en el evento<select value={entityRole} onChange={(event) => setEntityRole(event.target.value)}><option value="affected_jurisdiction">Jurisdicción afectada</option><option value="created_entity">Entidad creada</option><option value="mother_jurisdiction">Jurisdicción madre</option><option value="metropolitan_see">Sede metropolitana</option><option value="suffragan_jurisdiction">Sufragánea</option><option value="authority">Autoridad</option><option value="ordinary">Ordinario</option></select></label>
                <label className="full-width">Notas sobre afectados<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ej. fue desmembrada de..., pasa a ser sufragánea de..., afecta territorio de..." /></label>
              </div>
            </>
          )}

          {step === 'fuente' && (
            <>
              <div className="section-heading"><div><p className="eyebrow">Paso 4</p><h2>Fuente y evidencia</h2><p className="meta">El sistema puede cargar historia incompleta, pero debe decir claramente si está confirmada, importada, secundaria o pendiente.</p></div></div>
              <div className="form-grid">
                <label>Estado de evidencia<select value={evidenceStatus} onChange={(event) => setEvidenceStatus(event.target.value)}>{evidenceOptions.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</select></label>
                <label>Nombre de la fuente<input value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Ej. Boletín Santa Sede, AAS, Catholic-Hierarchy, Directorio..." /></label>
                <label className="full-width">URL / referencia<input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://... o referencia interna" /></label>
              </div>
            </>
          )}

          {step === 'impacto' && (
            <>
              <div className="section-heading"><div><p className="eyebrow">Paso 5</p><h2>Vista previa de impacto</h2><p className="meta">Antes de guardar, el sistema muestra qué páginas alimenta y qué faltaría para aplicar el evento.</p></div></div>
              <div className="impact-grid">
                <div className="impact-card highlight"><strong>Modo</strong><span className="meta">{modeLabel(loadMode)}</span></div>
                <div className="impact-card"><strong>Título generado</strong><span className="meta">{computedTitle || 'Falta título o entidad'}</span></div>
                <div className="impact-card"><strong>Entidad</strong><span className="meta">{entityName || 'Falta entidad'}</span></div>
                <div className="impact-card"><strong>Evidencia</strong><span className="meta">{selectedEvidence?.name ?? evidenceStatus}</span></div>
                <div className="impact-card"><strong>Impacto actual</strong><span className="meta">{loadMode === 'evento_nuevo' ? 'Actualizará estado vigente solo tras aprobación.' : loadMode === 'foto_inicial' ? 'Crea estado vigente importado con evento originario pendiente.' : 'Reconstruye historia y alimenta línea cronológica.'}</span></div>
                <div className="impact-card"><strong>Estado</strong><span className="meta">{isReadyForPreview ? 'Puede guardarse como pendiente.' : 'Faltan datos mínimos.'}</span></div>
              </div>
            </>
          )}

          <div className="button-row">
            <button className="button button-secondary" onClick={() => setStep(previousStep(step))} disabled={step === 'modo'} type="button">Anterior</button>
            <button className="button button-primary" onClick={() => setStep(nextStep(step))} disabled={step === 'impacto'} type="button">Siguiente</button>
            <button className="button button-primary" disabled={!isReadyForPreview || saving} onClick={saveDraft} type="button">{saving ? 'Guardando...' : 'Guardar pendiente'}</button>
          </div>
        </div>

        <aside className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Previsualización</p><h2>{computedTitle || 'Evento sin título'}</h2><p className="meta">Esta ficha se construye con lo seleccionado.</p></div></div>
          <div className="preview-grid">
            <div className="preview-card"><strong>Tipo</strong><span className="meta">{eventTypeName || '—'}</span></div>
            <div className="preview-card"><strong>Fecha</strong><span className="meta">{eventDate || effectiveDate || '—'}</span></div>
            <div className="preview-card"><strong>Entidad</strong><span className="meta">{entityName || '—'}</span></div>
            <div className="preview-card"><strong>Fuente</strong><span className="meta">{sourceName || '—'}</span></div>
            <div className="preview-card full-width"><strong>Evidencia</strong><span className="meta">{selectedEvidence?.description ?? '—'}</span></div>
          </div>
          <div className="derived-card highlight"><strong>Páginas derivadas</strong><span className="meta">Estas vistas se podrán generar desde este evento.</span></div>
          <div className="derived-list">{pages.map((page) => <div className="derived-card" key={page}><span className="meta">{page}</span></div>)}</div>
          <div className="impact-card highlight"><strong>Regla de seguridad</strong><span className="meta">Guardar pendiente no aplica cambios. Solo crea un evento en revisión con participante principal.</span></div>
        </aside>
      </section>
    </main>
  )
}
