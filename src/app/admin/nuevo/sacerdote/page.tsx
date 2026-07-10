'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AdminWizardProgress from '@/components/admin/AdminWizardProgress'
import SmartContextPanel from '@/components/admin/SmartContextPanel'
import type { EntityHierarchyEntity } from '@/components/admin/EntityHierarchyPicker'
import StructureEntityPicker from '@/components/admin/StructureEntityPicker'
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
  person_id?: string
  slug?: string
  internal_reference_code?: string
  error?: string
}

type StructureNodeLevel = { level_id: string | null }
type LevelOfficeConfiguration = { office_configuration_id: string }

const DRAFT_KEY = 'sinep:nuevo-sacerdote:draft'
const PHOTO_BUCKET = 'person-photos'

const wizardSteps = [
  { label: 'Buscar persona', description: 'Usar diácono o crear ficha' },
  { label: 'Identidad', description: 'Datos personales y contacto' },
  { label: 'Ordenaciones', description: 'Tipo, fechas y pertenencia' },
  { label: 'Servicio', description: 'Entidad y cargo actual' },
  { label: 'Revisión', description: 'Verificar y guardar' },
]

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
  const [quickOfficeConfigId, setQuickOfficeConfigId] = useState('')
  const [levelOfficeConfigIds, setLevelOfficeConfigIds] = useState<string[]>([])
  const [levelFilterMessage, setLevelFilterMessage] = useState('Selecciona una entidad del cargo para filtrar cargos por nivel estructural.')
  const [deacons, setDeacons] = useState<DeaconOption[]>([])
  const [mode, setMode] = useState<'existing-deacon' | 'new-priest'>('existing-deacon')
  const [priestType, setPriestType] = useState<'diocesan' | 'religious'>('diocesan')
  const [selectedDeaconId, setSelectedDeaconId] = useState('')
  const [incardinationId, setIncardinationId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [quickEntityId, setQuickEntityId] = useState('')
  const [savedPersonId, setSavedPersonId] = useState<string | null>(null)
  const [savedSlug, setSavedSlug] = useState<string | null>(null)
  const [savedInternalCode, setSavedInternalCode] = useState<string | null>(null)
  const [draftValues, setDraftValues] = useState<DraftValues>({})

  const selectedDeacon = deacons.find((item) => item.id === selectedDeaconId)
  const incardination = entities.find((item) => item.direct_entity_id === incardinationId)
  const service = entities.find((item) => item.direct_entity_id === serviceId)
  const quickEntity = entities.find((item) => item.direct_entity_id === quickEntityId)
  const filteredOfficeConfigs = quickEntityId && levelOfficeConfigIds.length > 0
    ? officeConfigs.filter((office) => levelOfficeConfigIds.includes(office.id))
    : officeConfigs
  const notIdentifiedFields = Array.isArray(draftValues.not_identified_fields) ? draftValues.not_identified_fields : []

  function fieldValue(name: string, fallback = '') {
    const value = draftValues[name]
    return typeof value === 'string' ? value : fallback
  }

  const namePreview = selectedDeacon?.display_name || buildDisplayNameFromParts([
    fieldValue('first_name'),
    fieldValue('middle_name'),
    fieldValue('last_name'),
    fieldValue('second_last_name'),
  ])

  const completionItems = [
    { label: 'Persona identificada', complete: mode === 'existing-deacon' ? Boolean(selectedDeaconId) : Boolean(fieldValue('first_name') && fieldValue('last_name')) },
    { label: 'Tipo de sacerdote', complete: Boolean(priestType) },
    { label: 'Ordenación sacerdotal', complete: Boolean(fieldValue('priestly_ordination_date')) || notIdentifiedFields.includes('priestly_ordination_date') },
    { label: 'Pertenencia', complete: priestType === 'religious' ? Boolean(fieldValue('religious_institute_name')) : Boolean(incardinationId) },
    { label: 'Servicio actual', complete: Boolean(serviceId) || notIdentifiedFields.includes('current_service_entity_id') },
  ]
  const completedCount = completionItems.filter((item) => item.complete).length

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
      const availableDeacons = (deaconRes.data ?? []) as DeaconOption[]
      setDeacons(availableDeacons)
      if (availableDeacons.length === 0 && !window.localStorage.getItem(DRAFT_KEY)) {
        setMode('new-priest')
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    async function loadLevelOfficeConfigurations() {
      setLevelOfficeConfigIds([])
      if (!quickEntityId) {
        setLevelFilterMessage('Selecciona una entidad del cargo para filtrar cargos por nivel estructural.')
        return
      }

      const { data: nodeData, error: nodeError } = await supabase
        .from('structure_nodes')
        .select('level_id')
        .eq('linked_ecclesiastical_entity_id', quickEntityId)
        .eq('status', 'active')
        .limit(1)

      if (nodeError) {
        setLevelFilterMessage(`No se pudo identificar el nivel estructural: ${nodeError.message}`)
        return
      }

      const levelId = ((nodeData ?? []) as StructureNodeLevel[])[0]?.level_id
      if (!levelId) {
        setLevelFilterMessage('La entidad seleccionada no tiene nodo estructural activo. Se muestran todos los cargos.')
        return
      }

      const { data: levelOfficeData, error: levelOfficeError } = await supabase
        .from('structure_level_office_configurations')
        .select('office_configuration_id')
        .eq('level_id', levelId)
        .eq('status', 'active')
        .order('sort_order')

      if (levelOfficeError) {
        setLevelFilterMessage(`No se pudieron cargar los cargos permitidos: ${levelOfficeError.message}`)
        return
      }

      const allowedIds = ((levelOfficeData ?? []) as LevelOfficeConfiguration[]).map((item) => item.office_configuration_id)
      setLevelOfficeConfigIds(allowedIds)
      setLevelFilterMessage(allowedIds.length > 0 ? 'Cargos filtrados por el nivel seleccionado.' : 'Este nivel no tiene cargos configurados. Se muestran todos.')
    }

    loadLevelOfficeConfigurations()
  }, [quickEntityId, supabase])

  useEffect(() => {
    if (quickOfficeConfigId && !filteredOfficeConfigs.some((office) => office.id === quickOfficeConfigId)) {
      setQuickOfficeConfigId('')
      setDraftField('quick_office_configuration_id', '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickOfficeConfigId, filteredOfficeConfigs])

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

  function validateCurrentStep() {
    setError(null)
    if (step === 0 && mode === 'existing-deacon' && !selectedDeaconId) {
      setError('Selecciona el diácono que será registrado como sacerdote o elige crear una ficha nueva.')
      return false
    }
    if (step === 1 && mode === 'new-priest' && (!fieldValue('first_name') || !fieldValue('last_name'))) {
      setError('Primer nombre y primer apellido son obligatorios.')
      return false
    }
    if (step === 2 && priestType === 'religious' && !fieldValue('religious_institute_name')) {
      setError('Selecciona o indica la congregación, instituto u orden.')
      return false
    }
    if (step === 2 && !fieldValue('priestly_ordination_date') && !notIdentifiedFields.includes('priestly_ordination_date')) {
      setError('Indica la fecha de ordenación sacerdotal o márcala como no identificada.')
      return false
    }
    return true
  }

  function goNext() {
    if (!validateCurrentStep()) return
    setStep((current) => Math.min(wizardSteps.length - 1, current + 1))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validateCurrentStep()) return

    setSaving(true)
    setError(null)
    setMessage(null)
    setSavedPersonId(null)
    setSavedSlug(null)
    setSavedInternalCode(null)

    const form = new FormData(event.currentTarget)
    const existingDeaconId = mode === 'existing-deacon' ? selectedDeaconId : ''
    const displayName = selectedDeacon?.display_name || buildDisplayNameFromParts([form.get('first_name'), form.get('middle_name'), form.get('last_name'), form.get('second_last_name')])
    const firstName = String(form.get('first_name') ?? selectedDeacon?.first_name ?? '').trim()
    const lastName = String(form.get('last_name') ?? selectedDeacon?.last_name ?? '').trim()
    const slug = slugify(displayName)

    try {
      const photoFile = form.get('photo_file') instanceof File ? form.get('photo_file') as File : null
      const uploadedPhoto = photoFile ? await uploadPhoto(photoFile, slug) : { photo_url: null, photo_path: null }
      const quickOfficeId = emptyToNull(form.get('quick_office_configuration_id'))
      const formPriestType = emptyToNull(form.get('priest_type')) ?? priestType
      const religiousInstituteName = emptyToNull(form.get('religious_institute_name'))

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
        priest_type: formPriestType,
        religious_institute_name: religiousInstituteName,
        religious_order: religiousInstituteName,
        religious_province_name: emptyToNull(form.get('religious_province_name')),
        incardination_entity_id: emptyToNull(form.get('incardination_entity_id')),
        current_service_entity_id: emptyToNull(form.get('current_service_entity_id')),
        diaconal_ordination_date: emptyToNull(form.get('diaconal_ordination_date')),
        priestly_ordination_date: emptyToNull(form.get('priestly_ordination_date')),
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
      setSavedPersonId(data.person_id ?? existingDeaconId ?? null)
      setSavedSlug(data.slug ?? payload.slug)
      setSavedInternalCode(data.internal_reference_code ?? null)
      setMessage(existingDeaconId ? 'La ficha del diácono fue completada como sacerdote.' : 'Sacerdote creado correctamente.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el sacerdote.')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !draftLoaded) return <main className="container"><div className="empty-state">Cargando asistente...</div></main>

  return (
    <main className="container dashboard-page admin-priest-wizard" id="top">
      <div className="admin-entity-breadcrumbs">
        <Link href="/admin/personas">Personas</Link><span>›</span><Link href="/admin/nuevo">Agregar ficha</Link><span>›</span><strong>Sacerdote</strong>
      </div>

      <section className="card admin-wizard-header">
        <div>
          <p className="eyebrow">Asistente de creación</p>
          <h1>Registrar sacerdote</h1>
          <p className="lead">Busca primero una persona existente. El asistente crea la ficha inicial; las actualizaciones posteriores se realizan desde la ficha administrativa.</p>
        </div>
        <div className="role-list admin-role-list">
          <span className="role-pill">Borrador automático</span>
          <span className="role-pill">Antiduplicados</span>
          <span className="role-pill">5 etapas</span>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && (
        <section className="success-box admin-wizard-success">
          <div>
            <strong>{message}</strong>
            {savedInternalCode && <span>Código interno: {savedInternalCode}</span>}
          </div>
          <div className="admin-actions">
            {savedPersonId && <Link className="button button-primary" href={`/admin/personas/${savedPersonId}`}>Abrir ficha administrativa</Link>}
            {savedSlug && <Link className="button button-secondary" href={`/personas/${savedSlug}`}>Ver ficha pública</Link>}
            <Link className="button button-secondary" href="/admin/personas">Volver a personas</Link>
          </div>
        </section>
      )}

      <div className="admin-wizard-layout">
        <AdminWizardProgress steps={wizardSteps} currentStep={step} onStepChange={setStep} />

        <form className="admin-form admin-config-form card dashboard-section admin-wizard-form" onChange={handleDraftChange} onSubmit={handleSubmit}>
          <section hidden={step !== 0}>
            <p className="eyebrow">Etapa 1</p>
            <h2>Buscar o crear persona</h2>
            <p className="meta">Evita duplicar una persona que ya tenga historial como diácono.</p>

            <div className="admin-choice-grid">
              <label className="role-pill">
                <input checked={mode === 'existing-deacon'} name="registration_mode" onChange={() => { setMode('existing-deacon'); setDraftField('registration_mode', 'existing-deacon') }} type="radio" value="existing-deacon" />
                <span><strong>Usar diácono existente</strong><small>Conservar identidad, código e historial diaconal.</small></span>
              </label>
              <label className="role-pill">
                <input checked={mode === 'new-priest'} name="registration_mode" onChange={() => { setMode('new-priest'); setSelectedDeaconId(''); setDraftField('registration_mode', 'new-priest'); setDraftField('existing_deacon_person_id', '') }} type="radio" value="new-priest" />
                <span><strong>Crear sacerdote nuevo</strong><small>Registrar una nueva ficha con su historial de ordenación.</small></span>
              </label>
            </div>

            {mode === 'existing-deacon' && (
              <label>
                Diácono existente
                <select name="existing_deacon_person_id" value={selectedDeaconId} onChange={(event) => { setSelectedDeaconId(event.target.value); setDraftField('existing_deacon_person_id', event.target.value) }}>
                  <option value="">Selecciona un diácono</option>
                  {deacons.map((deacon) => <option key={deacon.id} value={deacon.id}>{deacon.display_name}</option>)}
                </select>
              </label>
            )}

            <div className="empty-state">
              <strong>Persona seleccionada</strong>
              <span>{selectedDeacon ? `${selectedDeacon.display_name}${selectedDeacon.birth_place ? ` · ${selectedDeacon.birth_place}` : ''}` : mode === 'new-priest' ? 'Se creará una ficha nueva en la siguiente etapa.' : 'Selecciona la persona que continuará su historial como sacerdote.'}</span>
            </div>
          </section>

          <section hidden={step !== 1}>
            <p className="eyebrow">Etapa 2</p>
            <h2>Identidad y contacto</h2>
            {mode === 'new-priest' && (
              <div className="admin-form-fields-grid">
                <label>Primer nombre<input name="first_name" defaultValue={fieldValue('first_name')} /></label>
                <label>Segundo nombre<input name="middle_name" defaultValue={fieldValue('middle_name')} /></label>
                <label>Primer apellido<input name="last_name" defaultValue={fieldValue('last_name')} /></label>
                <label>Segundo apellido<input name="second_last_name" defaultValue={fieldValue('second_last_name')} /></label>
              </div>
            )}

            <div className="empty-state"><strong>Nombre visible</strong><span>{namePreview || 'Se generará automáticamente con el nombre y los apellidos.'}</span></div>

            <div className="admin-form-fields-grid">
              <label>Género
                <select name="gender" defaultValue={fieldValue('gender', selectedDeacon?.gender ?? 'male')}>
                  <option value="male">Masculino</option>
                  <option value="unknown">No identificado</option>
                </select>
              </label>
              <label>Fecha de nacimiento<input name="birth_date" type="date" defaultValue={fieldValue('birth_date', selectedDeacon?.birth_date ?? '')} /></label>
              <label>Lugar de nacimiento<input name="birth_place" defaultValue={fieldValue('birth_place', selectedDeacon?.birth_place ?? '')} /></label>
              <label>Correo de contacto<input name="contact_email" type="email" defaultValue={fieldValue('contact_email')} /></label>
              <label>Teléfono principal<input name="primary_phone" defaultValue={fieldValue('primary_phone')} /></label>
              <label>Teléfono alterno<input name="secondary_phone" defaultValue={fieldValue('secondary_phone')} /></label>
              <label>Tipo de documento
                <select name="validation_type" defaultValue={fieldValue('validation_type')}>
                  <option value="">Sin documento por ahora</option>
                  <option value="cedula">Cédula</option>
                  <option value="passport">Pasaporte</option>
                  <option value="other">Otro documento</option>
                </select>
              </label>
              <label>Número de documento<input name="validation_value" defaultValue={fieldValue('validation_value')} /></label>
              <label>País del documento
                <select name="validation_country" defaultValue={fieldValue('validation_country', 'República Dominicana')}>
                  <option value="República Dominicana">República Dominicana</option>
                  <option value="Haití">Haití</option>
                  <option value="Estados Unidos">Estados Unidos</option>
                  <option value="España">España</option>
                  <option value="Otro">Otro</option>
                </select>
              </label>
              <label>Fotografía<input name="photo_file" type="file" accept="image/jpeg,image/png,image/webp" /></label>
            </div>

            <label>Biografía pública<textarea name="biography_public" defaultValue={fieldValue('biography_public', selectedDeacon?.biography_public ?? '')} /></label>
            <details className="card compact-section">
              <summary>Datos familiares y notas biográficas</summary>
              <div className="admin-form-fields-grid">
                <label>Nombre del padre<input name="father_name" defaultValue={fieldValue('father_name')} /></label>
                <label>Nombre de la madre<input name="mother_name" defaultValue={fieldValue('mother_name')} /></label>
              </div>
              <label>Notas familiares<textarea name="family_notes" defaultValue={fieldValue('family_notes')} /></label>
              <label>Apuntes para biografía<textarea name="biography_notes" defaultValue={fieldValue('biography_notes')} /></label>
            </details>
          </section>

          <section hidden={step !== 2}>
            <p className="eyebrow">Etapa 3</p>
            <h2>Ordenaciones y pertenencia</h2>

            <div className="admin-choice-grid">
              <label className="role-pill">
                <input checked={priestType === 'diocesan'} name="priest_type" onChange={() => { setPriestType('diocesan'); setDraftField('priest_type', 'diocesan') }} type="radio" value="diocesan" />
                <span><strong>Sacerdote diocesano</strong><small>Incardinado en una diócesis o jurisdicción.</small></span>
              </label>
              <label className="role-pill">
                <input checked={priestType === 'religious'} name="priest_type" onChange={() => { setPriestType('religious'); setDraftField('priest_type', 'religious') }} type="radio" value="religious" />
                <span><strong>Sacerdote religioso</strong><small>Pertenece a una congregación, instituto u orden.</small></span>
              </label>
            </div>

            {priestType === 'religious' && (
              <div className="card compact-section">
                <label>Congregación, instituto u orden<input name="religious_institute_name" defaultValue={fieldValue('religious_institute_name', fieldValue('religious_order'))} /></label>
                <label>Provincia religiosa<input name="religious_province_name" defaultValue={fieldValue('religious_province_name')} /></label>
              </div>
            )}

            <div className="admin-form-fields-grid">
              <label>Ordenación diaconal<input name="diaconal_ordination_date" type="date" defaultValue={fieldValue('diaconal_ordination_date')} /></label>
              <label>Ordenación sacerdotal<input name="priestly_ordination_date" type="date" defaultValue={fieldValue('priestly_ordination_date')} /></label>
              <label>Estado canónico
                <select name="canonical_status" defaultValue={fieldValue('canonical_status', 'active')}>
                  <option value="active">Activo</option>
                  <option value="retired">Retirado</option>
                  <option value="suspended">Suspendido</option>
                  <option value="deceased">Fallecido</option>
                  <option value="unknown">No identificado</option>
                </select>
              </label>
            </div>

            <label>Incardinación
              <select name="incardination_entity_id" value={incardinationId} onChange={(event) => { setIncardinationId(event.target.value); setDraftField('incardination_entity_id', event.target.value) }}>
                <option value="">Sin incardinación por ahora</option>
                {entities.filter((entity) => ['archdiocese', 'diocese', 'military_ordinariate'].includes(entity.direct_entity_type_key ?? '')).map((entity) => <option key={entity.direct_entity_id} value={entity.direct_entity_id}>{entity.direct_entity_name}</option>)}
              </select>
            </label>
            <p className="meta">{incardination?.hierarchy_path ?? incardination?.direct_entity_name ?? 'Selecciona la jurisdicción correspondiente cuando aplique.'}</p>

            <label>Notas clericales<textarea name="clergy_notes" defaultValue={fieldValue('clergy_notes')} /></label>

            <div className="card compact-section">
              <h3>Datos no identificados</h3>
              {optionalFields.filter((field) => ['priestly_ordination_date', 'incardination_entity_id'].includes(field.key)).map((field) => (
                <label className="role-pill" key={field.key}><input name="not_identified_fields" type="checkbox" value={field.key} defaultChecked={notIdentifiedFields.includes(field.key)} />{field.label}</label>
              ))}
            </div>
          </section>

          <section hidden={step !== 3}>
            <p className="eyebrow">Etapa 4</p>
            <h2>Servicio y cargo actual</h2>
            <p className="meta">La entidad se selecciona según la estructura configurada de cada diócesis. El cargo es opcional.</p>

            <StructureEntityPicker
              allowCreate
              createEntityTypeKey="parish"
              help="Selecciona la diócesis y avanza por sus niveles. Puedes crear la parroquia debajo del padre correcto si no existe."
              label="Entidad donde sirve actualmente"
              name="current_service_entity_id"
              value={serviceId}
              onChange={(value) => { setServiceId(value); setQuickEntityId(value); setDraftField('current_service_entity_id', value); setDraftField('quick_entity_id', value) }}
            />

            <div className="empty-state"><strong>Servicio seleccionado</strong><span>{service?.hierarchy_path ?? service?.direct_entity_name ?? 'Sin entidad de servicio seleccionada.'}</span></div>

            <label>Cargo actual
              <select name="quick_office_configuration_id" value={quickOfficeConfigId} onChange={(event) => { setQuickOfficeConfigId(event.target.value); setDraftField('quick_office_configuration_id', event.target.value) }}>
                <option value="">Sin cargo actual por ahora</option>
                {filteredOfficeConfigs.map((office) => <option key={office.id} value={office.id}>{office.display_name}</option>)}
              </select>
            </label>
            <p className="meta">{levelFilterMessage}</p>

            {quickOfficeConfigId && (
              <div className="card compact-section">
                <StructureEntityPicker
                  allowCreate
                  createEntityTypeKey="parish"
                  help="La entidad del cargo puede coincidir con el servicio actual o ser otra entidad válida."
                  label="Entidad del cargo"
                  name="quick_entity_id"
                  value={quickEntityId}
                  onChange={(value) => { setQuickEntityId(value); setDraftField('quick_entity_id', value) }}
                />
                <div className="admin-form-fields-grid">
                  <label>Título para mostrar<input name="quick_title_override" defaultValue={fieldValue('quick_title_override')} /></label>
                  <label>Fecha de inicio<input name="quick_start_date" type="date" defaultValue={fieldValue('quick_start_date')} /></label>
                </div>
                <label>Notas públicas del cargo<textarea name="quick_notes_public" defaultValue={fieldValue('quick_notes_public')} /></label>
              </div>
            )}

            <div className="card compact-section">
              <h3>Datos pendientes</h3>
              {optionalFields.filter((field) => ['current_service_entity_id'].includes(field.key)).map((field) => (
                <label className="role-pill" key={field.key}><input name="not_identified_fields" type="checkbox" value={field.key} defaultChecked={notIdentifiedFields.includes(field.key)} />{field.label}</label>
              ))}
              <label>Notas internas<textarea name="notes_internal" defaultValue={fieldValue('notes_internal')} /></label>
            </div>
          </section>

          <section hidden={step !== 4}>
            <p className="eyebrow">Etapa 5</p>
            <h2>Revisar antes de guardar</h2>
            <p className="meta">Después de crear la ficha podrás editar sus secciones desde la ficha administrativa. Los nombramientos y eventos se registran por separado para conservar historial.</p>

            <div className="admin-review-grid">
              <div className="card compact-section"><span>Persona</span><strong>{namePreview || 'Sin nombre visible'}</strong><small>{mode === 'existing-deacon' ? 'Se completará la ficha existente' : 'Se creará una ficha nueva'}</small><button type="button" onClick={() => setStep(0)}>Cambiar</button></div>
              <div className="card compact-section"><span>Tipo</span><strong>{priestType === 'religious' ? 'Sacerdote religioso' : 'Sacerdote diocesano'}</strong><small>{priestType === 'religious' ? fieldValue('religious_institute_name') || 'Instituto pendiente' : incardination?.direct_entity_name || 'Incardinación pendiente'}</small><button type="button" onClick={() => setStep(2)}>Cambiar</button></div>
              <div className="card compact-section"><span>Ordenación</span><strong>{fieldValue('priestly_ordination_date') || 'Fecha no identificada'}</strong><small>Estado: {fieldValue('canonical_status', 'active')}</small><button type="button" onClick={() => setStep(2)}>Cambiar</button></div>
              <div className="card compact-section"><span>Servicio</span><strong>{service?.direct_entity_name ?? 'Sin servicio actual'}</strong><small>{quickOfficeConfigId ? filteredOfficeConfigs.find((office) => office.id === quickOfficeConfigId)?.display_name ?? 'Cargo seleccionado' : 'Sin cargo actual'}</small><button type="button" onClick={() => setStep(3)}>Cambiar</button></div>
            </div>
          </section>

          <div className="admin-form-grid admin-wizard-actions">
            <button className="button button-secondary" type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>Anterior</button>
            <span>Paso {step + 1} de {wizardSteps.length}</span>
            {step < wizardSteps.length - 1 ? (
              <button className="button button-primary" type="button" onClick={goNext}>Continuar</button>
            ) : (
              <button className="button button-primary" disabled={saving} type="submit">{saving ? 'Guardando...' : 'Crear sacerdote'}</button>
            )}
          </div>
        </form>

        <SmartContextPanel title="Ayuda contextual">
          <div className="admin-context-block"><span>Completitud inicial</span><strong>{completedCount} de {completionItems.length} elementos</strong></div>
          {completionItems.map((item) => <div className="admin-context-block" key={item.label}><span>{item.label}</span><strong>{item.complete ? 'Completo' : 'Pendiente'}</strong></div>)}
          <div className="admin-context-block"><span>Entidad del cargo</span><strong>{quickEntity?.direct_entity_name ?? 'No seleccionada'}</strong></div>
          <div className="admin-context-block"><span>Borrador</span><strong>Guardado automáticamente</strong></div>
        </SmartContextPanel>
      </div>
    </main>
  )
}
