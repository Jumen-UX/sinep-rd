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
  loadDeaconCatalogs,
  removeDeaconPhoto,
  saveDeacon,
  uploadDeaconPhoto,
  type DeaconType,
  type OfficeConfig,
  type UnordainedPersonOption,
  type UploadedDeaconPhoto,
} from '../services/deacon-admin-service'

const wizardSteps = [
  { label: 'Origen', description: 'Reutilizar o crear identidad' },
  { label: 'Tipo', description: 'Clasificación del diaconado' },
  { label: 'Identidad', description: 'Datos personales y contacto' },
  { label: 'Ordenación', description: 'Fecha y estado clerical' },
  { label: 'Servicio', description: 'Incardinación y cargo actual' },
  { label: 'Revisión', description: 'Completitud y guardado' },
]

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
  const [step, setStep] = useState(0)
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
  const [officeFilterMessage, setOfficeFilterMessage] = useState(
    'Selecciona la entidad del cargo para ver sus cargos permitidos.',
  )
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
  const selectedOffice = filteredOfficeConfigs.find((office) => office.id === quickOfficeConfigId)

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
      quickOfficeConfigId
      && !filteredOfficeConfigs.some((office) => office.id === quickOfficeConfigId)
    ) {
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
      setStep(0)
      return
    }

    if (mode === 'new' && (!firstName || !lastName || !displayName || !slug)) {
      setError('Primer nombre y primer apellido son obligatorios.')
      setSaving(false)
      setStep(2)
      return
    }

    let uploadedPhoto: UploadedDeaconPhoto | null = null

    try {
      const photoFile = mode === 'new' && form.get('photo_file') instanceof File
        ? form.get('photo_file') as File
        : null
      uploadedPhoto = photoFile
        ? await uploadDeaconPhoto(supabase, photoFile, slug)
        : { photo_url: null, photo_path: null }
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
      setStep(0)
    } catch (saveError) {
      await removeDeaconPhoto(supabase, uploadedPhoto?.photo_path)
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el diácono.')
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
      aria-labelledby="deacon-wizard-title"
      className="container dashboard-page admin-config-page"
    >
      <div className="detail-backlink">
        <Link href="/admin/nuevo">← Volver a agregar nueva ficha</Link>
      </div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Inicio del historial clerical</p>
          <h1 id="deacon-wizard-title">Registrar diaconado</h1>
          <p className="lead">
            Busca primero la ficha de la persona. La ordenación diaconal se añade sobre esa misma
            identidad; solo crea una ficha nueva cuando la persona todavía no existe en SINEP RD.
          </p>
        </div>
      </section>

      {error ? (
        <div className="error-box" id="deacon-wizard-error" role="alert" aria-live="assertive">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="empty-state" role="status" aria-atomic="true" aria-live="polite">
          <strong>{message}</strong>
          {savedInternalCode ? <span>Código interno administrativo: {savedInternalCode}</span> : null}
          {savedSlug ? <Link href={`/personas/${savedSlug}`}>Ver ficha pública</Link> : null}
        </div>
      ) : null}

      <div className="admin-wizard-layout">
        <AdminWizardProgress
          steps={wizardSteps}
          currentStep={step}
          maxReachableStep={wizardSteps.length - 1}
          onStepChange={setStep}
        />

        <form
          aria-busy={saving}
          aria-describedby={error ? 'deacon-wizard-error' : undefined}
          className="admin-form admin-config-form card dashboard-section admin-wizard-form"
          onSubmit={handleSubmit}
        >
          <section hidden={step !== 0}>
            <p className="eyebrow">Etapa 1</p>
            <h2>Origen de la identidad</h2>
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
          </section>

          <section hidden={step !== 1}>
            <p className="eyebrow">Etapa 2</p>
            <h2>Tipo de diácono</h2>
            <div className="dashboard-grid dashboard-summary" role="group" aria-label="Tipo de diácono">
              <button
                aria-pressed={deaconType === 'permanent'}
                className={`metric-card metric-button ${deaconType === 'permanent' ? 'active-filter' : ''}`}
                type="button"
                onClick={() => setDeaconType('permanent')}
              >
                <strong>Permanente</strong>
                <span>No se asume que será sacerdote.</span>
              </button>
              <button
                aria-pressed={deaconType === 'transitional'}
                className={`metric-card metric-button ${deaconType === 'transitional' ? 'active-filter' : ''}`}
                type="button"
                onClick={() => setDeaconType('transitional')}
              >
                <strong>Transitorio</strong>
                <span>Queda listo para registrarlo luego como sacerdote.</span>
              </button>
              <button
                aria-pressed={deaconType === 'external'}
                className={`metric-card metric-button ${deaconType === 'external' ? 'active-filter' : ''}`}
                type="button"
                onClick={() => setDeaconType('external')}
              >
                <strong>Externo</strong>
                <span>Pertenece o viene de otra jurisdicción.</span>
              </button>
            </div>
            {deaconType === 'external' ? (
              <label>
                Jurisdicción externa o procedencia
                <input name="external_jurisdiction_name" />
              </label>
            ) : null}
          </section>

          <section hidden={step !== 2}>
            <p className="eyebrow">Etapa 3</p>
            <h2>Identidad, documentos y contacto</h2>

            {mode === 'existing' ? (
              <div className="empty-state" role="status" aria-live="polite">
                <strong>{selectedPerson?.display_name ?? 'Persona no seleccionada'}</strong>
                <span>Se conservará la identidad existente y solo se añadirá el historial diaconal.</span>
              </div>
            ) : (
              <>
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
                    Fecha de nacimiento
                    <input autoComplete="bday" name="birth_date" type="date" />
                  </label>
                  <label>
                    Lugar de nacimiento
                    <input name="birth_place" />
                  </label>
                </div>

                <fieldset className="clergy-option-fieldset">
                  <legend>Documento y contacto privado</legend>
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
                      <input name="validation_country" defaultValue="República Dominicana" />
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
                      <input autoComplete="email" name="contact_email" type="email" />
                    </label>
                  </div>
                  <p className="meta">Estos datos son privados y no aparecen en la ficha pública.</p>
                </fieldset>

                <fieldset className="clergy-option-fieldset">
                  <legend>Familia, biografía y fotografía</legend>
                  <div className="admin-form-fields-grid">
                    <label>
                      Nombre del padre
                      <input name="father_name" />
                    </label>
                    <label>
                      Nombre de la madre
                      <input name="mother_name" />
                    </label>
                    <label>
                      Fotografía
                      <input name="photo_file" type="file" accept="image/jpeg,image/png,image/webp" />
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
              </>
            )}
          </section>

          <section hidden={step !== 3}>
            <p className="eyebrow">Etapa 4</p>
            <h2>Ordenación y estado clerical</h2>
            <div className="admin-form-fields-grid">
              <label>
                Ordenación diaconal
                <input name="diaconal_ordination_date" type="date" />
              </label>
              <label>
                Orden o congregación, si aplica
                <input name="religious_order" />
              </label>
              <label>
                Estado canónico
                <select name="canonical_status" defaultValue="active">
                  <option value="active">Activo</option>
                  <option value="retired">Retirado</option>
                  <option value="suspended">Suspendido</option>
                  <option value="deceased">Fallecido</option>
                  <option value="unknown">No identificado</option>
                </select>
              </label>
            </div>
            <label>
              Notas internas del perfil clerical
              <textarea name="clergy_notes" />
            </label>
          </section>

          <section hidden={step !== 4}>
            <p className="eyebrow">Etapa 5</p>
            <h2>Incardinación, servicio y cargo actual</h2>

            <label>
              Incardinación
              <select
                name="incardination_entity_id"
                value={incardinationId}
                onChange={(event) => setIncardinationId(event.target.value)}
              >
                <option value="">Sin incardinación por ahora</option>
                {entities.map((entity) => (
                  <option key={entity.direct_entity_id} value={entity.direct_entity_id}>
                    {entity.direct_entity_name} · {entity.direct_entity_type_name ?? 'Entidad'}
                  </option>
                ))}
              </select>
            </label>
            <div className="empty-state" role="status" aria-atomic="true" aria-live="polite">
              <strong>Incardinación seleccionada</strong>
              <span>
                {incardination?.hierarchy_path
                  ?? incardination?.direct_entity_name
                  ?? 'Selecciona la jurisdicción si aplica.'}
              </span>
            </div>

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
                  <option key={entity.direct_entity_id} value={entity.direct_entity_id}>
                    {entity.direct_entity_name} · {entity.direct_entity_type_name ?? 'Entidad'}
                  </option>
                ))}
              </select>
            </label>
            <div className="empty-state" role="status" aria-atomic="true" aria-live="polite">
              <strong>Servicio actual seleccionado</strong>
              <span>
                {service?.hierarchy_path
                  ?? service?.direct_entity_name
                  ?? 'Selecciona parroquia, capilla, curia o entidad donde sirve.'}
              </span>
            </div>

            <fieldset className="clergy-option-fieldset">
              <legend>Asignación rápida opcional</legend>
              <label>
                Entidad del cargo
                <select
                  name="quick_entity_id"
                  value={quickEntityId}
                  onChange={(event) => setQuickEntityId(event.target.value)}
                >
                  <option value="">Selecciona primero la entidad del cargo</option>
                  {entities.map((entity) => (
                    <option key={entity.direct_entity_id} value={entity.direct_entity_id}>
                      {entity.direct_entity_name} · {entity.direct_entity_type_name ?? 'Entidad'}
                    </option>
                  ))}
                </select>
              </label>
              <div className="empty-state" role="status" aria-atomic="true" aria-live="polite">
                <strong>Entidad del cargo seleccionada</strong>
                <span>
                  {quickEntity?.hierarchy_path
                    ?? quickEntity?.direct_entity_name
                    ?? service?.hierarchy_path
                    ?? service?.direct_entity_name
                    ?? 'Selecciona la entidad del cargo.'}
                </span>
              </div>
              <label>
                Cargo actual
                <select
                  name="quick_office_configuration_id"
                  value={quickOfficeConfigId}
                  onChange={(event) => setQuickOfficeConfigId(event.target.value)}
                  disabled={!quickEntityId || filteredOfficeConfigs.length === 0}
                >
                  <option value="">Sin cargo actual por ahora</option>
                  {filteredOfficeConfigs.map((office) => (
                    <option key={office.id} value={office.id}>{office.display_name}</option>
                  ))}
                </select>
              </label>
              <p className="meta" role="status" aria-live="polite">{officeFilterMessage}</p>
              <div className="admin-form-fields-grid">
                <label>
                  Título para mostrar
                  <input name="quick_title_override" />
                </label>
                <label>
                  Fecha de inicio del cargo
                  <input name="quick_start_date" type="date" />
                </label>
              </div>
              <label>
                Notas visibles del cargo
                <textarea name="quick_notes_public" />
              </label>
            </fieldset>
          </section>

          <section hidden={step !== 5}>
            <p className="eyebrow">Etapa 6</p>
            <h2>Revisar completitud y guardar</h2>
            <div className="admin-review-grid" aria-label="Resumen del registro diaconal">
              <article className="card compact-section">
                <span>Persona</span>
                <strong>{selectedPerson?.display_name ?? (mode === 'new' ? 'Nueva identidad' : 'Sin seleccionar')}</strong>
                <small>{mode === 'existing' ? 'Se reutilizará la ficha existente' : 'Se creará una ficha nueva'}</small>
                <button type="button" onClick={() => setStep(0)}>Cambiar</button>
              </article>
              <article className="card compact-section">
                <span>Tipo</span>
                <strong>{deaconTypeLabel(deaconType)}</strong>
                <small>Clasificación del diaconado</small>
                <button type="button" onClick={() => setStep(1)}>Cambiar</button>
              </article>
              <article className="card compact-section">
                <span>Servicio</span>
                <strong>{service?.direct_entity_name ?? 'Sin servicio actual'}</strong>
                <small>{selectedOffice?.display_name ?? 'Sin cargo actual'}</small>
                <button type="button" onClick={() => setStep(4)}>Cambiar</button>
              </article>
            </div>

            <fieldset className="clergy-option-fieldset">
              <legend>Datos buscados y no encontrados</legend>
              <div className="clergy-option-list clergy-option-list--choices">
                {optionalFields.map((field) => (
                  <label key={field.key} className="role-pill">
                    <input type="checkbox" name="not_identified_fields" value={field.key} />
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
            <span aria-live="polite">Paso {step + 1} de {wizardSteps.length}</span>
            {step < wizardSteps.length - 1 ? (
              <button
                className="button button-primary"
                disabled={saving}
                type="button"
                onClick={() => setStep((current) => Math.min(wizardSteps.length - 1, current + 1))}
              >
                Continuar
              </button>
            ) : (
              <button className="button button-primary" aria-busy={saving} disabled={saving} type="submit">
                {saving
                  ? 'Guardando...'
                  : mode === 'existing'
                    ? 'Registrar ordenación diaconal'
                    : `Guardar ${deaconTypeLabel(deaconType).toLowerCase()}`}
              </button>
            )}
          </div>
        </form>
      </div>
    </main>
  )
}
