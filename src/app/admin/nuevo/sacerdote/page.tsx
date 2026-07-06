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
type DraftValue = string | string[]
type DraftValues = Record<string, DraftValue>

type PriestPayload = {
  first_name: string
  middle_name: string | null
  last_name: string
  second_last_name: string | null
  display_name: string
  slug: string
  gender: string | null
  birth_date: string | null
  birth_place: string | null
  photo_url?: string | null
  photo_path?: string | null
  biography_public: string | null
  notes_internal: string | null
  validation_type: string | null
  validation_value: string | null
  validation_country: string | null
  incardination_entity_id: string | null
  current_service_entity_id: string | null
  diaconal_ordination_date: string | null
  priestly_ordination_date: string | null
  religious_order: string | null
  canonical_status: string | null
  clergy_notes: string | null
  quick_office_configuration_id: string | null
  quick_title_override: string | null
  quick_entity_id: string | null
  quick_start_date: string | null
  quick_notes_public: string | null
  not_identified_fields: string[]
}

const DRAFT_KEY = 'sinep:nuevo-sacerdote:draft'
const PHOTO_BUCKET = 'person-photos'
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

function buildDisplayNameFromParts(parts: Array<FormDataEntryValue | string | null | undefined>) {
  return parts.map((part) => String(part ?? '').trim()).filter(Boolean).join(' ')
}

function buildDisplayName(form: FormData) {
  return buildDisplayNameFromParts([
    form.get('first_name'),
    form.get('middle_name'),
    form.get('last_name'),
    form.get('second_last_name'),
  ])
}

function fileExtension(file: File) {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

export default function NuevoSacerdotePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [step, setStep] = useState(0)
  const [entities, setEntities] = useState<EntityPath[]>([])
  const [officeConfigs, setOfficeConfigs] = useState<OfficeConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [incardinationId, setIncardinationId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [quickEntityId, setQuickEntityId] = useState('')
  const [savedSlug, setSavedSlug] = useState<string | null>(null)
  const [draftValues, setDraftValues] = useState<DraftValues>({})

  const incardination = entities.find((item) => item.direct_entity_id === incardinationId)
  const service = entities.find((item) => item.direct_entity_id === serviceId)
  const quickEntity = entities.find((item) => item.direct_entity_id === quickEntityId)
  const notIdentifiedFields = Array.isArray(draftValues.not_identified_fields) ? draftValues.not_identified_fields : []
  const namePreview = buildDisplayNameFromParts([
    fieldValue('first_name'),
    fieldValue('middle_name'),
    fieldValue('last_name'),
    fieldValue('second_last_name'),
  ])

  function fieldValue(name: string, fallback = '') {
    const value = draftValues[name]
    return typeof value === 'string' ? value : fallback
  }

  function saveDraft(next: DraftValues) {
    setDraftValues(next)
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(next))
  }

  function setDraftField(name: string, value: DraftValue) {
    setDraftValues((previous) => {
      const next = { ...previous, [name]: value }
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(next))
      return next
    })
  }

  function handleDraftChange(event: FormEvent<HTMLFormElement>) {
    const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    if (!target.name) return

    if (target instanceof HTMLInputElement && target.type === 'file') return

    setDraftValues((previous) => {
      const next: DraftValues = { ...previous }

      if (target instanceof HTMLInputElement && target.type === 'checkbox') {
        if (target.name === 'not_identified_fields') {
          const current = Array.isArray(previous.not_identified_fields) ? previous.not_identified_fields : []
          next.not_identified_fields = target.checked
            ? Array.from(new Set([...current, target.value]))
            : current.filter((value) => value !== target.value)
        } else {
          next[target.name] = target.checked ? 'on' : ''
        }
      } else {
        next[target.name] = target.value
      }

      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(next))
      return next
    })
  }

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

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DRAFT_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as DraftValues
        saveDraft(parsed)
        setIncardinationId(typeof parsed.incardination_entity_id === 'string' ? parsed.incardination_entity_id : '')
        setServiceId(typeof parsed.current_service_entity_id === 'string' ? parsed.current_service_entity_id : '')
        setQuickEntityId(typeof parsed.quick_entity_id === 'string' ? parsed.quick_entity_id : typeof parsed.current_service_entity_id === 'string' ? parsed.current_service_entity_id : '')
      }
    } catch {
      window.localStorage.removeItem(DRAFT_KEY)
    } finally {
      setDraftLoaded(true)
    }
  }, [])

  async function uploadPhoto(file: File, slug: string) {
    if (!file || file.size === 0) return { photo_url: null, photo_path: null }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('La foto debe estar en formato JPG, PNG o WEBP.')
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error('La foto no debe pasar de 5 MB.')
    }

    const path = `sacerdotes/${slug || 'sacerdote'}-${Date.now()}.${fileExtension(file)}`
    const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

    if (uploadError) {
      throw new Error(`No se pudo subir la foto: ${uploadError.message}`)
    }

    const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path)
    return { photo_url: data.publicUrl, photo_path: path }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    setSavedSlug(null)

    const form = new FormData(event.currentTarget)
    const firstName = String(form.get('first_name') ?? '').trim()
    const lastName = String(form.get('last_name') ?? '').trim()
    const displayName = buildDisplayName(form)
    const slug = slugify(displayName)

    if (!firstName || !lastName || !displayName || !slug) {
      setError('Primer nombre y primer apellido son obligatorios.')
      setSaving(false)
      return
    }

    const quickOfficeId = emptyToNull(form.get('quick_office_configuration_id'))
    const photoFile = form.get('photo_file') instanceof File ? form.get('photo_file') as File : null

    try {
      const uploadedPhoto = photoFile ? await uploadPhoto(photoFile, slug) : { photo_url: null, photo_path: null }
      const payload: PriestPayload = {
        first_name: firstName,
        middle_name: emptyToNull(form.get('middle_name')),
        last_name: lastName,
        second_last_name: emptyToNull(form.get('second_last_name')),
        display_name: displayName,
        slug,
        gender: emptyToNull(form.get('gender')),
        birth_date: emptyToNull(form.get('birth_date')),
        birth_place: emptyToNull(form.get('birth_place')),
        photo_url: uploadedPhoto.photo_url,
        photo_path: uploadedPhoto.photo_path,
        biography_public: emptyToNull(form.get('biography_public')),
        notes_internal: emptyToNull(form.get('notes_internal')),
        validation_type: emptyToNull(form.get('validation_type')),
        validation_value: emptyToNull(form.get('validation_value')),
        validation_country: emptyToNull(form.get('validation_country')),
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

      const response = await fetch('/api/admin/sacerdote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudo guardar el sacerdote.')
      }

      window.localStorage.removeItem(DRAFT_KEY)
      setDraftValues({})
      setSavedSlug(data.slug ?? payload.slug)
      setMessage(quickOfficeId ? 'Sacerdote creado correctamente con su cargo actual.' : 'Sacerdote creado correctamente.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el sacerdote.')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !draftLoaded) return <main className="container"><div className="empty-state">Cargando asistente...</div></main>

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink"><Link href="/admin/nuevo">← Volver a agregar nueva ficha</Link></div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Asistente paso a paso</p>
          <h1>Nuevo sacerdote</h1>
          <p className="lead">Registra todo en un solo proceso. El sistema arma el nombre, asigna un código interno privado y conserva lo escrito como borrador hasta guardar.</p>
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

      <form className="admin-form admin-config-form card dashboard-section" onChange={handleDraftChange} onSubmit={handleSubmit}>
        <section hidden={step !== 0}>
          <p className="eyebrow">Paso 1 · Datos obligatorios</p>
          <h2>Identificación básica</h2>
          <p className="meta">El nombre de la ficha se arma automáticamente con estos datos. El código interno SINEP se asigna solo al guardar y no aparece en la ficha pública.</p>
          <input name="first_name" placeholder="Primer nombre" required defaultValue={fieldValue('first_name')} />
          <input name="middle_name" placeholder="Segundo nombre, si aplica" defaultValue={fieldValue('middle_name')} />
          <input name="last_name" placeholder="Primer apellido" required defaultValue={fieldValue('last_name')} />
          <input name="second_last_name" placeholder="Segundo apellido, si aplica" defaultValue={fieldValue('second_last_name')} />
          <div className="empty-state"><strong>Nombre que se mostrará</strong><span>{namePreview || 'Se formará automáticamente al escribir el nombre y apellido.'}</span></div>
          <h2>Validación interna</h2>
          <p className="meta">Opcional, pero recomendado para evitar duplicados. Este dato es privado y no aparece en la ficha pública.</p>
          <select name="validation_type" defaultValue={fieldValue('validation_type')}>
            <option value="">Sin documento por ahora</option>
            <option value="cedula">Cédula</option>
            <option value="passport">Pasaporte</option>
            <option value="other">Otro documento</option>
          </select>
          <input name="validation_value" placeholder="Número del documento para validación interna" defaultValue={fieldValue('validation_value')} />
          <input name="validation_country" placeholder="País del documento, ej. República Dominicana" defaultValue={fieldValue('validation_country', 'República Dominicana')} />
          <h2>Foto de la ficha</h2>
          <p className="meta">Opcional. Formatos permitidos: JPG, PNG o WEBP. Máximo 5 MB. La foto no se guarda como borrador; selecciónala antes de guardar.</p>
          <input name="photo_file" type="file" accept="image/jpeg,image/png,image/webp" />
        </section>

        <section hidden={step !== 1}>
          <p className="eyebrow">Paso 2 · Datos opcionales</p>
          <h2>Nacimiento y biografía</h2>
          <select name="gender" defaultValue={fieldValue('gender', 'male')}>
            <option value="male">Masculino</option>
            <option value="female">Femenino</option>
            <option value="unknown">No identificado</option>
          </select>
          <label>Fecha de nacimiento<input name="birth_date" type="date" defaultValue={fieldValue('birth_date')} /></label>
          <input name="birth_place" placeholder="Lugar de nacimiento" defaultValue={fieldValue('birth_place')} />
          <textarea name="biography_public" placeholder="Biografía breve para mostrar en la ficha" defaultValue={fieldValue('biography_public')} />
        </section>

        <section hidden={step !== 2}>
          <p className="eyebrow">Paso 3 · Datos clericales</p>
          <h2>Ordenación y estado</h2>
          <label>Ordenación diaconal<input name="diaconal_ordination_date" type="date" defaultValue={fieldValue('diaconal_ordination_date')} /></label>
          <label>Ordenación sacerdotal<input name="priestly_ordination_date" type="date" defaultValue={fieldValue('priestly_ordination_date')} /></label>
          <input name="religious_order" placeholder="Orden o congregación, si aplica" defaultValue={fieldValue('religious_order')} />
          <select name="canonical_status" defaultValue={fieldValue('canonical_status', 'active')}>
            <option value="active">Activo</option>
            <option value="retired">Retirado</option>
            <option value="suspended">Suspendido</option>
            <option value="deceased">Fallecido</option>
            <option value="unknown">No identificado</option>
          </select>
          <textarea name="clergy_notes" placeholder="Notas internas del perfil clerical" defaultValue={fieldValue('clergy_notes')} />
        </section>

        <section hidden={step !== 3}>
          <p className="eyebrow">Paso 4 · Servicio</p>
          <h2>Incardinación y servicio actual</h2>
          <select name="incardination_entity_id" value={incardinationId} onChange={(event) => setIncardinationId(event.target.value)}>
            <option value="">Sin incardinación por ahora</option>
            {entities.map((entity) => <option key={entity.direct_entity_id} value={entity.direct_entity_id}>{entity.direct_entity_name} · {entity.direct_entity_type_name ?? 'Entidad'}</option>)}
          </select>
          <div className="empty-state"><strong>Incardinación</strong><span>{incardination?.hierarchy_path ?? incardination?.direct_entity_name ?? 'Selecciona la diócesis, jurisdicción o entidad si aplica.'}</span></div>
          <select name="current_service_entity_id" value={serviceId} onChange={(event) => { const value = event.target.value; setServiceId(value); setQuickEntityId(value); setDraftField('quick_entity_id', value) }}>
            <option value="">Sin servicio actual por ahora</option>
            {entities.map((entity) => <option key={entity.direct_entity_id} value={entity.direct_entity_id}>{entity.direct_entity_name} · {entity.direct_entity_type_name ?? 'Entidad'}</option>)}
          </select>
          <div className="empty-state"><strong>Servicio actual</strong><span>{service?.hierarchy_path ?? service?.direct_entity_name ?? 'Selecciona parroquia, capilla, curia o entidad donde sirve.'}</span></div>
        </section>

        <section hidden={step !== 4}>
          <p className="eyebrow">Paso 5 · Cargo actual</p>
          <h2>Asignación rápida</h2>
          <p className="meta">Opcional. Puedes guardar la ficha sin cargo y asignarlo después desde Asignaciones.</p>
          <select name="quick_office_configuration_id" defaultValue={fieldValue('quick_office_configuration_id')}>
            <option value="">Sin cargo actual por ahora</option>
            {officeConfigs.map((office) => <option key={office.id} value={office.id}>{office.display_name}</option>)}
          </select>
          <input name="quick_title_override" placeholder="Título para mostrar: Párroco, Vicario parroquial, Encargado" defaultValue={fieldValue('quick_title_override')} />
          <select name="quick_entity_id" value={quickEntityId} onChange={(event) => setQuickEntityId(event.target.value)}>
            <option value="">Usar entidad del servicio actual o dejar sin entidad</option>
            {entities.map((entity) => <option key={entity.direct_entity_id} value={entity.direct_entity_id}>{entity.direct_entity_name} · {entity.direct_entity_type_name ?? 'Entidad'}</option>)}
          </select>
          <div className="empty-state"><strong>Entidad del cargo</strong><span>{quickEntity?.hierarchy_path ?? quickEntity?.direct_entity_name ?? service?.hierarchy_path ?? service?.direct_entity_name ?? 'Selecciona la parroquia, capilla, curia o entidad del cargo.'}</span></div>
          <label>Fecha de inicio del cargo<input name="quick_start_date" type="date" defaultValue={fieldValue('quick_start_date')} /></label>
          <textarea name="quick_notes_public" placeholder="Notas visibles del cargo" defaultValue={fieldValue('quick_notes_public')} />
        </section>

        <section hidden={step !== 5}>
          <p className="eyebrow">Paso 6 · Datos opcionales no encontrados</p>
          <h2>Datos faltantes</h2>
          <p className="meta">Marca solo los datos que fueron buscados y no se pudieron identificar. Así no aparecerán como pendientes.</p>
          <div className="card compact-section">
            {optionalFields.map((field) => (
              <label key={field.key} className="role-pill">
                <input type="checkbox" name="not_identified_fields" value={field.key} defaultChecked={notIdentifiedFields.includes(field.key)} /> {field.label}
              </label>
            ))}
          </div>
          <textarea name="notes_internal" placeholder="Notas internas de carga o verificación" defaultValue={fieldValue('notes_internal')} />
        </section>

        <section hidden={step !== 6}>
          <p className="eyebrow">Paso 7 · Revisión</p>
          <h2>Guardar sacerdote</h2>
          <p className="lead">Se creará la ficha pública, el perfil clerical, el registro privado de validación y, si elegiste un cargo actual, también la asignación.</p>
          <p className="meta">Después de guardar correctamente, el borrador se elimina automáticamente de este navegador.</p>
        </section>

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
