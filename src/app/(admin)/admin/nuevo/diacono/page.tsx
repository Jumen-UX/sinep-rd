'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type EntityPath = {
  direct_entity_id: string
  direct_entity_name: string
  direct_entity_type_name: string | null
  hierarchy_path: string | null
}

type OfficeConfig = {
  id: string
  display_name: string
}

type SaveResponse = {
  slug?: string
  internal_reference_code?: string
  error?: string
}

type DeaconType = 'permanent' | 'transitional' | 'external'

const PHOTO_BUCKET = 'person-photos'
const optionalFields = [
  { key: 'birth_date', label: 'Fecha de nacimiento' },
  { key: 'birth_place', label: 'Lugar de nacimiento' },
  { key: 'biography_public', label: 'Biografía pública' },
  { key: 'diaconal_ordination_date', label: 'Fecha de ordenación diaconal' },
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
  return [form.get('first_name'), form.get('middle_name'), form.get('last_name'), form.get('second_last_name')]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

function fileExtension(file: File) {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

function deaconTypeLabel(value: DeaconType) {
  if (value === 'transitional') return 'Diácono transitorio'
  if (value === 'external') return 'Diácono externo / visitante'
  return 'Diácono permanente'
}

export default function NuevoDiaconoPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [savedSlug, setSavedSlug] = useState<string | null>(null)
  const [savedInternalCode, setSavedInternalCode] = useState<string | null>(null)
  const [deaconType, setDeaconType] = useState<DeaconType>('permanent')
  const [entities, setEntities] = useState<EntityPath[]>([])
  const [officeConfigs, setOfficeConfigs] = useState<OfficeConfig[]>([])
  const [incardinationId, setIncardinationId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [quickEntityId, setQuickEntityId] = useState('')

  const incardination = entities.find((item) => item.direct_entity_id === incardinationId)
  const service = entities.find((item) => item.direct_entity_id === serviceId)
  const quickEntity = entities.find((item) => item.direct_entity_id === quickEntityId)

  useEffect(() => {
    async function loadData() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/admin/login')
        return
      }

      const [entityRes, officeRes] = await Promise.all([
        supabase
          .from('public_entity_hierarchy_paths')
          .select('direct_entity_id,direct_entity_name,direct_entity_type_name,hierarchy_path')
          .order('direct_entity_name'),
        supabase
          .from('office_configurations')
          .select('id,display_name')
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

    loadData()
  }, [router, supabase])

  async function uploadPhoto(file: File, slug: string) {
    if (!file || file.size === 0) return { photo_url: null, photo_path: null }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('La foto debe estar en formato JPG, PNG o WEBP.')
    if (file.size > 5 * 1024 * 1024) throw new Error('La foto no debe pasar de 5 MB.')

    const path = `diaconos/${slug || 'diacono'}-${Date.now()}.${fileExtension(file)}`
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
    const firstName = String(form.get('first_name') ?? '').trim()
    const lastName = String(form.get('last_name') ?? '').trim()
    const displayName = buildDisplayName(form)
    const slug = slugify(displayName)

    if (!firstName || !lastName || !displayName || !slug) {
      setError('Primer nombre y primer apellido son obligatorios.')
      setSaving(false)
      return
    }

    try {
      const photoFile = form.get('photo_file') instanceof File ? form.get('photo_file') as File : null
      const uploadedPhoto = photoFile ? await uploadPhoto(photoFile, slug) : { photo_url: null, photo_path: null }
      const quickOfficeId = emptyToNull(form.get('quick_office_configuration_id'))

      const payload = {
        deacon_type: deaconType,
        first_name: firstName,
        middle_name: emptyToNull(form.get('middle_name')),
        last_name: lastName,
        second_last_name: emptyToNull(form.get('second_last_name')),
        display_name: displayName,
        slug,
        gender: 'male',
        birth_date: emptyToNull(form.get('birth_date')),
        birth_place: emptyToNull(form.get('birth_place')),
        photo_url: uploadedPhoto.photo_url,
        photo_path: uploadedPhoto.photo_path,
        biography_public: emptyToNull(form.get('biography_public')),
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
        external_jurisdiction_name: emptyToNull(form.get('external_jurisdiction_name')),
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

      const response = await fetch('/api/admin/diacono', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json() as SaveResponse
      if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar el diácono.')

      setSavedSlug(data.slug ?? payload.slug)
      setSavedInternalCode(data.internal_reference_code ?? null)
      setMessage(`${deaconTypeLabel(deaconType)} creado correctamente.`)
      event.currentTarget.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el diácono.')
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
          <p className="eyebrow">Inicio del historial clerical</p>
          <h1>Registrar diácono</h1>
          <p className="lead">Registra un diácono permanente, transitorio o externo. Si luego es ordenado sacerdote, el flujo de sacerdote usará esta misma ficha.</p>
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

      <form className="admin-form admin-config-form card dashboard-section" onSubmit={handleSubmit}>
        <section>
          <p className="eyebrow">Tipo de diácono</p>
          <h2>¿Qué tipo de diácono quieres registrar?</h2>
          <div className="dashboard-grid dashboard-summary">
            <button className={`metric-card metric-button ${deaconType === 'permanent' ? 'active-filter' : ''}`} type="button" onClick={() => setDeaconType('permanent')}><strong>Permanente</strong><span>No se asume que será sacerdote.</span></button>
            <button className={`metric-card metric-button ${deaconType === 'transitional' ? 'active-filter' : ''}`} type="button" onClick={() => setDeaconType('transitional')}><strong>Transitorio</strong><span>Queda listo para registrarlo luego como sacerdote.</span></button>
            <button className={`metric-card metric-button ${deaconType === 'external' ? 'active-filter' : ''}`} type="button" onClick={() => setDeaconType('external')}><strong>Externo</strong><span>Pertenece o viene de otra jurisdicción.</span></button>
          </div>
          {deaconType === 'external' && <input name="external_jurisdiction_name" placeholder="Jurisdicción externa o procedencia" />}
        </section>

        <section>
          <p className="eyebrow">Datos obligatorios</p>
          <h2>Identificación básica</h2>
          <input name="first_name" placeholder="Primer nombre" required />
          <input name="middle_name" placeholder="Segundo nombre, si aplica" />
          <input name="last_name" placeholder="Primer apellido" required />
          <input name="second_last_name" placeholder="Segundo apellido, si aplica" />
          <p className="meta">El sistema formará automáticamente el nombre público y el código interno de clero.</p>
        </section>

        <section>
          <p className="eyebrow">Validación privada</p>
          <h2>Documentos y contactos internos</h2>
          <select name="validation_type" defaultValue="">
            <option value="">Sin documento por ahora</option>
            <option value="cedula">Cédula</option>
            <option value="passport">Pasaporte</option>
            <option value="other">Otro documento</option>
          </select>
          <input name="validation_value" placeholder="Número del documento para validación interna" />
          <input name="validation_country" placeholder="País del documento" defaultValue="República Dominicana" />
          <input name="primary_phone" placeholder="Teléfono principal" />
          <input name="secondary_phone" placeholder="Teléfono alterno" />
          <input name="contact_email" type="email" placeholder="Correo de contacto" />
          <p className="meta">Estos datos son privados y no aparecen en la ficha pública.</p>
        </section>

        <section>
          <p className="eyebrow">Datos personales</p>
          <h2>Nacimiento, familia y foto</h2>
          <label>Fecha de nacimiento<input name="birth_date" type="date" /></label>
          <input name="birth_place" placeholder="Lugar de nacimiento" />
          <input name="father_name" placeholder="Nombre del padre" />
          <input name="mother_name" placeholder="Nombre de la madre" />
          <textarea name="family_notes" placeholder="Notas familiares relevantes para la biografía" />
          <textarea name="biography_notes" placeholder="Apuntes internos para preparar la biografía" />
          <textarea name="biography_public" placeholder="Biografía breve para mostrar en la ficha pública" />
          <input name="photo_file" type="file" accept="image/jpeg,image/png,image/webp" />
        </section>

        <section>
          <p className="eyebrow">Datos clericales</p>
          <h2>Ordenación y estado</h2>
          <label>Ordenación diaconal<input name="diaconal_ordination_date" type="date" /></label>
          <input name="religious_order" placeholder="Orden o congregación, si aplica" />
          <select name="canonical_status" defaultValue="active">
            <option value="active">Activo</option>
            <option value="retired">Retirado</option>
            <option value="suspended">Suspendido</option>
            <option value="deceased">Fallecido</option>
            <option value="unknown">No identificado</option>
          </select>
          <textarea name="clergy_notes" placeholder="Notas internas del perfil clerical" />
        </section>

        <section>
          <p className="eyebrow">Servicio</p>
          <h2>Incardinación y servicio actual</h2>
          <select name="incardination_entity_id" value={incardinationId} onChange={(event) => setIncardinationId(event.target.value)}>
            <option value="">Sin incardinación por ahora</option>
            {entities.map((entity) => <option key={entity.direct_entity_id} value={entity.direct_entity_id}>{entity.direct_entity_name} · {entity.direct_entity_type_name ?? 'Entidad'}</option>)}
          </select>
          <div className="empty-state"><strong>Incardinación</strong><span>{incardination?.hierarchy_path ?? incardination?.direct_entity_name ?? 'Selecciona la jurisdicción si aplica.'}</span></div>
          <select name="current_service_entity_id" value={serviceId} onChange={(event) => { const value = event.target.value; setServiceId(value); setQuickEntityId(value) }}>
            <option value="">Sin servicio actual por ahora</option>
            {entities.map((entity) => <option key={entity.direct_entity_id} value={entity.direct_entity_id}>{entity.direct_entity_name} · {entity.direct_entity_type_name ?? 'Entidad'}</option>)}
          </select>
          <div className="empty-state"><strong>Servicio actual</strong><span>{service?.hierarchy_path ?? service?.direct_entity_name ?? 'Selecciona parroquia, capilla, curia o entidad donde sirve.'}</span></div>
        </section>

        <section>
          <p className="eyebrow">Cargo actual</p>
          <h2>Asignación rápida</h2>
          <select name="quick_office_configuration_id" defaultValue="">
            <option value="">Sin cargo actual por ahora</option>
            {officeConfigs.map((office) => <option key={office.id} value={office.id}>{office.display_name}</option>)}
          </select>
          <input name="quick_title_override" placeholder="Título para mostrar" />
          <select name="quick_entity_id" value={quickEntityId} onChange={(event) => setQuickEntityId(event.target.value)}>
            <option value="">Usar entidad del servicio actual o dejar sin entidad</option>
            {entities.map((entity) => <option key={entity.direct_entity_id} value={entity.direct_entity_id}>{entity.direct_entity_name} · {entity.direct_entity_type_name ?? 'Entidad'}</option>)}
          </select>
          <div className="empty-state"><strong>Entidad del cargo</strong><span>{quickEntity?.hierarchy_path ?? quickEntity?.direct_entity_name ?? service?.hierarchy_path ?? service?.direct_entity_name ?? 'Selecciona la entidad del cargo.'}</span></div>
          <label>Fecha de inicio del cargo<input name="quick_start_date" type="date" /></label>
          <textarea name="quick_notes_public" placeholder="Notas visibles del cargo" />
        </section>

        <section>
          <p className="eyebrow">Completitud</p>
          <h2>Datos buscados y no encontrados</h2>
          <div className="card compact-section">
            {optionalFields.map((field) => (
              <label key={field.key} className="role-pill"><input type="checkbox" name="not_identified_fields" value={field.key} /> {field.label}</label>
            ))}
          </div>
          <textarea name="notes_internal" placeholder="Notas internas de carga o verificación" />
        </section>

        <button className="button button-primary" disabled={saving}>{saving ? 'Guardando...' : `Guardar ${deaconTypeLabel(deaconType).toLowerCase()}`}</button>
      </form>
    </main>
  )
}
