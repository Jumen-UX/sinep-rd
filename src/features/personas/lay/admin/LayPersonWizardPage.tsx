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
  loadLayPersonCatalogs,
  removeLayPersonPhoto,
  saveLayPerson,
  uploadLayPersonPhoto,
  type LayPersonCandidate,
  type OfficeConfig,
  type UploadedLayPersonPhoto,
} from '../services/lay-person-admin-service'

const wizardSteps = [
  { label: 'Origen', description: 'Reutilizar o crear identidad' },
  { label: 'Identidad', description: 'Datos personales y contacto' },
  { label: 'Biografía', description: 'Familia, foto y perfil público' },
  { label: 'Servicio', description: 'Responsabilidad y visibilidad' },
  { label: 'Revisión', description: 'Completitud y guardado' },
]

const optionalFields = [
  { key: 'gender', label: 'Género' },
  { key: 'birth_date', label: 'Fecha de nacimiento' },
  { key: 'birth_place', label: 'Lugar de nacimiento' },
  { key: 'biography_public', label: 'Biografía pública' },
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

export default function LayPersonWizardPage() {
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
  const [candidates, setCandidates] = useState<LayPersonCandidate[]>([])
  const [entities, setEntities] = useState<EntityHierarchyEntity[]>([])
  const [officeConfigs, setOfficeConfigs] = useState<OfficeConfig[]>([])
  const [allowedOfficeIds, setAllowedOfficeIds] = useState<string[]>([])
  const [officeFilterMessage, setOfficeFilterMessage] = useState(
    'Selecciona la entidad del servicio para ver sus cargos permitidos.',
  )
  const [quickEntityId, setQuickEntityId] = useState('')
  const [quickOfficeConfigId, setQuickOfficeConfigId] = useState('')
  const [assignmentVisibility, setAssignmentVisibility] = useState<'internal' | 'public' | 'private'>('internal')

  const selectedPerson = candidates.find((item) => item.id === selectedPersonId)
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
        const catalogs = await loadLayPersonCatalogs(supabase)
        setEntities(catalogs.entities)
        setOfficeConfigs(catalogs.offices)
        setCandidates(catalogs.candidates)
        if (catalogs.candidates.length === 0) setMode('new')
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
        setOfficeFilterMessage('Selecciona la entidad del servicio para ver sus cargos permitidos.')
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

    if (mode === 'existing' && !selectedPersonId) {
      setError('Selecciona la persona que deseas reutilizar.')
      setStep(0)
      return
    }

    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const firstName = mode === 'existing'
      ? selectedPerson?.first_name ?? ''
      : String(form.get('first_name') ?? '').trim()
    const lastName = mode === 'existing'
      ? selectedPerson?.last_name ?? ''
      : String(form.get('last_name') ?? '').trim()
    const displayName = mode === 'existing'
      ? selectedPerson?.display_name ?? ''
      : buildDisplayName(form)
    const slug = mode === 'existing' ? selectedPerson?.slug ?? '' : slugify(displayName)

    if (mode === 'new' && (!firstName || !lastName || !displayName || !slug)) {
      setError('Primer nombre y primer apellido son obligatorios.')
      setStep(1)
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)
    setSavedSlug(null)
    setSavedInternalCode(null)

    let uploadedPhoto: UploadedLayPersonPhoto | null = null

    try {
      const photoFile = mode === 'new' && form.get('photo_file') instanceof File
        ? form.get('photo_file') as File
        : null
      uploadedPhoto = photoFile
        ? await uploadLayPersonPhoto(supabase, photoFile, slug)
        : { photo_url: null, photo_path: null }

      const payload = {
        mode,
        selected_person_id: mode === 'existing' ? selectedPersonId : null,
        first_name: firstName,
        middle_name: mode === 'existing'
          ? selectedPerson?.middle_name ?? null
          : emptyToNull(form.get('middle_name')),
        last_name: lastName,
        second_last_name: mode === 'existing'
          ? selectedPerson?.second_last_name ?? null
          : emptyToNull(form.get('second_last_name')),
        display_name: displayName,
        slug,
        gender: mode === 'existing' ? null : emptyToNull(form.get('gender')),
        birth_date: mode === 'existing' ? null : emptyToNull(form.get('birth_date')),
        birth_place: mode === 'existing' ? null : emptyToNull(form.get('birth_place')),
        photo_url: uploadedPhoto.photo_url,
        photo_path: uploadedPhoto.photo_path,
        biography_public: mode === 'existing' ? null : emptyToNull(form.get('biography_public')),
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
        quick_office_configuration_id: quickOfficeConfigId || null,
        quick_title_override: emptyToNull(form.get('quick_title_override')),
        quick_entity_id: emptyToNull(form.get('quick_entity_id')),
        quick_start_date: emptyToNull(form.get('quick_start_date')),
        quick_notes_public: emptyToNull(form.get('quick_notes_public')),
        assignment_visibility: assignmentVisibility,
        not_identified_fields: form.getAll('not_identified_fields').map(String),
      }

      const data = await saveLayPerson(payload)
      setSavedSlug(data.slug ?? slug)
      setSavedInternalCode(data.internal_reference_code ?? null)
      setMessage(
        mode === 'existing'
          ? `Se reutilizó la ficha de ${selectedPerson?.display_name ?? 'la persona'} sin crear una identidad duplicada.`
          : 'Persona laica creada correctamente.',
      )
      formElement.reset()
      setSelectedPersonId('')
      setQuickEntityId('')
      setQuickOfficeConfigId('')
      setAssignmentVisibility('internal')
      setStep(0)
    } catch (saveError) {
      await removeLayPersonPhoto(supabase, uploadedPhoto?.photo_path)
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la persona laica.')
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
      aria-labelledby="lay-wizard-title"
      className="container dashboard-page admin-config-page"
    >
      <div className="detail-backlink">
        <Link href="/admin/nuevo">← Volver a agregar nueva ficha</Link>
      </div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Persona</p>
          <h1 id="lay-wizard-title">Registrar persona laica</h1>
          <p className="lead">
            Busca primero la persona. La condición laical se deriva de que no tiene ordenaciones;
            no constituye un tipo que deba reemplazarse cuando su historial cambie.
          </p>
        </div>
      </section>

      {error ? (
        <div className="error-box" id="lay-wizard-error" role="alert" aria-live="assertive">
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
          aria-describedby={error ? 'lay-wizard-error' : undefined}
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
              people={candidates}
              existingActionLabel="Reutilizar su identidad para contacto o servicio."
              newActionLabel="Crear una identidad nueva."
              selectPlaceholder="Selecciona una persona sin ordenaciones"
              existingSummary="Se conservarán el slug, código interno y todos sus datos e historiales existentes."
            />
          </section>

          <section hidden={step !== 1}>
            <p className="eyebrow">Etapa 2</p>
            <h2>Identidad, documentos y contacto</h2>

            {mode === 'existing' ? (
              <div className="empty-state" role="status" aria-live="polite">
                <strong>{selectedPerson?.display_name ?? 'Persona no seleccionada'}</strong>
                <span>Se conservará la identidad existente y se actualizarán únicamente los datos enviados.</span>
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
                    <select name="gender" defaultValue="">
                      <option value="">Género no indicado</option>
                      <option value="male">Masculino</option>
                      <option value="female">Femenino</option>
                      <option value="unknown">No identificado</option>
                    </select>
                  </label>
                </div>
                <p className="meta">
                  La identidad no cambiará si posteriormente se registra una ordenación o vida consagrada.
                </p>
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
          </section>

          <section hidden={step !== 2}>
            <p className="eyebrow">Etapa 3</p>
            <h2>Nacimiento, familia, foto y biografía</h2>

            {mode === 'existing' ? (
              <div className="empty-state" role="status" aria-live="polite">
                <strong>Identidad existente</strong>
                <span>Los datos biográficos actuales se conservarán sin reemplazarlos desde este registro.</span>
              </div>
            ) : (
              <>
                <div className="admin-form-fields-grid">
                  <label>
                    Fecha de nacimiento
                    <input autoComplete="bday" name="birth_date" type="date" />
                  </label>
                  <label>
                    Lugar de nacimiento
                    <input name="birth_place" />
                  </label>
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
                  Apuntes internos para preparar la biografía
                  <textarea name="biography_notes" />
                </label>
                <label>
                  Biografía pública
                  <textarea name="biography_public" />
                </label>
              </>
            )}
          </section>

          <section hidden={step !== 3}>
            <p className="eyebrow">Etapa 4</p>
            <h2>Cargo o servicio actual opcional</h2>
            <p className="meta">
              Úsalo para una responsabilidad pastoral, administrativa, educativa, litúrgica o de coordinación.
            </p>

            <label>
              Entidad del servicio
              <select
                name="quick_entity_id"
                value={quickEntityId}
                onChange={(event) => setQuickEntityId(event.target.value)}
              >
                <option value="">Selecciona entidad del servicio</option>
                {entities.map((entity) => (
                  <option key={entity.direct_entity_id} value={entity.direct_entity_id}>
                    {entity.direct_entity_name} · {entity.direct_entity_type_name ?? 'Entidad'}
                  </option>
                ))}
              </select>
            </label>
            <div className="empty-state" role="status" aria-atomic="true" aria-live="polite">
              <strong>Entidad seleccionada</strong>
              <span>
                {quickEntity?.hierarchy_path
                  ?? quickEntity?.direct_entity_name
                  ?? 'Selecciona la entidad donde sirve.'}
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
                Fecha de inicio
                <input name="quick_start_date" type="date" />
              </label>
              <label>
                Visibilidad del servicio
                <select
                  name="assignment_visibility"
                  value={assignmentVisibility}
                  onChange={(event) => (
                    setAssignmentVisibility(event.target.value as 'internal' | 'public' | 'private')
                  )}
                >
                  <option value="internal">Interno: visible solo en administración</option>
                  <option value="public">Público: visible en directorios</option>
                  <option value="private">Privado: visible solo para control interno</option>
                </select>
              </label>
            </div>
            <label>
              Notas visibles del cargo si se publica
              <textarea name="quick_notes_public" />
            </label>
          </section>

          <section hidden={step !== 4}>
            <p className="eyebrow">Etapa 5</p>
            <h2>Revisar completitud y guardar</h2>

            <div className="admin-review-grid" aria-label="Resumen del registro de persona laica">
              <article className="card compact-section">
                <span>Persona</span>
                <strong>
                  {selectedPerson?.display_name ?? (mode === 'new' ? 'Nueva identidad' : 'Sin seleccionar')}
                </strong>
                <small>{mode === 'existing' ? 'Se reutilizará la ficha existente' : 'Se creará una ficha nueva'}</small>
                <button type="button" onClick={() => setStep(0)}>Cambiar</button>
              </article>
              <article className="card compact-section">
                <span>Servicio</span>
                <strong>{quickEntity?.direct_entity_name ?? 'Sin entidad de servicio'}</strong>
                <small>{selectedOffice?.display_name ?? 'Sin cargo actual'}</small>
                <button type="button" onClick={() => setStep(3)}>Cambiar</button>
              </article>
              <article className="card compact-section">
                <span>Visibilidad</span>
                <strong>
                  {assignmentVisibility === 'public'
                    ? 'Pública'
                    : assignmentVisibility === 'private'
                      ? 'Privada'
                      : 'Interna'}
                </strong>
                <small>Alcance del servicio registrado</small>
                <button type="button" onClick={() => setStep(3)}>Cambiar</button>
              </article>
            </div>

            {mode === 'new' ? (
              <fieldset className="person-option-fieldset">
                <legend>Datos buscados y no encontrados</legend>
                <div className="person-option-list person-option-list--choices">
                  {optionalFields.map((field) => (
                    <label key={field.key} className="role-pill">
                      <input type="checkbox" name="not_identified_fields" value={field.key} />
                      <span>{field.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

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
                    ? 'Reutilizar persona'
                    : 'Guardar persona laica'}
              </button>
            )}
          </div>
        </form>
      </div>
    </main>
  )
}
