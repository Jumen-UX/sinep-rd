'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { VerificationStatus } from '@/features/shared/source-verification'
import {
  createEventDraft,
  eventEvidenceOptions,
  eventLoadModes,
  hasEventAdminSession,
  loadEventDraftOptions,
  type EventEntityOption,
  type EventEvidenceStatus,
  type EventLoadMode,
  type EventTypeOption,
} from '../services/event-draft-admin-service'

type AssistantStep = 'modo' | 'hecho' | 'afectados' | 'fuente' | 'impacto'

const steps: Array<{ key: AssistantStep; title: string; description: string }> = [
  { key: 'modo', title: 'Modo', description: 'Historia, evento nuevo o foto inicial.' },
  { key: 'hecho', title: 'Hecho', description: 'Fecha, tipo y título.' },
  { key: 'afectados', title: 'Afectados', description: 'Entidad principal y rol.' },
  { key: 'fuente', title: 'Fuente', description: 'Documento, evidencia y verificación.' },
  { key: 'impacto', title: 'Impacto', description: 'Revisión antes de guardar.' },
]

const verificationOptions: Array<{ key: VerificationStatus; name: string }> = [
  { key: 'pending_review', name: 'Pendiente de revisión' },
  { key: 'verified', name: 'Verificado' },
  { key: 'rejected', name: 'Rechazado por contradicción' },
  { key: 'unverified', name: 'Sin verificar' },
]

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function modeLabel(mode: EventLoadMode) {
  return eventLoadModes.find((item) => item.key === mode)?.title ?? mode
}

function verificationLabel(status: VerificationStatus) {
  return verificationOptions.find((item) => item.key === status)?.name ?? status
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
    pages.push(`Página del año ${year}`, `Página de ${month}`, `${month} de ${year}`)
  }
  if (entityName) pages.push(`Página de ${entityName}`)
  if (eventTypeName) pages.push(`Categoría: ${eventTypeName}`)
  if (sourceName) pages.push(`Fuente: ${sourceName}`)
  if (title) pages.push('Búsqueda y línea histórica')
  return pages
}

export default function EventDraftPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<AssistantStep>('modo')
  const [eventTypes, setEventTypes] = useState<EventTypeOption[]>([])
  const [entities, setEntities] = useState<EventEntityOption[]>([])
  const [loadMode, setLoadMode] = useState<EventLoadMode>('carga_historica')
  const [eventTypeKey, setEventTypeKey] = useState('erection')
  const [eventDate, setEventDate] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [entityId, setEntityId] = useState('')
  const [entityRole, setEntityRole] = useState('affected_jurisdiction')
  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceCheckedAt, setSourceCheckedAt] = useState('')
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('pending_review')
  const [evidenceStatus, setEvidenceStatus] = useState<EventEvidenceStatus>('pendiente_documento')
  const [notes, setNotes] = useState('')

  const selectedEventType = eventTypes.find((item) => item.key === eventTypeKey)
  const selectedEntity = entities.find((item) => item.id === entityId)
  const selectedEvidence = eventEvidenceOptions.find((item) => item.key === evidenceStatus)
  const entityName = selectedEntity?.name ?? ''
  const eventTypeName = selectedEventType?.name ?? eventTypeKey
  const computedTitle = title || buildTitle(eventTypeName, entityName)
  const resolvedEffectiveDate = effectiveDate || eventDate
  const pages = derivedPages(computedTitle, eventDate || effectiveDate, entityName, eventTypeName, sourceName)
  const verificationReady = verificationStatus !== 'verified' || Boolean(sourceName && sourceCheckedAt)
  const isReadyForPreview = Boolean(
    loadMode
    && eventTypeKey
    && computedTitle
    && (eventDate || loadMode === 'foto_inicial')
    && resolvedEffectiveDate
    && entityId
    && verificationReady,
  )

  async function loadOptions() {
    setError(null)
    setLoading(true)
    try {
      if (!await hasEventAdminSession(supabase)) {
        router.replace('/admin/login')
        return
      }
      const options = await loadEventDraftOptions(supabase)
      setEventTypes(options.eventTypes)
      setEntities(options.entities)
      setEventTypeKey(options.eventTypes[0]?.key ?? 'erection')
      setEntityId(options.entities[0]?.id ?? '')
    } catch (loadError) {
      setError(errorMessage(loadError, 'No se pudieron cargar las opciones del evento.'))
    } finally {
      setLoading(false)
    }
  }

  async function saveDraft() {
    setError(null)
    if (!isReadyForPreview) {
      setError('Faltan datos mínimos o evidencia válida para guardar el evento pendiente.')
      return
    }
    setSaving(true)
    try {
      await createEventDraft(supabase, {
        loadMode,
        eventTypeKey,
        eventDate,
        effectiveDate: resolvedEffectiveDate,
        title: computedTitle,
        description,
        entityId,
        entityRole,
        sourceName,
        sourceUrl,
        sourceCheckedAt,
        verificationStatus,
        evidenceStatus,
        notes,
      })
      router.push('/admin/eventos')
    } catch (saveError) {
      setError(errorMessage(saveError, 'No se pudo guardar el evento pendiente.'))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    void loadOptions()
    // loadOptions uses a stable Supabase client and router.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) return <main className="container"><div className="empty-state">Cargando asistente de eventos...</div></main>

  return (
    <main className="container dashboard-page event-assistant-page">
      <div className="detail-backlink"><Link href="/admin/eventos">← Volver a eventos</Link></div>

      <section className="dashboard-hero card assistant-hero">
        <div>
          <p className="eyebrow">Asistente de eventos</p>
          <h1>Preparar evento</h1>
          <p className="lead">Crea un evento como pendiente de revisión. No aplica cambios al estado actual hasta que exista aprobación posterior.</p>
        </div>
        <div className="assistant-summary-card" aria-live="polite" aria-atomic="true">
          <span className="mini-badge">{modeLabel(loadMode)}</span>
          <strong>{isReadyForPreview ? 'Listo para guardar' : 'Borrador visual'}</strong>
          <span className="meta">Se guardará como pendiente de revisión.</span>
        </div>
      </section>

      {error && <div className="error-box" role="alert" aria-live="assertive">{error}</div>}

      <nav className="assistant-stepper" aria-label="Pasos del asistente">
        {steps.map((item, index) => (
          <button
            aria-current={step === item.key ? 'step' : undefined}
            aria-label={`Ir al paso ${index + 1}: ${item.title}`}
            className={`step-card ${step === item.key ? 'active' : ''}`}
            key={item.key}
            onClick={() => setStep(item.key)}
            type="button"
          >
            <strong>{item.title}</strong><span className="meta">{item.description}</span>
          </button>
        ))}
      </nav>

      <section className="assistant-layout">
        <div className="card dashboard-section">
          {step === 'modo' && (
            <>
              <div className="section-heading"><div><p className="eyebrow">Paso 1</p><h2>Qué estás registrando</h2><p className="meta">La historia pasada, un cambio nuevo y la foto inicial vigente alimentan el mismo registro histórico-documental.</p></div></div>
              <div className="mode-grid">
                {eventLoadModes.map((mode) => (
                  <button
                    aria-pressed={loadMode === mode.key}
                    className={`mode-card ${loadMode === mode.key ? 'active' : ''}`}
                    key={mode.key}
                    onClick={() => setLoadMode(mode.key)}
                    type="button"
                  >
                    <strong>{mode.title}</strong><span className="meta">{mode.description}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 'hecho' && (
            <>
              <div className="section-heading"><div><p className="eyebrow">Paso 2</p><h2>Datos del hecho</h2><p className="meta">El evento necesita tipo, fecha, título y descripción.</p></div></div>
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
              <div className="section-heading"><div><p className="eyebrow">Paso 3</p><h2>Entidad afectada</h2><p className="meta">Cada evento debe apuntar a una entidad principal que define su alcance administrativo.</p></div></div>
              <div className="form-grid">
                <label>Entidad principal<select value={entityId} onChange={(event) => setEntityId(event.target.value)}>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name} · {entity.entity_types?.name ?? 'Entidad'}</option>)}</select></label>
                <label>Rol en el evento<select value={entityRole} onChange={(event) => setEntityRole(event.target.value)}><option value="affected_jurisdiction">Jurisdicción afectada</option><option value="created_entity">Entidad creada</option><option value="mother_jurisdiction">Jurisdicción madre</option><option value="metropolitan_see">Sede metropolitana</option><option value="suffragan_jurisdiction">Sufragánea</option><option value="authority">Autoridad</option><option value="ordinary">Ordinario</option></select></label>
                <label className="full-width">Notas sobre afectados<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ej. fue desmembrada de..., pasa a ser sufragánea de..., afecta territorio de..." /></label>
              </div>
            </>
          )}

          {step === 'fuente' && (
            <>
              <div className="section-heading"><div><p className="eyebrow">Paso 4</p><h2>Fuente y verificación</h2><p className="meta">La evidencia describe el respaldo documental; la verificación indica si ya fue revisado.</p></div></div>
              <div className="form-grid">
                <label>Estado de evidencia<select value={evidenceStatus} onChange={(event) => setEvidenceStatus(event.target.value as EventEvidenceStatus)}>{eventEvidenceOptions.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</select></label>
                <label>Estado de verificación<select value={verificationStatus} onChange={(event) => setVerificationStatus(event.target.value as VerificationStatus)}>{verificationOptions.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</select></label>
                <label>Nombre de la fuente<input value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Ej. Boletín de la Santa Sede, AAS, directorio..." /></label>
                <label>Fecha de revisión<input value={sourceCheckedAt} onChange={(event) => setSourceCheckedAt(event.target.value)} type="date" /></label>
                <label className="full-width">URL de la fuente<input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://..." type="url" /></label>
              </div>
            </>
          )}

          {step === 'impacto' && (
            <>
              <div className="section-heading"><div><p className="eyebrow">Paso 5</p><h2>Vista previa de impacto</h2><p className="meta">Antes de guardar, revisa alcance, procedencia y condiciones pendientes.</p></div></div>
              <div className="impact-grid">
                <div className="impact-card highlight"><strong>Modo</strong><span className="meta">{modeLabel(loadMode)}</span></div>
                <div className="impact-card"><strong>Título generado</strong><span className="meta">{computedTitle || 'Falta título o entidad'}</span></div>
                <div className="impact-card"><strong>Alcance</strong><span className="meta">{entityName || 'Falta entidad'}</span></div>
                <div className="impact-card"><strong>Fecha efectiva</strong><span className="meta">{resolvedEffectiveDate || 'Falta fecha efectiva'}</span></div>
                <div className="impact-card"><strong>Evidencia</strong><span className="meta">{selectedEvidence?.name ?? evidenceStatus}</span></div>
                <div className="impact-card"><strong>Verificación</strong><span className="meta">{verificationLabel(verificationStatus)}</span></div>
                <div className="impact-card"><strong>Impacto actual</strong><span className="meta">Guardar no cambia el estado vigente; crea un evento pendiente para revisión posterior.</span></div>
                <div className="impact-card"><strong>Estado</strong><span className="meta">{isReadyForPreview ? 'Puede guardarse como pendiente.' : 'Faltan datos mínimos o evidencia válida.'}</span></div>
              </div>
            </>
          )}

          <div className="button-row">
            <button className="button button-secondary" onClick={() => setStep(previousStep(step))} disabled={step === 'modo'} type="button">Anterior</button>
            <button className="button button-primary" onClick={() => setStep(nextStep(step))} disabled={step === 'impacto'} type="button">Siguiente</button>
            <button aria-busy={saving} className="button button-primary" disabled={!isReadyForPreview || saving} onClick={saveDraft} type="button">{saving ? 'Guardando...' : 'Guardar pendiente'}</button>
          </div>
        </div>

        <aside className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Previsualización</p><h2>{computedTitle || 'Evento sin título'}</h2><p className="meta">Esta ficha se construye con lo seleccionado.</p></div></div>
          <div className="preview-grid">
            <div className="preview-card"><strong>Tipo</strong><span className="meta">{eventTypeName || '—'}</span></div>
            <div className="preview-card"><strong>Fecha efectiva</strong><span className="meta">{resolvedEffectiveDate || '—'}</span></div>
            <div className="preview-card"><strong>Entidad</strong><span className="meta">{entityName || '—'}</span></div>
            <div className="preview-card"><strong>Fuente</strong><span className="meta">{sourceName || '—'}</span></div>
            <div className="preview-card"><strong>Verificación</strong><span className="meta">{verificationLabel(verificationStatus)}</span></div>
            <div className="preview-card"><strong>Revisada</strong><span className="meta">{sourceCheckedAt || '—'}</span></div>
            <div className="preview-card full-width"><strong>Evidencia</strong><span className="meta">{selectedEvidence?.description ?? '—'}</span></div>
          </div>
          <div className="derived-card highlight"><strong>Páginas derivadas</strong><span className="meta">Estas vistas se podrán generar desde este evento.</span></div>
          <div className="derived-list">{pages.map((page) => <div className="derived-card" key={page}><span className="meta">{page}</span></div>)}</div>
          <div className="impact-card highlight"><strong>Regla de seguridad</strong><span className="meta">Guardar pendiente no aplica cambios. Solo crea un evento en revisión con participante principal y evidencia normalizada.</span></div>
        </aside>
      </section>
    </main>
  )
}
