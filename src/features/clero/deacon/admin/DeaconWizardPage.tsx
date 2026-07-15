'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { EntityHierarchyEntity } from '@/components/admin/EntityHierarchyPicker'
import { PersonIdentityStep } from '@/features/personas/shared/components/PersonIdentityStep'
import {
  loadAllowedOfficeIds,
  loadDeaconCatalogs,
  removeDeaconPhoto,
  saveDeacon,
  uploadDeaconPhoto,
  type DeaconType,
  type OfficeConfig,
  type UnordainedPersonOption,
  type UploadedDeaconPhoto,
} from '../services/deacon-admin-service'

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

function deaconTypeLabel(value: DeaconType) {
  if (value === 'transitional') return 'Diácono transitorio'
  if (value === 'external') return 'Diácono externo / visitante'
  return 'Diácono permanente'
}

export default function DeaconWizardPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [savedSlug, setSavedSlug] = useState<string | null>(null)
  const [savedInternalCode, setSavedInternalCode] = useState<string | null>(null)
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [unordainedPeople, setUnordainedPeople] = useState<UnordainedPersonOption[]>([])
  const [deaconType, setDeaconType] = useState<DeaconType>('permanent')
  const [entities, setEntities] = useState<EntityHierarchyEntity[]>([])
  const [officeConfigs, setOfficeConfigs] = useState<OfficeConfig[]>([])
  const [allowedOfficeIds, setAllowedOfficeIds] = useState<string[]>([])
  const [officeFilterMessage, setOfficeFilterMessage] = useState('Selecciona la entidad del cargo para ver sus cargos permitidos.')
  const [incardinationId, setIncardinationId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [quickEntityId, setQuickEntityId] = useState('')
  const [quickOfficeConfigId, setQuickOfficeConfigId] = useState('')

  const selectedPerson = unordainedPeople.find((person) => person.id === selectedPersonId)
  const incardination = entities.find((item) => item.direct_entity_id === incardinationId)
  const service = entities.find((item) => item.direct_entity_id === serviceId)
  const quickEntity = entities.find((item) => item.direct_entity_id === quickEntityId)
  const filteredOfficeConfigs = quickEntityId
    ? officeConfigs.filter((office) => allowedOfficeIds.includes(office.id))
    : []

  useEffect(() => {
    async function loadData() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/admin/login')
        return
      }

      try {
        const catalogs = await loadDeaconCatalogs(supabase)
        setEntities(catalogs.entities)
        setOfficeConfigs(catalogs.offices)
        setUnordainedPeople(catalogs.unordainedPeople)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los catálogos.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router, supabase])

  useEffect(() => {
    async function loadOffices() {
      setAllowedOfficeIds([])
      if (!quickEntityId) {
        setOfficeFilterMessage('Selecciona la entidad del cargo para ver sus cargos permitidos.')
        return
      }

      try {
        const ids = await loadAllowedOfficeIds(supabase, quickEntityId)
        setAllowedOfficeIds(ids)
        setOfficeFilterMessage(
          ids.length > 0
            ? 'Cargos filtrados por el nivel estructural seleccionado.'
            : 'Este nivel no tiene cargos configurados. Configúralos en Administración → Estructura antes de asignar uno.',
        )
      } catch (officeError) {
        setOfficeFilterMessage(officeError instanceof Error ? officeError.message : 'No se pudieron cargar los cargos permitidos.')
      }
    }

    loadOffices()
  }, [quickEntityId, supabase])

  useEffect(() => {
    if (quickOfficeConfigId && !filteredOfficeConfigs.some((office) => office.id === quickOfficeConfigId)) {
      setQuickOfficeConfigId('')
    }
  }, [filteredOfficeConfigs, quickOfficeConfigId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setSaving(true)
    setError(null)
    setMessage(null)
    setSavedSlug(null)
    setSavedInternalCode(null)

    const form = new FormData(formElement)
    const firstName = String(form.get('first_name') ?? '').trim()
    const lastName = String(form.get('last_name') ?? '').trim()
    const displayName = mode === 'existing' ? selectedPerson?.display_name ?? '' : buildDisplayName(form)
    const slug = mode === 'existing' ? selectedPerson?.slug ?? '' : slugify(displayName)

    if (mode === 'existing' && !selectedPersonId) {
      setError('Selecciona la persona que recibió el diaconado.')
      setSaving(false)
      return
    }

    if (mode === 'new' && (!firstName || !lastName || !displayName || !slug)) {
      setError('Primer nombre y primer apellido son obligatorios.')
      setSaving(false)
      return
    }

    let uploadedPhoto: UploadedDeaconPhoto | null = null

    try {
      const photoFile = mode === 'new' && form.get('photo_file') instanceof File ? form.get('photo_file') as File : null
      uploadedPhoto = photoFile ? await uploadDeaconPhoto(supabase, photoFile, slug) : { photo_url: null, photo_path: null }
      const payload = {
        mode,
        selected_person_id: mode === 'existing' ? selectedPersonId : null,
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
        quick_office_configuration_id: quickOfficeConfigId || null,
        quick_title_override: emptyToNull(form.get('quick_title_override')),
        quick_entity_id: emptyToNull(form.get('quick_entity_id')),
        quick_start_date: emptyToNull(form.get('quick_start_date')),
        quick_notes_public: emptyToNull(form.get('quick_notes_public')),
        not_identified_fields: form.getAll('not_identified_fields').map(String),
      }

      const data = await saveDeacon(payload)
      setSavedSlug(data.slug ?? slug)
      setSavedInternalCode(data.internal_reference_code ?? null)
      setMessage(
        mode === 'existing'
          ? `Diaconado agregado a la ficha de ${selectedPerson?.display_name ?? 'la persona'} sin duplicar su identidad.`
          : `${deaconTypeLabel(deaconType)} creado correctamente.`,
      )
      formElement.reset()
      setSelectedPersonId('')
      setIncardinationId('')
      setServiceId('')
      setQuickEntityId('')
      setQuickOfficeConfigId('')
    } catch (saveError) {
      await removeDeaconPhoto(supabase, uploadedPhoto?.photo_path)
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el diácono.')
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
          <h1>Registrar diaconado</h1>
          <p className="lead">Busca primero la ficha de la persona. La ordenación diaconal se añade sobre esa misma identidad; solo crea una ficha nueva cuando la persona todavía no existe en SINEP RD.</p>
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
        <PersonIdentityStep
          mode={mode}
          onModeChange={setMode}
          selectedPersonId={selectedPersonId}
          onSelectedPersonChange={setSelectedPersonId}
          people={unordainedPeople}
          existingActionLabel="Añadir el diaconado a una persona existente."
          newActionLabel="Crear la identidad y registrar el diaconado."
          selectPlaceholder="Selecciona una persona sin ordenaciones"
          existingSummary="Se conservarán su ficha, slug, código interno, vida consagrada y demás datos existentes."
        />

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

        {mode === 'new' && (
          <>
            <section>
              <p className="eyebrow">Datos obligatorios</p>
              <h2>Identificación básica</h2>
              <input name="first_name" placeholder="Primer nombre" required />
              <input name="middle_name" placeholder="Segundo nombre, si aplica" />
              <input name="last_name" placeholder="Primer apellido" required />
              <input name="second_last_name" placeholder="Segundo apellido, si aplica" />
              <p className="meta">El sistema creará una identidad única y añadirá sobre ella el evento de ordenación diaconal.</p>
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
          </>
        )}

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
          <select name="quick_entity_id" value={quickEntityId} onChange={(event) => setQuickEntityId(event.target.value)}>
            <option value="">Selecciona primero la entidad del cargo</option>
            {entities.map((entity) => <option key={entity.direct_entity_id} value={entity.direct_entity_id}>{entity.direct_entity_name} · {entity.direct_entity_type_name ?? 'Entidad'}</option>)}
          </select>
          <div className="empty-state"><strong>Entidad del cargo</strong><span>{quickEntity?.hierarchy_path ?? quickEntity?.direct_entity_name ?? service?.hierarchy_path ?? service?.direct_entity_name ?? 'Selecciona la entidad del cargo.'}</span></div>
          <select name="quick_office_configuration_id" value={quickOfficeConfigId} onChange={(event) => setQuickOfficeConfigId(event.target.value)} disabled={!quickEntityId || filteredOfficeConfigs.length === 0}>
            <option value="">Sin cargo actual por ahora</option>
            {filteredOfficeConfigs.map((office) => <option key={office.id} value={office.id}>{office.display_name}</option>)}
          </select>
          <p className="meta">{officeFilterMessage}</p>
          <input name="quick_title_override" placeholder="Título para mostrar" />
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

        <button className="button button-primary" disabled={saving}>{saving ? 'Guardando...' : mode === 'existing' ? 'Registrar ordenación diaconal' : `Guardar ${deaconTypeLabel(deaconType).toLowerCase()}`}</button>
      </form>
    </main>
  )
}
