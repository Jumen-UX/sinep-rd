'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type EntityPath = {
  direct_entity_id: string
  direct_entity_name: string
  direct_entity_slug: string
  direct_entity_type_name: string | null
  hierarchy_path: string | null
}

type OfficeConfig = {
  id: string
  key: string
  display_name: string
  organization_chart_id: string | null
}

type MissingField = { key: string; label: string }

const steps = ['Persona', 'Nacimiento', 'Clero', 'Servicio', 'Cargo', 'Completitud', 'Revisión']
const optionalFields: MissingField[] = [
  { key: 'gender', label: 'Género' },
  { key: 'birth_date', label: 'Fecha de nacimiento' },
  { key: 'birth_place', label: 'Lugar de nacimiento' },
  { key: 'biography_public', label: 'Biografía pública' },
  { key: 'priestly_ordination_date', label: 'Fecha de ordenación sacerdotal' },
  { key: 'incardination_entity_id', label: 'Incardinación' },
  { key: 'current_service_entity_id', label: 'Entidad donde sirve actualmente' },
]

function emptyToNull(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text.length > 0 ? text : null
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildDisplayName(form: FormData) {
  const parts = [
    form.get('first_name'),
    form.get('middle_name'),
    form.get('last_name'),
    form.get('second_last_name'),
  ].map((part) => String(part ?? '').trim()).filter(Boolean)
  return parts.join(' ')
}

export default function NuevoSacerdotePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [step, setStep] = useState(0)
  const [entities, setEntities] = useState<EntityPath[]>([])
  const [officeConfigs, setOfficeConfigs] = useState<OfficeConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [incardinationId, setIncardinationId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [quickEntityId, setQuickEntityId] = useState('')
  const [savedSlug, setSavedSlug] = useState<string | null>(null)

  const incardination = entities.find((item) => item.direct_entity_id === incardinationId)
  const service = entities.find((item) => item.direct_entity_id === serviceId)
  const quickEntity = entities.find((item) => item.direct_entity_id === quickEntityId)

  async function loadData() {
    setError(null)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    const [entityRes, officeRes] = await Promise.all([
      supabase
        .from('public_entity_hierarchy_paths')
        .select('direct_entity_id,direct_entity_name,direct_entity_slug,direct_entity_type_name,hierarchy_path')
        .order('direct_entity_name'),
      supabase
        .from('office_configurations')
        .select('id,key,display_name,organization_chart_id')
        .eq('status', 'active')
        .order('display_name'),
    ])

    if (entityRes.error || officeRes.error) {
      setError(entityRes.error?.message ?? officeRes.error?.message ?? 'No se pudieron cargar los catálogos.')
    } else {
      setEntities((entityRes.data ?? []) as EntityPath[])
      setOfficeConfigs((officeRes.data ?? []) as OfficeConfig[])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    setSavedSlug(null)

    const form = new FormData(event.currentTarget)
    const firstName = String(form.get('first_name') ?? '').trim()
    const lastName = String(form.get('last_name') ?? '').trim()
    const displayName = String(form.get('display_name') ?? '').trim() || buildDisplayName(form)
    const slugInput = String(form.get('slug') ?? '').trim()

    if (!firstName || !lastName || !displayName) {
      setError('Nombre, apellido y nombre público son obligatorios.')
      setSaving(false)
      return
    }

    const quickOfficeId = emptyToNull(form.get('quick_office_configuration_id'))
    const payload = {
      first_name: firstName,
      middle_name: emptyToNull(form.get('middle_name')),
      last_name: lastName,
      second_last_name: emptyToNull(form.get('second_last_name')),
      display_name: displayName,
      slug: slugInput || slugify(displayName),
      gender: emptyToNull(form.get('gender')),
      birth_date: emptyToNull(form.get('birth_date')),
      birth_place: emptyToNull(form.get('birth_place')),
      biography_public: emptyToNull(form.get('biography_public')),
      notes_internal: emptyToNull(form.get('notes_internal')),
      incardination_entity_id: emptyToNull(form.get('incardination_entity_id')),
      current_service_entity_id: emptyToNull(form.get('current_service_entity_id')),
      diaconal_ordination_date: emptyToNull(form.get('diaconal_ordination_date')),
      priestly_ordination_date: emptyToNull(form.get('priestly_ordination_date')),
      religious_order: emptyToNull(form.get('religious_order')),
      canonical_status: emptyToNull(form.get('canonical_status')),
      clergy_notes: emptyToNull(form.get('clergy_notes')),
      quick_office_configuration_id: quickOfficeId,
      quick_title_override: emptyToNull(form.get('quick_title_override')),
      quick_entity_id: emptyToNull(form.get('quick_entity_id')),
      quick_start_date: emptyToNull(form.get('quick_start_date')),
      quick_notes_public: emptyToNull(form.get('quick_notes_public')),
      not_identified_fields: form.getAll('not_identified_fields').map(String),
    }

    try {
      const response = await fetch('/api/admin/sacerdote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudo guardar el sacerdote.')
      }

      setSavedSlug(data.slug ?? payload.slug)
      setMessage(quickOfficeId ? 'Sacerdote creado correctamente con su cargo actual.' : 'Sacerdote creado correctamente.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el sacerdote.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className="container"><div className="empty-state">Cargando asistente...</div></main>

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink"><Link href="/admin/nuevo">← Volver a agregar nueva ficha</Link></div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Asistente paso a paso</p>
          <h1>Nuevo sacerdote</h1>
          <p className="lead">Registra la persona, su perfil clerical, ordenación, incardinación y, si ya se conoce, su cargo actual. El guardado es transaccional para evitar fichas parciales.</p>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="empty-state">{message} {savedSlug && <Link href={`/personas/${savedSlug}`}>Ver ficha pública</Link>}</div>}

      <div className="dashboard-grid dashboard-summary">
        {steps.map((label, index) => (
          <button key={label} className={`metric-card metric-button ${step === index ? 'active-filter' : ''}`} type="button" onClick={() => setStep(index)}>
            <strong>{index + 1}</strong><span>{label}</span>
          </button>
        ))}
      </div>

      <form className="admin-form admin-config-form card dashboard-section" onSubmit={handleSubmit}>
        {step === 0 && (
          <section>
            <p className="eyebrow">Paso 1</p>
            <h2>Datos personales</h2>
            <input name="first_name" placeholder="Primer nombre" required />
            <input name="middle_name" placeholder="Segundo nombre" />
            <input name="last_name" placeholder="Primer apellido" required />
            <input name="second_last_name" placeholder="Segundo apellido" />
            <input name="display_name" placeholder="Nombre público. Si se deja vacío, se genera automáticamente" />
            <input name="slug" placeholder="Slug opcional" />
          </section>
        )}

        {step === 1 && (
          <section>
            <p className="eyebrow">Paso 2</p>
            <h2>Nacimiento y biografía</h2>
            <select name="gender" defaultValue="male">
              <option value="male">Masculino</option>
              <option value="female">Femenino</option>
              <option value="unknown">No identificado</option>
            </select>
            <label>Fecha de nacimiento<input name="birth_date" type="date" /></label>
            <input name="birth_place" placeholder="Lugar de nacimiento" />
            <textarea name="biography_public" placeholder="Biografía pública breve" />
          </section>
        )}

        {step === 2 && (
          <section>
            <p className="eyebrow">Paso 3</p>
            <h2>Perfil clerical</h2>
            <label>Ordenación diaconal<input name="diaconal_ordination_date" type="date" /></label>
            <label>Ordenación sacerdotal<input name="priestly_ordination_date" type="date" /></label>
            <input name="religious_order" placeholder="Orden o congregación, si aplica" />
            <select name="canonical_status" defaultValue="active">
              <option value="active">Activo</option>
              <option value="retired">Retirado</option>
              <option value="suspended">Suspendido</option>
              <option value="deceased">Fallecido</option>
              <option value="unknown">No identificado</option>
            </select>
            <textarea name="clergy_notes" placeholder="Notas privadas del perfil clerical" />
          </section>
        )}

        {step === 3 && (
          <section>
            <p className="eyebrow">Paso 4</p>
            <h2>Incardinación y servicio actual</h2>
            <select name="incardination_entity_id" value={incardinationId} onChange={(event) => setIncardinationId(event.target.value)}>
              <option value="">Sin incardinación por ahora</option>
              {entities.map((entity) => <option key={entity.direct_entity_id} value={entity.direct_entity_id}>{entity.direct_entity_name} · {entity.direct_entity_type_name ?? 'Entidad'}</option>)}
            </select>
            <div className="empty-state"><strong>Incardinación</strong><span>{incardination?.hierarchy_path ?? incardination?.direct_entity_name ?? 'Selecciona la diócesis, jurisdicción o entidad si aplica.'}</span></div>
            <select name="current_service_entity_id" value={serviceId} onChange={(event) => { setServiceId(event.target.value); setQuickEntityId(event.target.value) }}>
              <option value="">Sin servicio actual por ahora</option>
              {entities.map((entity) => <option key={entity.direct_entity_id} value={entity.direct_entity_id}>{entity.direct_entity_name} · {entity.direct_entity_type_name ?? 'Entidad'}</option>)}
            </select>
            <div className="empty-state"><strong>Servicio actual</strong><span>{service?.hierarchy_path ?? service?.direct_entity_name ?? 'Selecciona parroquia, capilla, curia o entidad donde sirve.'}</span></div>
          </section>
        )}

        {step === 4 && (
          <section>
            <p className="eyebrow">Paso 5</p>
            <h2>Asignación rápida de cargo actual</h2>
            <p className="meta">Opcional. Si todavía no tienes cargos configurados, deja este paso vacío y usa luego Catálogo de cargos y Asignaciones de cargos.</p>
            <select name="quick_office_configuration_id" defaultValue="">
              <option value="">Sin cargo actual por ahora</option>
              {officeConfigs.map((office) => <option key={office.id} value={office.id}>{office.display_name}</option>)}
            </select>
            <input name="quick_title_override" placeholder="Título público opcional: Párroco, Vicario parroquial, Encargado" />
            <select name="quick_entity_id" value={quickEntityId} onChange={(event) => setQuickEntityId(event.target.value)}>
              <option value="">Usar entidad del servicio actual o dejar sin entidad</option>
              {entities.map((entity) => <option key={entity.direct_entity_id} value={entity.direct_entity_id}>{entity.direct_entity_name} · {entity.direct_entity_type_name ?? 'Entidad'}</option>)}
            </select>
            <div className="empty-state"><strong>Entidad del cargo</strong><span>{quickEntity?.hierarchy_path ?? quickEntity?.direct_entity_name ?? service?.hierarchy_path ?? service?.direct_entity_name ?? 'Selecciona la parroquia, capilla, curia o entidad del cargo.'}</span></div>
            <label>Fecha de inicio del cargo<input name="quick_start_date" type="date" /></label>
            <textarea name="quick_notes_public" placeholder="Notas públicas del cargo" />
          </section>
        )}

        {step === 5 && (
          <section>
            <p className="eyebrow">Paso 6</p>
            <h2>Datos faltantes</h2>
            <p className="meta">Marca datos que fueron buscados y no se pudieron identificar. No generarán alertas de completitud.</p>
            <div className="card compact-section">
              {optionalFields.map((field) => (
                <label key={field.key} className="role-pill">
                  <input type="checkbox" name="not_identified_fields" value={field.key} /> {field.label}
                </label>
              ))}
            </div>
            <textarea name="notes_internal" placeholder="Notas internas de carga o verificación" />
          </section>
        )}

        {step === 6 && (
          <section>
            <p className="eyebrow">Paso 7</p>
            <h2>Revisión y guardado</h2>
            <p className="lead">Guarda el sacerdote. Si elegiste un cargo actual, se creará también su asignación pública.</p>
          </section>
        )}

        <div className="admin-form-grid">
          <button className="button button-secondary" type="button" onClick={() => setStep(Math.max(0, step - 1))}>Anterior</button>
          {step < steps.length - 1 ? (
            <button className="button button-secondary" type="button" onClick={() => setStep(Math.min(steps.length - 1, step + 1))}>Siguiente</button>
          ) : (
            <button className="button button-primary" disabled={saving}>{saving ? 'Guardando...' : 'Crear sacerdote'}</button>
          )}
        </div>
      </form>
    </main>
  )
}
