'use client'

import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AdminWizardProgress from '@/components/admin/AdminWizardProgress'
import SmartContextPanel from '@/components/admin/SmartContextPanel'
import StructureEntityPicker from '@/components/admin/StructureEntityPicker'
import type { EntityHierarchyEntity } from '@/components/admin/EntityHierarchyPicker'
import { createClient } from '@/lib/supabase/client'
import { PersonIdentityStep, type PersonIdentityMode } from '@/features/personas/shared/components/PersonIdentityStep'
import {
  loadAllowedOfficeIds,
  loadPriestCatalogs,
  savePriest,
  uploadPriestPhoto,
  type DeaconOption,
  type OfficeConfig,
  type SavePriestResponse,
} from '../services/priest-admin-service'

type DraftValue = string | string[]
type DraftValues = Record<string, DraftValue>
type MissingField = { key: string; label: string }
type RegistrationMode = 'existing-deacon' | 'new-priest'

const DRAFT_KEY = 'sinep:nuevo-sacerdote:draft'
const wizardSteps = [
  { label: 'Buscar persona', description: 'Usar diácono o crear ficha' },
  { label: 'Identidad', description: 'Datos personales y contacto' },
  { label: 'Ordenaciones', description: 'Tipo, fechas y pertenencia' },
  { label: 'Servicio', description: 'Entidad y cargo actual' },
  { label: 'Revisión', description: 'Verificar y guardar' },
]

const optionalFields: MissingField[] = [
  { key: 'priestly_ordination_date', label: 'Fecha de ordenación sacerdotal' },
  { key: 'incardination_entity_id', label: 'Incardinación' },
  { key: 'current_service_entity_id', label: 'Entidad donde sirve actualmente' },
]

function emptyToNull(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text.length > 0 ? text : null
}

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function buildDisplayName(parts: Array<FormDataEntryValue | string | null | undefined>) {
  return parts.map((part) => String(part ?? '').trim()).filter(Boolean).join(' ')
}

function toIdentityMode(mode: RegistrationMode): PersonIdentityMode {
  return mode === 'existing-deacon' ? 'existing' : 'new'
}

function toRegistrationMode(mode: PersonIdentityMode): RegistrationMode {
  return mode === 'existing' ? 'existing-deacon' : 'new-priest'
}

type PriestSaveSuccessNoticeProps = {
  message: string
  internalCode: string | null
  personId: string | null
  slug: string | null
}

function PriestSaveSuccessNotice({ message, internalCode, personId, slug }: PriestSaveSuccessNoticeProps) {
  const messageRef = useRef<HTMLElement>(null)
  const internalCodeRef = useRef<HTMLSpanElement>(null)
  const adminHref = personId ? `/admin/personas/${encodeURIComponent(personId)}` : null
  const publicHref = slug ? `/personas/${encodeURIComponent(slug)}` : null

  useEffect(() => {
    if (messageRef.current) messageRef.current.textContent = message
    if (internalCodeRef.current) internalCodeRef.current.textContent = internalCode ? `Código interno: ${internalCode}` : ''
  }, [internalCode, message])

  return (
    <section className="success-box admin-wizard-success">
      <div><strong ref={messageRef} /><span hidden={!internalCode} ref={internalCodeRef} /></div>
      <div className="admin-actions">
        {adminHref && <Link className="button button-primary" href={adminHref}>Abrir ficha administrativa</Link>}
        {publicHref && <Link className="button button-secondary" href={publicHref}>Ver ficha pública</Link>}
      </div>
    </section>
  )
}

export default function PriestWizardPage() {
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
  const [allowedOfficeIds, setAllowedOfficeIds] = useState<string[]>([])
  const [levelFilterMessage, setLevelFilterMessage] = useState('Selecciona una entidad para filtrar los cargos permitidos.')
  const [mode, setMode] = useState<RegistrationMode>('existing-deacon')
  const [priestType, setPriestType] = useState<'diocesan' | 'religious'>('diocesan')
  const [selectedDeaconId, setSelectedDeaconId] = useState('')
  const [incardinationId, setIncardinationId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [quickEntityId, setQuickEntityId] = useState('')
  const [quickOfficeConfigId, setQuickOfficeConfigId] = useState('')
  const [savedPersonId, setSavedPersonId] = useState<string | null>(null)
  const [savedSlug, setSavedSlug] = useState<string | null>(null)
  const [savedInternalCode, setSavedInternalCode] = useState<string | null>(null)
  const [draftValues, setDraftValues] = useState<DraftValues>({})

  const selectedDeacon = deacons.find((item) => item.id === selectedDeaconId)
  const incardination = entities.find((item) => item.direct_entity_id === incardinationId)
  const service = entities.find((item) => item.direct_entity_id === serviceId)
  const quickEntity = entities.find((item) => item.direct_entity_id === quickEntityId)
  const filteredOfficeConfigs = quickEntityId ? officeConfigs.filter((office) => allowedOfficeIds.includes(office.id)) : []
  const notIdentifiedFields = Array.isArray(draftValues.not_identified_fields) ? draftValues.not_identified_fields : []

  function fieldValue(name: string, fallback = '') {
    const value = draftValues[name]
    return typeof value === 'string' ? value : fallback
  }

  function setDraftField(name: string, value: DraftValue) {
    setDraftValues((current) => {
      const next = { ...current, [name]: value }
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(next))
      return next
    })
  }

  function handleIdentityModeChange(identityMode: PersonIdentityMode) {
    const registrationMode = toRegistrationMode(identityMode)
    setMode(registrationMode)
    setDraftField('registration_mode', registrationMode)
    if (registrationMode === 'new-priest') {
      setSelectedDeaconId('')
      setDraftField('existing_deacon_person_id', '')
    }
  }

  function handleSelectedDeaconChange(personId: string) {
    setSelectedDeaconId(personId)
    setDraftField('existing_deacon_person_id', personId)
  }

  function handleDraftChange(event: FormEvent<HTMLFormElement>) {
    const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    if (!target.name || (target instanceof HTMLInputElement && target.type === 'file')) return
    if (target.name === 'registration_mode' || target.name === 'existing_deacon_person_id') return

    setDraftValues((current) => {
      const next = { ...current }
      if (target instanceof HTMLInputElement && target.type === 'checkbox' && target.name === 'not_identified_fields') {
        const selected = Array.isArray(current.not_identified_fields) ? current.not_identified_fields : []
        next.not_identified_fields = target.checked
          ? Array.from(new Set([...selected, target.value]))
          : selected.filter((value) => value !== target.value)
      } else {
        next[target.name] = target.value
      }
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(next))
      return next
    })
  }

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/admin/login')
        return
      }
      try {
        const catalogs = await loadPriestCatalogs(supabase)
        setEntities(catalogs.entities)
        setOfficeConfigs(catalogs.offices)
        setDeacons(catalogs.deacons)
        if (catalogs.deacons.length === 0 && !window.localStorage.getItem(DRAFT_KEY)) setMode('new-priest')
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los catálogos.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, supabase])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DRAFT_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as DraftValues
        setDraftValues(parsed)
        setMode(parsed.registration_mode === 'new-priest' ? 'new-priest' : 'existing-deacon')
        setPriestType(parsed.priest_type === 'religious' ? 'religious' : 'diocesan')
        setSelectedDeaconId(typeof parsed.existing_deacon_person_id === 'string' ? parsed.existing_deacon_person_id : '')
        setIncardinationId(typeof parsed.incardination_entity_id === 'string' ? parsed.incardination_entity_id : '')
        setServiceId(typeof parsed.current_service_entity_id === 'string' ? parsed.current_service_entity_id : '')
        setQuickEntityId(typeof parsed.quick_entity_id === 'string' ? parsed.quick_entity_id : typeof parsed.current_service_entity_id === 'string' ? parsed.current_service_entity_id : '')
        setQuickOfficeConfigId(typeof parsed.quick_office_configuration_id === 'string' ? parsed.quick_office_configuration_id : '')
      }
    } catch {
      window.localStorage.removeItem(DRAFT_KEY)
    } finally {
      setDraftLoaded(true)
    }
  }, [])

  useEffect(() => {
    async function loadOffices() {
      if (!quickEntityId) {
        setAllowedOfficeIds([])
        setLevelFilterMessage('Selecciona una entidad para filtrar los cargos permitidos.')
        return
      }
      try {
        const ids = await loadAllowedOfficeIds(supabase, quickEntityId)
        setAllowedOfficeIds(ids)
        setLevelFilterMessage(ids.length > 0 ? 'Cargos filtrados por el nivel estructural seleccionado.' : 'Este nivel no tiene cargos configurados. Configúralos en Administración → Estructura antes de asignar uno.')
      } catch (officeError) {
        setAllowedOfficeIds([])
        setLevelFilterMessage(officeError instanceof Error ? officeError.message : 'No se pudieron filtrar los cargos.')
      }
    }
    loadOffices()
  }, [quickEntityId, supabase])

  useEffect(() => {
    if (quickOfficeConfigId && !filteredOfficeConfigs.some((office) => office.id === quickOfficeConfigId)) {
      setQuickOfficeConfigId('')
      setDraftField('quick_office_configuration_id', '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickOfficeConfigId, filteredOfficeConfigs])

  const namePreview = selectedDeacon?.display_name || buildDisplayName([fieldValue('first_name'), fieldValue('middle_name'), fieldValue('last_name'), fieldValue('second_last_name')])
  const completionItems = [
    { label: 'Persona identificada', complete: mode === 'existing-deacon' ? Boolean(selectedDeaconId) : Boolean(fieldValue('first_name') && fieldValue('last_name')) },
    { label: 'Tipo de sacerdote', complete: Boolean(priestType) },
    { label: 'Ordenación sacerdotal', complete: Boolean(fieldValue('priestly_ordination_date')) || notIdentifiedFields.includes('priestly_ordination_date') },
    { label: 'Pertenencia', complete: priestType === 'religious' ? Boolean(fieldValue('religious_institute_name')) : Boolean(incardinationId) },
    { label: 'Servicio actual', complete: Boolean(serviceId) || notIdentifiedFields.includes('current_service_entity_id') },
  ]

  function validateCurrentStep() {
    setError(null)
    if (step === 0 && mode === 'existing-deacon' && !selectedDeaconId) {
      setError('Selecciona el diácono que continuará su historial o elige crear una persona nueva.')
      return false
    }
    if (step === 1 && mode === 'new-priest' && (!fieldValue('first_name') || !fieldValue('last_name'))) {
      setError('Primer nombre y primer apellido son obligatorios.')
      return false
    }
    if (step === 2 && priestType === 'religious' && !fieldValue('religious_institute_name')) {
      setError('Indica la congregación, instituto u orden.')
      return false
    }
    if (step === 2 && !fieldValue('priestly_ordination_date') && !notIdentifiedFields.includes('priestly_ordination_date')) {
      setError('Indica la fecha de ordenación sacerdotal o márcala como no identificada.')
      return false
    }
    return true
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validateCurrentStep()) return
    setSaving(true)
    setError(null)
    setMessage(null)
    const form = new FormData(event.currentTarget)
    const existingDeaconId = mode === 'existing-deacon' ? selectedDeaconId : ''
    const displayName = selectedDeacon?.display_name || buildDisplayName([form.get('first_name'), form.get('middle_name'), form.get('last_name'), form.get('second_last_name')])
    const slug = slugify(displayName)

    try {
      const photoFile = form.get('photo_file') instanceof File ? form.get('photo_file') as File : null
      const uploadedPhoto = photoFile ? await uploadPriestPhoto(supabase, photoFile, slug) : { photo_url: null, photo_path: null }
      const religiousInstituteName = emptyToNull(form.get('religious_institute_name'))
      const payload = {
        existing_deacon_person_id: existingDeaconId || null,
        first_name: String(form.get('first_name') ?? selectedDeacon?.first_name ?? '').trim(),
        middle_name: emptyToNull(form.get('middle_name')) ?? selectedDeacon?.middle_name ?? null,
        last_name: String(form.get('last_name') ?? selectedDeacon?.last_name ?? '').trim(),
        second_last_name: emptyToNull(form.get('second_last_name')) ?? selectedDeacon?.second_last_name ?? null,
        display_name: displayName,
        slug,
        gender: emptyToNull(form.get('gender')) ?? selectedDeacon?.gender ?? null,
        birth_date: emptyToNull(form.get('birth_date')) ?? selectedDeacon?.birth_date ?? null,
        birth_place: emptyToNull(form.get('birth_place')) ?? selectedDeacon?.birth_place ?? null,
        photo_url: uploadedPhoto.photo_url,
        photo_path: uploadedPhoto.photo_path,
        biography_public: emptyToNull(form.get('biography_public')) ?? selectedDeacon?.biography_public ?? null,
        primary_phone: emptyToNull(form.get('primary_phone')),
        secondary_phone: emptyToNull(form.get('secondary_phone')),
        contact_email: emptyToNull(form.get('contact_email')),
        validation_type: emptyToNull(form.get('validation_type')),
        validation_value: emptyToNull(form.get('validation_value')),
        validation_country: emptyToNull(form.get('validation_country')),
        father_name: emptyToNull(form.get('father_name')),
        mother_name: emptyToNull(form.get('mother_name')),
        family_notes: emptyToNull(form.get('family_notes')),
        biography_notes: emptyToNull(form.get('biography_notes')),
        priest_type: priestType,
        religious_institute_name: religiousInstituteName,
        religious_order: religiousInstituteName,
        religious_province_name: emptyToNull(form.get('religious_province_name')),
        incardination_entity_id: emptyToNull(form.get('incardination_entity_id')),
        current_service_entity_id: emptyToNull(form.get('current_service_entity_id')),
        diaconal_ordination_date: emptyToNull(form.get('diaconal_ordination_date')),
        priestly_ordination_date: emptyToNull(form.get('priestly_ordination_date')),
        canonical_status: emptyToNull(form.get('canonical_status')),
        clergy_notes: emptyToNull(form.get('clergy_notes')),
        quick_office_configuration_id: emptyToNull(form.get('quick_office_configuration_id')),
        quick_title_override: emptyToNull(form.get('quick_title_override')),
        quick_entity_id: emptyToNull(form.get('quick_entity_id')),
        quick_start_date: emptyToNull(form.get('quick_start_date')),
        quick_notes_public: emptyToNull(form.get('quick_notes_public')),
        notes_internal: emptyToNull(form.get('notes_internal')),
        not_identified_fields: form.getAll('not_identified_fields').map(String),
      }

      const result = await savePriest(payload) as SavePriestResponse
      window.localStorage.removeItem(DRAFT_KEY)
      setSavedPersonId(result.person_id ?? existingDeaconId ?? null)
      setSavedSlug(result.slug ?? slug)
      setSavedInternalCode(result.internal_reference_code ?? null)
      setMessage(existingDeaconId ? 'La ficha del diácono fue completada como sacerdote.' : 'Sacerdote creado correctamente.')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo guardar el sacerdote.')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !draftLoaded) return <main className="container"><div className="empty-state">Cargando asistente...</div></main>

  return (
    <main className="container dashboard-page admin-priest-wizard" id="top">
      <div className="admin-entity-breadcrumbs"><Link href="/admin/personas">Personas</Link><span>›</span><Link href="/admin/nuevo">Agregar ficha</Link><span>›</span><strong>Sacerdote</strong></div>
      <section className="card admin-wizard-header"><div><p className="eyebrow">Asistente de creación</p><h1>Registrar sacerdote</h1><p className="lead">Busca primero una persona existente. Las actualizaciones posteriores se realizan desde la ficha administrativa.</p></div><div className="role-list admin-role-list"><span className="role-pill">Borrador automático</span><span className="role-pill">Catálogos guiados</span><span className="role-pill">5 etapas</span></div></section>
      {error && <div className="error-box">{error}</div>}
      {message && <PriestSaveSuccessNotice internalCode={savedInternalCode} message={message} personId={savedPersonId} slug={savedSlug} />}

      <div className="admin-wizard-layout">
        <AdminWizardProgress steps={wizardSteps} currentStep={step} onStepChange={setStep} />
        <form className="admin-form admin-config-form card dashboard-section admin-wizard-form" onChange={handleDraftChange} onSubmit={handleSubmit}>
          <div hidden={step !== 0}>
            <p className="eyebrow">Etapa 1</p>
            <PersonIdentityStep
              mode={toIdentityMode(mode)}
              onModeChange={handleIdentityModeChange}
              selectedPersonId={selectedDeaconId}
              onSelectedPersonChange={handleSelectedDeaconChange}
              people={deacons}
              existingActionLabel="Continuar el historial de un diácono sin crear otra persona."
              newActionLabel="Crear una identidad solo cuando la persona todavía no existe."
              selectPlaceholder="Selecciona un diácono"
              existingSummary="Se conservarán identidad, código interno, ordenación diaconal y demás historiales existentes."
            />
            <input type="hidden" name="registration_mode" value={mode} />
            <input type="hidden" name="existing_deacon_person_id" value={selectedDeaconId} />
          </div>

          <section hidden={step !== 1}>
            <p className="eyebrow">Etapa 2</p><h2>Identidad y contacto</h2>
            {mode === 'new-priest' && <div className="admin-form-fields-grid"><label>Primer nombre<input name="first_name" defaultValue={fieldValue('first_name')} /></label><label>Segundo nombre<input name="middle_name" defaultValue={fieldValue('middle_name')} /></label><label>Primer apellido<input name="last_name" defaultValue={fieldValue('last_name')} /></label><label>Segundo apellido<input name="second_last_name" defaultValue={fieldValue('second_last_name')} /></label></div>}
            <div className="empty-state"><strong>Nombre visible</strong><span>{namePreview || 'Se generará automáticamente.'}</span></div>
            <div className="admin-form-fields-grid">
              <label>Género<select name="gender" defaultValue={fieldValue('gender', selectedDeacon?.gender ?? 'male')}><option value="male">Masculino</option><option value="unknown">No identificado</option></select></label>
              <label>Fecha de nacimiento<input name="birth_date" type="date" defaultValue={fieldValue('birth_date', selectedDeacon?.birth_date ?? '')} /></label>
              <label>Lugar de nacimiento<input name="birth_place" defaultValue={fieldValue('birth_place', selectedDeacon?.birth_place ?? '')} /></label>
              <label>Correo<input name="contact_email" type="email" defaultValue={fieldValue('contact_email')} /></label>
              <label>Teléfono principal<input name="primary_phone" defaultValue={fieldValue('primary_phone')} /></label>
              <label>Teléfono alterno<input name="secondary_phone" defaultValue={fieldValue('secondary_phone')} /></label>
              <label>Tipo de documento<select name="validation_type" defaultValue={fieldValue('validation_type')}><option value="">Sin documento</option><option value="cedula">Cédula</option><option value="passport">Pasaporte</option><option value="other">Otro</option></select></label>
              <label>Número de documento<input name="validation_value" defaultValue={fieldValue('validation_value')} /></label>
              <label>País del documento<select name="validation_country" defaultValue={fieldValue('validation_country', 'República Dominicana')}><option value="República Dominicana">República Dominicana</option><option value="Haití">Haití</option><option value="Estados Unidos">Estados Unidos</option><option value="España">España</option></select></label>
              <label>Fotografía<input name="photo_file" type="file" accept="image/jpeg,image/png,image/webp" /></label>
            </div>
            <label>Biografía pública<textarea name="biography_public" defaultValue={fieldValue('biography_public', selectedDeacon?.biography_public ?? '')} /></label>
            <details className="card compact-section"><summary>Datos familiares y notas</summary><div className="admin-form-fields-grid"><label>Nombre del padre<input name="father_name" defaultValue={fieldValue('father_name')} /></label><label>Nombre de la madre<input name="mother_name" defaultValue={fieldValue('mother_name')} /></label></div><label>Notas familiares<textarea name="family_notes" defaultValue={fieldValue('family_notes')} /></label><label>Apuntes biográficos<textarea name="biography_notes" defaultValue={fieldValue('biography_notes')} /></label></details>
          </section>

          <section hidden={step !== 2}>
            <p className="eyebrow">Etapa 3</p><h2>Ordenaciones y pertenencia</h2>
            <div className="admin-choice-grid"><label className="role-pill"><input checked={priestType === 'diocesan'} name="priest_type" onChange={() => { setPriestType('diocesan'); setDraftField('priest_type', 'diocesan') }} type="radio" value="diocesan" /><span><strong>Sacerdote diocesano</strong><small>Incardinado en una jurisdicción.</small></span></label><label className="role-pill"><input checked={priestType === 'religious'} name="priest_type" onChange={() => { setPriestType('religious'); setDraftField('priest_type', 'religious') }} type="radio" value="religious" /><span><strong>Sacerdote religioso</strong><small>Pertenece a una congregación u orden.</small></span></label></div>
            {priestType === 'religious' && <div className="card compact-section"><label>Congregación, instituto u orden<input name="religious_institute_name" defaultValue={fieldValue('religious_institute_name')} /></label><label>Provincia religiosa<input name="religious_province_name" defaultValue={fieldValue('religious_province_name')} /></label></div>}
            <div className="admin-form-fields-grid"><label>Ordenación diaconal<input name="diaconal_ordination_date" type="date" defaultValue={fieldValue('diaconal_ordination_date')} /></label><label>Ordenación sacerdotal<input name="priestly_ordination_date" type="date" defaultValue={fieldValue('priestly_ordination_date')} /></label><label>Estado canónico<select name="canonical_status" defaultValue={fieldValue('canonical_status', 'active')}><option value="active">Activo</option><option value="retired">Retirado</option><option value="suspended">Suspendido</option><option value="deceased">Fallecido</option><option value="unknown">No identificado</option></select></label></div>
            <label>Incardinación<select name="incardination_entity_id" value={incardinationId} onChange={(event) => { setIncardinationId(event.target.value); setDraftField('incardination_entity_id', event.target.value) }}><option value="">Sin incardinación por ahora</option>{entities.filter((entity) => ['archdiocese', 'diocese', 'military_ordinariate'].includes(entity.direct_entity_type_key ?? '')).map((entity) => <option key={entity.direct_entity_id} value={entity.direct_entity_id}>{entity.direct_entity_name}</option>)}</select></label>
            <p className="meta">{incardination?.hierarchy_path ?? incardination?.direct_entity_name ?? 'Selecciona la jurisdicción correspondiente.'}</p>
            <label>Notas clericales<textarea name="clergy_notes" defaultValue={fieldValue('clergy_notes')} /></label>
            <div className="card compact-section"><h3>Datos no identificados</h3>{optionalFields.filter((field) => field.key !== 'current_service_entity_id').map((field) => <label className="role-pill" key={field.key}><input name="not_identified_fields" type="checkbox" value={field.key} defaultChecked={notIdentifiedFields.includes(field.key)} />{field.label}</label>)}</div>
          </section>

          <section hidden={step !== 3}>
            <p className="eyebrow">Etapa 4</p><h2>Servicio y cargo actual</h2><p className="meta">La entidad se selecciona desde la estructura configurada; el cargo es opcional.</p>
            <StructureEntityPicker allowCreate createEntityTypeKey="parish" help="Selecciona la diócesis y avanza por sus niveles." label="Entidad donde sirve actualmente" name="current_service_entity_id" value={serviceId} onChange={(value) => { setServiceId(value); setQuickEntityId(value); setDraftField('current_service_entity_id', value); setDraftField('quick_entity_id', value) }} />
            <div className="empty-state"><strong>Servicio seleccionado</strong><span>{service?.hierarchy_path ?? service?.direct_entity_name ?? 'Sin entidad seleccionada.'}</span></div>
            <label>Cargo actual<select name="quick_office_configuration_id" value={quickOfficeConfigId} onChange={(event) => { setQuickOfficeConfigId(event.target.value); setDraftField('quick_office_configuration_id', event.target.value) }} disabled={!quickEntityId || filteredOfficeConfigs.length === 0}><option value="">Sin cargo actual por ahora</option>{filteredOfficeConfigs.map((office) => <option key={office.id} value={office.id}>{office.display_name}</option>)}</select></label><p className="meta">{levelFilterMessage}</p>
            {quickOfficeConfigId && <div className="card compact-section"><StructureEntityPicker allowCreate createEntityTypeKey="parish" label="Entidad del cargo" name="quick_entity_id" value={quickEntityId} onChange={(value) => { setQuickEntityId(value); setDraftField('quick_entity_id', value) }} /><div className="admin-form-fields-grid"><label>Título para mostrar<input name="quick_title_override" defaultValue={fieldValue('quick_title_override')} /></label><label>Fecha de inicio<input name="quick_start_date" type="date" defaultValue={fieldValue('quick_start_date')} /></label></div><label>Notas públicas del cargo<textarea name="quick_notes_public" defaultValue={fieldValue('quick_notes_public')} /></label></div>}
            <div className="card compact-section"><label className="role-pill"><input name="not_identified_fields" type="checkbox" value="current_service_entity_id" defaultChecked={notIdentifiedFields.includes('current_service_entity_id')} />Entidad de servicio no identificada</label><label>Notas internas<textarea name="notes_internal" defaultValue={fieldValue('notes_internal')} /></label></div>
          </section>

          <section hidden={step !== 4}>
            <p className="eyebrow">Etapa 5</p><h2>Revisar antes de guardar</h2><p className="meta">Después de crear la ficha podrás editar sus secciones y registrar eventos por separado.</p>
            <div className="admin-review-grid"><div className="card compact-section"><span>Persona</span><strong>{namePreview || 'Sin nombre visible'}</strong><small>{mode === 'existing-deacon' ? 'Se completará la ficha existente' : 'Se creará una ficha nueva'}</small><button type="button" onClick={() => setStep(0)}>Cambiar</button></div><div className="card compact-section"><span>Tipo</span><strong>{priestType === 'religious' ? 'Sacerdote religioso' : 'Sacerdote diocesano'}</strong><small>{priestType === 'religious' ? fieldValue('religious_institute_name') || 'Instituto pendiente' : incardination?.direct_entity_name || 'Incardinación pendiente'}</small><button type="button" onClick={() => setStep(2)}>Cambiar</button></div><div className="card compact-section"><span>Ordenación</span><strong>{fieldValue('priestly_ordination_date') || 'Fecha no identificada'}</strong><small>Estado: {fieldValue('canonical_status', 'active')}</small><button type="button" onClick={() => setStep(2)}>Cambiar</button></div><div className="card compact-section"><span>Servicio</span><strong>{service?.direct_entity_name ?? 'Sin servicio actual'}</strong><small>{filteredOfficeConfigs.find((office) => office.id === quickOfficeConfigId)?.display_name ?? 'Sin cargo actual'}</small><button type="button" onClick={() => setStep(3)}>Cambiar</button></div></div>
          </section>

          <div className="admin-form-grid admin-wizard-actions"><button className="button button-secondary" type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>Anterior</button><span>Paso {step + 1} de {wizardSteps.length}</span>{step < wizardSteps.length - 1 ? <button className="button button-primary" type="button" onClick={() => { if (validateCurrentStep()) setStep((current) => current + 1) }}>Continuar</button> : <button className="button button-primary" disabled={saving} type="submit">{saving ? 'Guardando...' : 'Crear sacerdote'}</button>}</div>
        </form>

        <SmartContextPanel title="Ayuda contextual">{completionItems.map((item) => <div className="admin-context-block" key={item.label}><span>{item.label}</span><strong>{item.complete ? 'Completo' : 'Pendiente'}</strong></div>)}<div className="admin-context-block"><span>Entidad del cargo</span><strong>{quickEntity?.direct_entity_name ?? 'No seleccionada'}</strong></div><div className="admin-context-block"><span>Borrador</span><strong>Guardado automáticamente</strong></div></SmartContextPanel>
      </div>
    </main>
  )
}
