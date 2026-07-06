'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import EntityHierarchyPicker, { EntityHierarchyEntity } from '@/components/admin/EntityHierarchyPicker'
import { createClient } from '@/lib/supabase/client'

type OfficeConfig = {
  id: string
  display_name: string
  organization_chart_id: string | null
}

type DeaconOption = {
  id: string
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  second_last_name: string | null
  display_name: string
  slug: string
  gender: string | null
  birth_date: string | null
  birth_place: string | null
  photo_url: string | null
  biography_public: string | null
}

type MissingField = { key: string; label: string }
type DraftValue = string | string[]
type DraftValues = Record<string, DraftValue>

type SaveResponse = {
  slug?: string
  internal_reference_code?: string
  error?: string
}

const DRAFT_KEY = 'sinep:nuevo-sacerdote:draft'
const PHOTO_BUCKET = 'person-photos'
const steps = ['Origen', 'Persona', 'Nacimiento', 'Clero', 'Servicio', 'Cargo', 'Completitud', 'Revisión']
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

function fileExtension(file: File) {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

export default function NuevoSacerdotePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [entities, setEntities] = useState<EntityHierarchyEntity[]>([])
  const [officeConfigs, setOfficeConfigs] = useState<OfficeConfig[]>([])
  const [deacons, setDeacons] = useState<DeaconOption[]>([])
  const [mode, setMode] = useState<'existing-deacon' | 'new-priest'>('existing-deacon')
  const [selectedDeaconId, setSelectedDeaconId] = useState('')
  const [incardinationId, setIncardinationId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [quickEntityId, setQuickEntityId] = useState('')
  const [savedSlug, setSavedSlug] = useState<string | null>(null)
  const [savedInternalCode, setSavedInternalCode] = useState<string | null>(null)
  const [draftValues, setDraftValues] = useState<DraftValues>({})

  const selectedDeacon = deacons.find((item) => item.id === selectedDeaconId)
  const incardination = entities.find((item) => item.direct_entity_id === incardinationId)
  const notIdentifiedFields = Array.isArray(draftValues.not_identified_fields) ? draftValues.not_identified_fields : []
  const namePreview = selectedDeacon?.display_name || buildDisplayNameFromParts([
    fieldValue('first_name'),
    fieldValue('middle_name'),
    fieldValue('last_name'),
    fieldValue('second_last_name'),
  ])

  function fieldValue(name: string, fallback = '') {
    const value = draftValues[name]
    return typeof value === 'string' ? value : fallback
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
    if (!target.name || (target instanceof HTMLInputElement && target.type === 'file')) return

    setDraftValues((previous) => {
      const next: DraftValues = { ...previous }
      if (target instanceof HTMLInputElement && target.type === 'checkbox' && target.name === 'not_identified_fields') {
        const current = Array.isArray(previous.not_identified_fields) ? previous.not_identified_fields : []
        next.not_identified_fields = target.checked
          ? Array.from(new Set([...current, target.value]))
          : current.filter((value) => value !== target.value)
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

    const [entityRes, officeRes, deaconRes] = await Promise.all([
      supabase
        .from('admin_entity_hierarchy_selector')
        .select('direct_entity_id,direct_entity_name,direct_entity_slug,direct_entity_type_key,direct_entity_type_name,jurisdiction_id,jurisdiction_name,jurisdiction_slug,vicariate_id,vicariate_name,vicariate_slug,zone_id,zone_name,zone_slug,parish_id,parish_name,parish_slug,hierarchy_path')
        .order('direct_entity_name'),
      supabase
        .from('office_configurations')
        .select('id,display_name,organization_chart_id')
        .eq('status', 'active')
        .order('display_name'),
      supabase
        .from('persons')
        .select('id,first_name,middle_name,last_name,second_last_name,display_name,slug,gender,birth_date,birth_place,photo_url,biography_public')
        .eq('person_type', 'deacon')
        .eq('status', 'active')
        .order('display_name'),
    ])

    if (entityRes.error || officeRes.error || deaconRes.error) {
      setError(entityRes.error?.message ?? officeRes.error?.message ?? deaconRes.error?.message ?? 'No se pudieron cargar los catálogos.')
    } else {
      setEntities((entityRes.data ?? []) as EntityHierarchyEntity[])
      setOfficeConfigs((officeRes.data ?? []) as OfficeConfig[])
      setDeacons((deaconRes.data ?? []) as DeaconOption[])
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
        setDraftValues(parsed)
        setMode(parsed.registration_mode === 'new-priest' ? 'new-priest' : 'existing-deacon')
        setSelectedDeaconId(typeof parsed.existing_deacon_person_id === 'string' ? parsed.existing_deacon_person_id : '')
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
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('La foto debe estar en formato JPG, PNG o WEBP.')
    if (file.size > 5 * 1024 * 1024) throw new Error('La foto no debe pasar de 5 MB.')

    const path = `sacerdotes/${slug || 'sacerdote'}-${Date.now()}.${fileExtension(file)}`
    const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false })
    if (uploadError) throw new Error(`No se pudo subir la foto: ${uploadError.message}`)
    const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path)
    return { photo_url: data.publicUrl, photo_path: path }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    setSavedSlug(null)
    setSavedInternalCode(null)

    const form = new FormData(event.currentTarget)
    const existingDeaconId = mode === 'existing-deacon' ? selectedDeaconId : ''
    const displayName = selectedDeacon?.display_name || buildDisplayNameFromParts([form.get('first_name'), form.get('middle_name'), form.get('last_name'), form.get('second_last_name')])
    const firstName = String(form.get('first_name') ?? selectedDeacon?.first_name ?? '').trim()
    const lastName = String(form.get('last_name') ?? selectedDeacon?.last_name ?? '').trim()
    const slug = slugify(displayName)

    if (mode === 'existing-deacon' && !existingDeaconId) {
      setError('Selecciona el diácono que será registrado como sacerdote.')
      setSaving(false)
      return
    }

    if (mode === 'new-priest' && (!firstName || !lastName || !displayName || !slug)) {
      setError('Primer nombre y primer apellido son obligatorios cuando registras una ficha nueva.')
      setSaving(false)
      return
    }

    try {
      const photoFile = form.get('photo_file') instanceof File ? form.get('photo_file') as File : null
      const uploadedPhoto = photoFile ? await uploadPhoto(photoFile, slug) : { photo_url: null, photo_path: null }
      const quickOfficeId = emptyToNull(form.get('quick_office_configuration_id'))

      const payload = {
        existing_deacon_person_id: existingDeaconId || null,
        first_name: firstName,
        middle_name: emptyToNull(form.get('middle_name')) ?? selectedDeacon?.middle_name ?? null,
        last_name: lastName,
        second_last_name: emptyToNull(form.get('second_last_name')) ?? selectedDeacon?.second_last_name ?? null,
        display_name: displayName,
        slug,
        gender: emptyToNull(form.get('gender')) ?? selectedDeacon?.gender ?? null,
        birth_date: emptyToNull(form.get('birth_date')) ?? selectedDeacon?.birth_date ?? null,
        birth_place: emptyToNull(form.get('birth_place')) ?? selectedDeacon?.birth_place ?? null,
        photo_url: uploadedPhoto.photo_url,
        photo_path: uploadedPhoto.photo_path,
        biography_public: emptyToNull(form.get('biography_public')) ?? selectedDeacon?.biography_public ?? null,
        notes_internal: emptyToNull(form.get('notes_internal')),
        validation_type: emptyToNull(form.get('validation_type')),
        validation_value: emptyToNull(form.get('validation_value')),
        validation_country: emptyToNull(form.get('validation_country')),
        primary_phone: emptyToNull(form.get('primary_phone')),
        secondary_phone: emptyToNull(form.get('secondary_phone')),
        contact_email: emptyToNull(form.get('contact_email')),
        father_name: emptyToNull(form.get('father_name')),
        mother_name: emptyToNull(form.get('mother_name')),
        family_notes: emptyToNull(form.get('family_notes')),
        biography_notes: emptyToNull(form.get('biography_notes')),
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
      const data = await response.json() as SaveResponse
      if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar el sacerdote.')

      window.localStorage.removeItem(DRAFT_KEY)
      setDraftValues({})
      setSavedSlug(data.slug ?? payload.slug)
      setSavedInternalCode(data.internal_reference_code ?? null)
      setMessage(existingDeaconId ? 'Diácono registrado como sacerdote correctamente.' : quickOfficeId ? 'Sacerdote creado correctamente con su cargo actual.' : 'Sacerdote creado correctamente.')
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
          <h1>Registrar sacerdote</h1>
          <p className="lead">Antes de crear una ficha nueva, revisa si ya existe como diácono. Si existe, el sistema completa la misma persona y evita duplicados.</p>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && (
        <div className="empty-state">
          <strong>{message}</strong>
          {savedInternalCode && <span>Código interno administrativo: {savedInternalCode}</span>}
          {savedSlug && <Link href={`/personas/${savedSlug}`}>Ver ficha pública</Link>}
        </div>
      )}

      <div className="dashboard-grid dashboard-summary">
        {steps.map((label, index) => (
          <button key={label} className={`metric-card metric-button ${step === index ? 'active-filter' : ''}`} type="button" onClick={() => setStep(index)}>
            <strong>{index + 1}</strong><span>{label}</span>
          </button>
        ))}
      </div>

      <form className="admin-form admin-config-form card dashboard-section" onChange={handleDraftChange} onSubmit={handleSubmit}>
        <section hidden={step !== 0}>
          <p className="eyebrow">Paso 1 · Origen</p>
          <h2>¿Este sacerdote ya existe como diácono?</h2>
          <p className="meta">Si ya existe como diácono, selecciónalo. El sistema traerá su ficha y solo completarás los datos sacerdotales.</p>
          <label className="role-pill"><input checked={mode === 'existing-deacon'} name="registration_mode" onChange={() => { setMode('existing-deacon'); setDraftField('registration_mode', 'existing-deacon') }} type="radio" value="existing-deacon" /> Sí, buscar diácono existente</label>
          <label className="role-pill"><input checked={mode === 'new-priest'} name="registration_mode" onChange={() => { setMode('new-priest'); setSelectedDeaconId(''); setDraftField('registration_mode', 'new-priest'); setDraftField('existing_deacon_person_id', '') }} type="radio" value="new-priest" /> No, registrar sacerdote nuevo con historial diaconal</label>
          {mode === 'existing-deacon' && (
            <>
              <select name="existing_deacon_person_id" value={selectedDeaconId} onChange={(event) => { setSelectedDeaconId(event.target.value); setDraftField('existing_deacon_person_id', event.target.value) }}>
                <option value="">Selecciona un diácono</option>
                {deacons.map((deacon) => <option key={deacon.id} value={deacon.id}>{deacon.display_name}</option>)}
              </select>
              <div className="empty-state"><strong>Ficha seleccionada</strong><span>{selectedDeacon ? `${selectedDeacon.display_name}${selectedDeacon.birth_place ? ` · ${selectedDeacon.birth_place}` : ''}` : 'Selecciona el diácono que será ordenado o registrado como sacerdote.'}</span></div>
            </>
          )}
        </section>

        <section hidden={step !== 1}>
          <p className="eyebrow">Paso 2 · Identificación</p>
          <h2>{mode === 'existing-deacon' ? 'Datos tomados del diácono' : 'Identificación básica'}</h2>
          <p className="meta">El nombre de la ficha se arma automáticamente. El código interno administrativo se conserva si viene de diácono o se asigna al guardar.</p>
          {mode === 'new-priest' && <>
            <input name="first_name" placeholder="Primer nombre" required defaultValue={fieldValue('first_name')} />
            <input name="middle_name" placeholder="Segundo nombre, si aplica" defaultValue={fieldValue('middle_name')} />
            <input name="last_name" placeholder="Primer apellido" required defaultValue={fieldValue('last_name')} />
            <input name="second_last_name" placeholder="Segundo apellido, si aplica" defaultValue={fieldValue('second_last_name')} />
          </>}
          <div className="empty-state"><strong>Nombre que se mostrará</strong><span>{namePreview || 'Se formará automáticamente al escribir el nombre y apellido.'}</span></div>

          <h2>Validación interna</h2>
          <p className="meta">Opcional y privado. Sirve para evitar duplicados.</p>
          <select name="validation_type" defaultValue={fieldValue('validation_type')}>
            <option value="">Sin documento por ahora</option>
            <option value="cedula">Cédula</option>
            <option value="passport">Pasaporte</option>
            <option value="other">Otro documento</option>
          </select>
          <input name="validation_value" placeholder="Número para validación interna" defaultValue={fieldValue('validation_value')} />
          <input name="validation_country" placeholder="País del documento" defaultValue={fieldValue('validation_country', 'República Dominicana')} />

          <h2>Contactos internos</h2>
          <input name="primary_phone" placeholder="Teléfono principal" defaultValue={fieldValue('primary_phone')} />
          <input name="secondary_phone" placeholder="Teléfono alterno" defaultValue={fieldValue('secondary_phone')} />
          <input name="contact_email" type="email" placeholder="Correo de contacto" defaultValue={fieldValue('contact_email')} />

          <h2>Foto de la ficha</h2>
          <p className="meta">Opcional. Si ya tiene foto como diácono, no tienes que subirla otra vez.</p>
          <input name="photo_file" type="file" accept="image/jpeg,image/png,image/webp" />
        </section>

        <section hidden={step !== 2}>
          <p className="eyebrow">Paso 3 · Datos opcionales</p>
          <h2>Nacimiento y biografía</h2>
          <select name="gender" defaultValue={fieldValue('gender', selectedDeacon?.gender ?? 'male')}>
            <option value="male">Masculino</option>
            <option value="female">Femenino</option>
            <option value="unknown">No identificado</option>
          </select>
          <label>Fecha de nacimiento<input name="birth_date" type="date" defaultValue={fieldValue('birth_date', selectedDeacon?.birth_date ?? '')} /></label>
          <input name="birth_place" placeholder="Lugar de nacimiento" defaultValue={fieldValue('birth_place', selectedDeacon?.birth_place ?? '')} />
          <h2>Datos familiares para preparar biografía</h2>
          <input name="father_name" placeholder="Nombre del padre" defaultValue={fieldValue('father_name')} />
          <input name="mother_name" placeholder="Nombre de la madre" defaultValue={fieldValue('mother_name')} />
          <textarea name="family_notes" placeholder="Notas familiares relevantes para la biografía" defaultValue={fieldValue('family_notes')} />
          <textarea name="biography_notes" placeholder="Apuntes internos para preparar la biografía" defaultValue={fieldValue('biography_notes')} />
          <textarea name="biography_public" placeholder="Biografía breve para mostrar en la ficha pública" defaultValue={fieldValue('biography_public', selectedDeacon?.biography_public ?? '')} />
        </section>

        <section hidden={step !== 3}>
          <p className="eyebrow">Paso 4 · Datos clericales</p>
          <h2>Ordenación y estado</h2>
          <label>Ordenación diaconal<input name="diaconal_ordination_date" type="date" defaultValue={fieldValue('diaconal_ordination_date')} /></label>
          <label>Ordenación sacerdotal<input name="priestly_ordination_date" type="date" required defaultValue={fieldValue('priestly_ordination_date')} /></label>
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

        <section hidden={step !== 4}>
          <p className="eyebrow">Paso 5 · Servicio</p>
          <h2>Incardinación y servicio actual</h2>
          <select name="incardination_entity_id" value={incardinationId} onChange={(event) => { setIncardinationId(event.target.value); setDraftField('incardination_entity_id', event.target.value) }}>
            <option value="">Sin incardinación por ahora</option>
            {entities.filter((entity) => ['archdiocese', 'diocese', 'military_ordinariate'].includes(entity.direct_entity_type_key ?? '')).map((entity) => <option key={entity.direct_entity_id} value={entity.direct_entity_id}>{entity.direct_entity_name}</option>)}
          </select>
          <div className="empty-state"><strong>Incardinación</strong><span>{incardination?.hierarchy_path ?? incardination?.direct_entity_name ?? 'Selecciona la diócesis o jurisdicción si aplica.'}</span></div>
          <EntityHierarchyPicker
            allowCreateParish
            entities={entities}
            help="Primero selecciona la jurisdicción. Si esa estructura tiene vicarías o zonas, aparecerán como filtros antes de elegir la parroquia. Si la parroquia no existe, puedes crearla aquí mismo."
            label="Servicio actual"
            name="current_service_entity_id"
            value={serviceId}
            onChange={(value) => { setServiceId(value); setQuickEntityId(value); setDraftField('current_service_entity_id', value); setDraftField('quick_entity_id', value) }}
            onCreated={loadData}
          />
        </section>

        <section hidden={step !== 5}>
          <p className="eyebrow">Paso 6 · Cargo actual</p>
          <h2>Asignación rápida</h2>
          <p className="meta">Opcional. Puedes guardar sin cargo y asignarlo después.</p>
          <select name="quick_office_configuration_id" defaultValue={fieldValue('quick_office_configuration_id')}>
            <option value="">Sin cargo actual por ahora</option>
            {officeConfigs.map((office) => <option key={office.id} value={office.id}>{office.display_name}</option>)}
          </select>
          <input name="quick_title_override" placeholder="Título para mostrar" defaultValue={fieldValue('quick_title_override')} />
          <EntityHierarchyPicker
            allowCreateParish
            entities={entities}
            help="Selecciona la parroquia o crea una nueva dentro de la jurisdicción, vicaría o zona correspondiente. Esto evita confundir parroquias con nombres parecidos."
            label="Entidad del cargo"
            name="quick_entity_id"
            value={quickEntityId}
            onChange={(value) => { setQuickEntityId(value); setDraftField('quick_entity_id', value) }}
            onCreated={loadData}
          />
          <label>Fecha de inicio del cargo<input name="quick_start_date" type="date" defaultValue={fieldValue('quick_start_date')} /></label>
          <textarea name="quick_notes_public" placeholder="Notas visibles del cargo" defaultValue={fieldValue('quick_notes_public')} />
        </section>

        <section hidden={step !== 6}>
          <p className="eyebrow">Paso 7 · Datos opcionales no encontrados</p>
          <h2>Datos faltantes</h2>
          <div className="card compact-section">
            {optionalFields.map((field) => (
              <label key={field.key} className="role-pill"><input type="checkbox" name="not_identified_fields" value={field.key} defaultChecked={notIdentifiedFields.includes(field.key)} /> {field.label}</label>
            ))}
          </div>
          <textarea name="notes_internal" placeholder="Notas internas de carga o verificación" defaultValue={fieldValue('notes_internal')} />
        </section>

        <section hidden={step !== 7}>
          <p className="eyebrow">Paso 8 · Revisión</p>
          <h2>Guardar sacerdote</h2>
          <p className="lead">Se guardará sobre la misma persona si viene de diácono; de lo contrario, se creará una ficha nueva.</p>
        </section>

        <div className="admin-form-grid">
          <button className="button button-secondary" type="button" onClick={() => setStep(Math.max(0, step - 1))}>Anterior</button>
          {step < steps.length - 1 ? (
            <button className="button button-secondary" type="button" onClick={() => setStep(Math.min(steps.length - 1, step + 1))}>Siguiente</button>
          ) : (
            <button className="button button-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar sacerdote'}</button>
          )}
        </div>
      </form>
    </main>
  )
}
