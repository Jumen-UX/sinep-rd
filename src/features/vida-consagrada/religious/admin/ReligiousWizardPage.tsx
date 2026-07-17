'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AdminWizardProgress from '@/components/admin/AdminWizardProgress'
import type { EntityHierarchyEntity } from '@/components/admin/EntityHierarchyPicker'
import { PersonIdentityStep } from '@/features/personas/shared/components/PersonIdentityStep'
import { createClient } from '@/lib/supabase/client'
import {
  loadAllowedOfficeIds,
  loadReligiousCatalogs,
  removeReligiousPhoto,
  saveReligious,
  uploadReligiousPhoto,
  type OfficeConfig,
  type ReligiousCandidate,
  type ReligiousLifeType,
  type UploadedReligiousPhoto,
} from '../services/religious-admin-service'

const wizardSteps = [
  { label: 'Tipo', description: 'Forma de vida consagrada' },
  { label: 'Origen', description: 'Reutilizar o crear identidad' },
  { label: 'Identidad', description: 'Datos personales y contacto' },
  { label: 'Vida consagrada', description: 'Comunidad, profesión y estado' },
  { label: 'Servicio', description: 'Responsabilidad, cargo y visibilidad' },
  { label: 'Revisión', description: 'Completitud y guardado' },
]

const optionalFields = [
  { key: 'gender', label: 'Género', newOnly: true },
  { key: 'birth_date', label: 'Fecha de nacimiento', newOnly: true },
  { key: 'birth_place', label: 'Lugar de nacimiento', newOnly: true },
  { key: 'biography_public', label: 'Biografía pública', newOnly: true },
  { key: 'community_name', label: 'Comunidad religiosa', newOnly: false },
  { key: 'profession_date', label: 'Profesión religiosa', newOnly: false },
  {
    key: 'current_service_entity_id',
    label: 'Servicio actual',
    newOnly: false,
  },
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
  return [
    form.get('first_name'),
    form.get('middle_name'),
    form.get('last_name'),
    form.get('second_last_name'),
  ]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

function religiousTypeLabel(value: ReligiousLifeType) {
  if (value === 'priest') return 'Sacerdote religioso'
  if (value === 'brother') return 'Religioso no ordenado'
  if (value === 'sister') return 'Religiosa'
  if (value === 'consecrated_lay') return 'Consagrado/a laico/a'
  return 'Religioso/a'
}

export default function ReligiousWizardPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [savedSlug, setSavedSlug] = useState<string | null>(null)
  const [savedInternalCode, setSavedInternalCode] = useState<string | null>(
    null,
  )
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [candidates, setCandidates] = useState<ReligiousCandidate[]>([])
  const [lifeType, setLifeType] = useState<ReligiousLifeType>('sister')
  const [entities, setEntities] = useState<EntityHierarchyEntity[]>([])
  const [officeConfigs, setOfficeConfigs] = useState<OfficeConfig[]>([])
  const [allowedOfficeIds, setAllowedOfficeIds] = useState<string[]>([])
  const [officeFilterMessage, setOfficeFilterMessage] = useState(
    'Selecciona la entidad del cargo para ver sus cargos permitidos.',
  )
  const [serviceId, setServiceId] = useState('')
  const [quickEntityId, setQuickEntityId] = useState('')
  const [quickOfficeConfigId, setQuickOfficeConfigId] = useState('')
  const [assignmentVisibility, setAssignmentVisibility] = useState<
    'internal' | 'public' | 'private'
  >('internal')

  const selectedPerson = candidates.find(
    (item) => item.id === selectedPersonId,
  )
  const service = entities.find((item) => item.direct_entity_id === serviceId)
  const quickEntity = entities.find(
    (item) => item.direct_entity_id === quickEntityId,
  )
  const filteredOfficeConfigs = quickEntityId
    ? officeConfigs.filter((office) => allowedOfficeIds.includes(office.id))
    : []
  const selectedOffice = filteredOfficeConfigs.find(
    (office) => office.id === quickOfficeConfigId,
  )

  useEffect(() => {
    async function loadData() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/admin/login')
        return
      }

      try {
        const catalogs = await loadReligiousCatalogs(supabase)
        setEntities(catalogs.entities)
        setOfficeConfigs(catalogs.offices)
        setCandidates(catalogs.candidates)
        if (catalogs.candidates.length === 0) setMode('new')
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'No se pudieron cargar los catálogos.',
        )
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
        setOfficeFilterMessage(
          'Selecciona la entidad del cargo para ver sus cargos permitidos.',
        )
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
        setOfficeFilterMessage(
          officeError instanceof Error
            ? officeError.message
            : 'No se pudieron cargar los cargos permitidos.',
        )
      }
    }

    loadOffices()
  }, [quickEntityId, supabase])

  useEffect(() => {
    if (
      quickOfficeConfigId &&
      !filteredOfficeConfigs.some((office) => office.id === quickOfficeConfigId)
    ) {
      setQuickOfficeConfigId('')
    }
  }, [filteredOfficeConfigs, quickOfficeConfigId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (lifeType === 'priest') {
      router.push('/admin/nuevo/sacerdote')
      return
    }

    if (mode === 'existing' && !selectedPersonId) {
      setError('Selecciona la persona a la que se añadirá la vida consagrada.')
      setStep(1)
      return
    }

    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const firstName =
      mode === 'existing'
        ? (selectedPerson?.first_name ?? '')
        : String(form.get('first_name') ?? '').trim()
    const lastName =
      mode === 'existing'
        ? (selectedPerson?.last_name ?? '')
        : String(form.get('last_name') ?? '').trim()
    const displayName =
      mode === 'existing'
        ? (selectedPerson?.display_name ?? '')
        : buildDisplayName(form)
    const slug =
      mode === 'existing' ? (selectedPerson?.slug ?? '') : slugify(displayName)

    if (mode === 'new' && (!firstName || !lastName || !displayName || !slug)) {
      setError('Primer nombre y primer apellido son obligatorios.')
      setStep(2)
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)
    setSavedSlug(null)
    setSavedInternalCode(null)

    let uploadedPhoto: UploadedReligiousPhoto | null = null

    try {
      const photoFile =
        mode === 'new' && form.get('photo_file') instanceof File
          ? (form.get('photo_file') as File)
          : null
      uploadedPhoto = photoFile
        ? await uploadReligiousPhoto(supabase, photoFile, slug)
        : { photo_url: null, photo_path: null }

      const payload = {
        mode,
        selected_person_id: mode === 'existing' ? selectedPersonId : null,
        religious_life_type: lifeType,
        first_name: firstName,
        middle_name:
          mode === 'existing'
            ? (selectedPerson?.middle_name ?? null)
            : emptyToNull(form.get('middle_name')),
        last_name: lastName,
        second_last_name:
          mode === 'existing'
            ? (selectedPerson?.second_last_name ?? null)
            : emptyToNull(form.get('second_last_name')),
        display_name: displayName,
        slug,
        gender: mode === 'existing' ? null : emptyToNull(form.get('gender')),
        birth_date:
          mode === 'existing' ? null : emptyToNull(form.get('birth_date')),
        birth_place:
          mode === 'existing' ? null : emptyToNull(form.get('birth_place')),
        photo_url: uploadedPhoto.photo_url,
        photo_path: uploadedPhoto.photo_path,
        biography_public:
          mode === 'existing'
            ? null
            : emptyToNull(form.get('biography_public')),
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
        community_name: emptyToNull(form.get('community_name')),
        province_name: emptyToNull(form.get('province_name')),
        profession_date: emptyToNull(form.get('profession_date')),
        canonical_status: emptyToNull(form.get('canonical_status')),
        current_service_entity_id: emptyToNull(
          form.get('current_service_entity_id'),
        ),
        religious_notes: emptyToNull(form.get('religious_notes')),
        quick_office_configuration_id: quickOfficeConfigId || null,
        quick_title_override: emptyToNull(form.get('quick_title_override')),
        quick_entity_id: emptyToNull(form.get('quick_entity_id')),
        quick_start_date: emptyToNull(form.get('quick_start_date')),
        quick_notes_public: emptyToNull(form.get('quick_notes_public')),
        assignment_visibility: assignmentVisibility,
        not_identified_fields: form
          .getAll('not_identified_fields')
          .map(String),
      }

      const data = await saveReligious(payload)
      setSavedSlug(data.slug ?? slug)
      setSavedInternalCode(data.internal_reference_code ?? null)
      setMessage(
        mode === 'existing'
          ? `Vida consagrada añadida a la ficha de ${selectedPerson?.display_name ?? 'la persona'} sin duplicar su identidad.`
          : `${religiousTypeLabel(lifeType)} creado correctamente.`,
      )
      formElement.reset()
      setSelectedPersonId('')
      setServiceId('')
      setQuickEntityId('')
      setQuickOfficeConfigId('')
      setAssignmentVisibility('internal')
      setStep(0)
    } catch (saveError) {
      await removeReligiousPhoto(supabase, uploadedPhoto?.photo_path)
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'No se pudo guardar la vida consagrada.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="container">
        <div className="empty-state" role="status" aria-live="polite">
          Cargando asistente...
        </div>
      </main>
    )
  }

  return (
    <main
      aria-busy={saving}
      aria-labelledby="religious-wizard-title"
      className="container dashboard-page admin-config-page"
    >
      <div className="detail-backlink">
        <Link href="/admin/nuevo">← Volver a agregar nueva ficha</Link>
      </div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Vida consagrada</p>
          <h1 id="religious-wizard-title">Registrar vida consagrada</h1>
          <p className="lead">
            Busca primero a la persona. La pertenencia religiosa se añade a su
            identidad y puede coexistir con cualquier grado del Orden.
          </p>
        </div>
      </section>

      {error ? (
        <div
          className="error-box"
          id="religious-wizard-error"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          className="empty-state"
          role="status"
          aria-atomic="true"
          aria-live="polite"
        >
          <strong>{message}</strong>
          {savedInternalCode ? (
            <span>Código interno administrativo: {savedInternalCode}</span>
          ) : null}
          {savedSlug ? (
            <Link href={`/personas/${savedSlug}`}>Ver ficha pública</Link>
          ) : null}
        </div>
      ) : null}

      <div className="admin-wizard-layout">
        <AdminWizardProgress
          steps={wizardSteps}
          currentStep={step}
          maxReachableStep={
            lifeType === 'priest' ? 0 : wizardSteps.length - 1
          }
          onStepChange={setStep}
        />

        <form
          aria-busy={saving}
          aria-describedby={error ? 'religious-wizard-error' : undefined}
          className="admin-form admin-config-form card dashboard-section admin-wizard-form"
          onSubmit={handleSubmit}
        >
          <section hidden={step !== 0}>
            <p className="eyebrow">Etapa 1</p>
            <h2>Tipo de vida consagrada</h2>
            <div
              className="dashboard-grid dashboard-summary"
              role="group"
              aria-label="Tipo de vida consagrada"
            >
              <button
                aria-pressed={lifeType === 'sister'}
                className={`metric-card metric-button ${lifeType === 'sister' ? 'active-filter' : ''}`}
                type="button"
                onClick={() => setLifeType('sister')}
              >
                <strong>Religiosa</strong>
                <span>Hermana o monja.</span>
              </button>
              <button
                aria-pressed={lifeType === 'brother'}
                className={`metric-card metric-button ${lifeType === 'brother' ? 'active-filter' : ''}`}
                type="button"
                onClick={() => setLifeType('brother')}
              >
                <strong>Religioso</strong>
                <span>Hermano no ordenado.</span>
              </button>
              <button
                aria-pressed={lifeType === 'consecrated_lay'}
                className={`metric-card metric-button ${lifeType === 'consecrated_lay' ? 'active-filter' : ''}`}
                type="button"
                onClick={() => setLifeType('consecrated_lay')}
              >
                <strong>Consagrado/a</strong>
                <span>Persona consagrada laica.</span>
              </button>
              <button
                aria-pressed={lifeType === 'priest'}
                className={`metric-card metric-button ${lifeType === 'priest' ? 'active-filter' : ''}`}
                type="button"
                onClick={() => {
                  setLifeType('priest')
                  setStep(0)
                }}
              >
                <strong>Sacerdote religioso</strong>
                <span>Se registra desde el asistente de sacerdote.</span>
              </button>
            </div>
            {lifeType === 'priest' ? (
              <div className="empty-state" role="status" aria-live="polite">
                <strong>Usar flujo de sacerdote</strong>
                <span>
                  Ese asistente registra el presbiterado y la vida consagrada
                  sobre la misma persona.
                </span>
              </div>
            ) : null}
          </section>

          <section hidden={step !== 1}>
            <p className="eyebrow">Etapa 2</p>
            <h2>Origen de la identidad</h2>
            <PersonIdentityStep
              mode={mode}
              onModeChange={setMode}
              selectedPersonId={selectedPersonId}
              onSelectedPersonChange={setSelectedPersonId}
              people={candidates}
              existingActionLabel="Añadir vida consagrada a una identidad existente."
              newActionLabel="Crear una sola identidad y su perfil de vida consagrada."
              selectPlaceholder="Selecciona una persona sin perfil de vida consagrada"
              existingSummary="Se conservarán su identidad, ordenaciones, cargos y código interno."
            />
          </section>

          <section hidden={step !== 2}>
            <p className="eyebrow">Etapa 3</p>
            <h2>Identidad, documentos y biografía</h2>

            {mode === 'existing' ? (
              <div className="empty-state" role="status" aria-live="polite">
                <strong>
                  {selectedPerson?.display_name ?? 'Persona no seleccionada'}
                </strong>
                <span>
                  Se conservará la identidad existente y se añadirá únicamente
                  el perfil de vida consagrada.
                </span>
              </div>
            ) : (
              <fieldset className="person-option-fieldset">
                <legend>Identificación básica</legend>
                <div className="admin-form-fields-grid">
                  <label>
                    Primer nombre
                    <input autoComplete="given-name" name="first_name" />
                  </label>
                  <label>
                    Segundo nombre
                    <input autoComplete="additional-name" name="middle_name" />
                  </label>
                  <label>
                    Primer apellido
                    <input autoComplete="family-name" name="last_name" />
                  </label>
                  <label>
                    Segundo apellido
                    <input name="second_last_name" />
                  </label>
                  <label>
                    Género
                    <select
                      key={lifeType}
                      name="gender"
                      defaultValue={
                        lifeType === 'sister'
                          ? 'female'
                          : lifeType === 'brother'
                            ? 'male'
                            : ''
                      }
                    >
                      <option value="">Género no indicado</option>
                      <option value="male">Masculino</option>
                      <option value="female">Femenino</option>
                      <option value="unknown">No identificado</option>
                    </select>
                  </label>
                  <label>
                    Fecha de nacimiento
                    <input
                      autoComplete="bday"
                      name="birth_date"
                      type="date"
                    />
                  </label>
                  <label>
                    Lugar de nacimiento
                    <input name="birth_place" />
                  </label>
                  <label>
                    Fotografía
                    <input
                      name="photo_file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                    />
                  </label>
                </div>
              </fieldset>
            )}

            <fieldset className="person-option-fieldset">
              <legend>Documentos y contactos internos</legend>
              <div className="admin-form-fields-grid">
                <label>
                  Tipo de documento
                  <select name="validation_type" defaultValue="">
                    <option value="">Sin documento por ahora</option>
                    <option value="cedula">Cédula</option>
                    <option value="passport">Pasaporte</option>
                    <option value="other">Otro documento</option>
                  </select>
                </label>
                <label>
                  Número del documento
                  <input name="validation_value" />
                </label>
                <label>
                  País del documento
                  <input
                    name="validation_country"
                    defaultValue="República Dominicana"
                  />
                </label>
                <label>
                  Teléfono principal
                  <input autoComplete="tel" name="primary_phone" />
                </label>
                <label>
                  Teléfono alterno
                  <input name="secondary_phone" />
                </label>
                <label>
                  Correo de contacto
                  <input
                    autoComplete="email"
                    name="contact_email"
                    type="email"
                  />
                </label>
              </div>
              <p className="meta">
                Estos datos son privados y no aparecen en la ficha pública.
              </p>
            </fieldset>

            {mode === 'new' ? (
              <fieldset className="person-option-fieldset">
                <legend>Familia y biografía</legend>
                <div className="admin-form-fields-grid">
                  <label>
                    Nombre del padre
                    <input name="father_name" />
                  </label>
                  <label>
                    Nombre de la madre
                    <input name="mother_name" />
                  </label>
                </div>
                <label>
                  Notas familiares
                  <textarea name="family_notes" />
                </label>
                <label>
                  Apuntes internos para la biografía
                  <textarea name="biography_notes" />
                </label>
                <label>
                  Biografía pública
                  <textarea name="biography_public" />
                </label>
              </fieldset>
            ) : null}
          </section>

          <section hidden={step !== 3}>
            <p className="eyebrow">Etapa 4</p>
            <h2>Comunidad, profesión y estado canónico</h2>
            <div className="admin-form-fields-grid">
              <label>
                Congregación, orden, instituto o comunidad
                <input name="community_name" />
              </label>
              <label>
                Provincia religiosa
                <input name="province_name" />
              </label>
              <label>
                Profesión religiosa
                <input name="profession_date" type="date" />
              </label>
              <label>
                Estado canónico
                <select name="canonical_status" defaultValue="active">
                  <option value="active">Activo/a</option>
                  <option value="retired">Retirado/a</option>
                  <option value="transferred">Trasladado/a</option>
                  <option value="deceased">Fallecido/a</option>
                  <option value="unknown">No identificado</option>
                </select>
              </label>
            </div>
            <label>
              Notas internas de vida religiosa
              <textarea name="religious_notes" />
            </label>
          </section>

          <section hidden={step !== 4}>
            <p className="eyebrow">Etapa 5</p>
            <h2>Servicio actual, cargo y visibilidad</h2>

            <label>
              Entidad donde sirve actualmente
              <select
                name="current_service_entity_id"
                value={serviceId}
                onChange={(event) => {
                  const value = event.target.value
                  setServiceId(value)
                  setQuickEntityId(value)
                }}
              >
                <option value="">Sin servicio actual por ahora</option>
                {entities.map((entity) => (
                  <option
                    key={entity.direct_entity_id}
                    value={entity.direct_entity_id}
                  >
                    {entity.direct_entity_name} ·{' '}
                    {entity.direct_entity_type_name ?? 'Entidad'}
                  </option>
                ))}
              </select>
            </label>
            <div
              className="empty-state"
              role="status"
              aria-atomic="true"
              aria-live="polite"
            >
              <strong>Servicio actual seleccionado</strong>
              <span>
                {service?.hierarchy_path ??
                  service?.direct_entity_name ??
                  'Selecciona la entidad donde sirve.'}
              </span>
            </div>

            <fieldset className="person-option-fieldset">
              <legend>Asignación de cargo opcional</legend>
              <label>
                Entidad del cargo
                <select
                  name="quick_entity_id"
                  value={quickEntityId}
                  onChange={(event) => setQuickEntityId(event.target.value)}
                >
                  <option value="">
                    Usar entidad del servicio actual o dejar sin entidad
                  </option>
                  {entities.map((entity) => (
                    <option
                      key={entity.direct_entity_id}
                      value={entity.direct_entity_id}
                    >
                      {entity.direct_entity_name} ·{' '}
                      {entity.direct_entity_type_name ?? 'Entidad'}
                    </option>
                  ))}
                </select>
              </label>
              <div
                className="empty-state"
                role="status"
                aria-atomic="true"
                aria-live="polite"
              >
                <strong>Entidad del cargo seleccionada</strong>
                <span>
                  {quickEntity?.hierarchy_path ??
                    quickEntity?.direct_entity_name ??
                    service?.hierarchy_path ??
                    service?.direct_entity_name ??
                    'Selecciona la entidad del cargo.'}
                </span>
              </div>
              <label>
                Cargo actual
                <select
                  name="quick_office_configuration_id"
                  value={quickOfficeConfigId}
                  onChange={(event) =>
                    setQuickOfficeConfigId(event.target.value)
                  }
                  disabled={
                    !quickEntityId || filteredOfficeConfigs.length === 0
                  }
                >
                  <option value="">Sin cargo actual por ahora</option>
                  {filteredOfficeConfigs.map((office) => (
                    <option key={office.id} value={office.id}>
                      {office.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="meta" role="status" aria-live="polite">
                {officeFilterMessage}
              </p>
              <div className="admin-form-fields-grid">
                <label>
                  Título para mostrar
                  <input name="quick_title_override" />
                </label>
                <label>
                  Fecha de inicio
                  <input name="quick_start_date" type="date" />
                </label>
                <label>
                  Visibilidad del servicio
                  <select
                    value={assignmentVisibility}
                    onChange={(event) =>
                      setAssignmentVisibility(
                        event.target.value as
                          | 'internal'
                          | 'public'
                          | 'private',
                      )
                    }
                  >
                    <option value="internal">
                      Interno: visible solo en administración
                    </option>
                    <option value="public">
                      Público: visible en directorios
                    </option>
                    <option value="private">
                      Privado: visible solo para control interno
                    </option>
                  </select>
                </label>
              </div>
              <label>
                Notas visibles del cargo si se publica
                <textarea name="quick_notes_public" />
              </label>
            </fieldset>
          </section>

          <section hidden={step !== 5}>
            <p className="eyebrow">Etapa 6</p>
            <h2>Revisar completitud y guardar</h2>
            <div
              className="admin-review-grid"
              aria-label="Resumen del registro de vida consagrada"
            >
              <article className="card compact-section">
                <span>Persona</span>
                <strong>
                  {selectedPerson?.display_name ??
                    (mode === 'new' ? 'Nueva identidad' : 'Sin seleccionar')}
                </strong>
                <small>
                  {mode === 'existing'
                    ? 'Se reutilizará la ficha existente'
                    : 'Se creará una ficha nueva'}
                </small>
                <button type="button" onClick={() => setStep(1)}>
                  Cambiar
                </button>
              </article>
              <article className="card compact-section">
                <span>Tipo</span>
                <strong>{religiousTypeLabel(lifeType)}</strong>
                <small>Forma de vida consagrada</small>
                <button type="button" onClick={() => setStep(0)}>
                  Cambiar
                </button>
              </article>
              <article className="card compact-section">
                <span>Servicio</span>
                <strong>
                  {service?.direct_entity_name ?? 'Sin servicio actual'}
                </strong>
                <small>
                  {selectedOffice?.display_name ?? 'Sin cargo actual'}
                </small>
                <button type="button" onClick={() => setStep(4)}>
                  Cambiar
                </button>
              </article>
            </div>

            <fieldset className="person-option-fieldset">
              <legend>Datos buscados y no encontrados</legend>
              <div className="person-option-list person-option-list--choices">
                {optionalFields
                  .filter((field) => mode === 'new' || !field.newOnly)
                  .map((field) => (
                    <label key={field.key} className="role-pill">
                      <input
                        type="checkbox"
                        name="not_identified_fields"
                        value={field.key}
                      />
                      <span>{field.label}</span>
                    </label>
                  ))}
              </div>
            </fieldset>

            <label>
              Notas internas de carga o verificación
              <textarea name="notes_internal" />
            </label>
          </section>

          <div
            className="admin-form-grid admin-wizard-actions"
            role="group"
            aria-label="Navegación y guardado del asistente"
          >
            <button
              className="button button-secondary"
              disabled={step === 0 || saving}
              type="button"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
            >
              Anterior
            </button>
            <span aria-live="polite">
              Paso {step + 1} de {wizardSteps.length}
            </span>
            {lifeType === 'priest' && step === 0 ? (
              <button
                className="button button-primary"
                disabled={saving}
                type="submit"
              >
                Ir al flujo de sacerdote
              </button>
            ) : step < wizardSteps.length - 1 ? (
              <button
                className="button button-primary"
                disabled={saving}
                type="button"
                onClick={() =>
                  setStep((current) =>
                    Math.min(wizardSteps.length - 1, current + 1),
                  )
                }
              >
                Continuar
              </button>
            ) : (
              <button
                className="button button-primary"
                aria-busy={saving}
                disabled={saving}
                type="submit"
              >
                {saving
                  ? 'Guardando...'
                  : `Guardar ${religiousTypeLabel(lifeType).toLowerCase()}`}
              </button>
            )}
          </div>
        </form>
      </div>
    </main>
  )
}
