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
  loadBishopCatalogs,
  saveBishop,
  type BishopRoleType,
  type ClergyRecord,
  type ClericalStatusType,
  type EcclesiasticalDignity,
  type OfficeConfig,
} from '../services/bishop-admin-service'

const steps = ['Origen', 'Datos básicos', 'Episcopado', 'Cargo', 'Revisión']
const wizardSteps = [
  { label: 'Origen', description: 'Seleccionar sacerdote o crear identidad' },
  { label: 'Datos básicos', description: 'Identidad y biografía pública' },
  { label: 'Episcopado', description: 'Ordenación y sucesión apostólica' },
  { label: 'Cargo', description: 'Función, estado y jurisdicción' },
  { label: 'Revisión', description: 'Fuente y guardado canónico' },
]

const dignityOptions: Array<{ value: EcclesiasticalDignity; label: string }> = [
  { value: 'archbishop', label: 'Arzobispo' },
  { value: 'metropolitan', label: 'Metropolitano' },
  { value: 'cardinal', label: 'Cardenal' },
  { value: 'monsignor', label: 'Monseñor' },
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

function displayName(form: FormData) {
  return [form.get('first_name'), form.get('middle_name'), form.get('last_name'), form.get('second_last_name')]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

export default function BishopWizardPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [step, setStep] = useState(0)
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [clergyRecords, setClergyRecords] = useState<ClergyRecord[]>([])
  const [entities, setEntities] = useState<EntityHierarchyEntity[]>([])
  const [offices, setOffices] = useState<OfficeConfig[]>([])
  const [allowedOfficeIds, setAllowedOfficeIds] = useState<string[]>([])
  const [officeFilterMessage, setOfficeFilterMessage] = useState('Selecciona la entidad del cargo para ver sus cargos permitidos.')
  const [selectedClergyId, setSelectedClergyId] = useState('')
  const [incardinationEntityId, setIncardinationEntityId] = useState('')
  const [assignmentEntityId, setAssignmentEntityId] = useState('')
  const [officeConfigurationId, setOfficeConfigurationId] = useState('')
  const [episcopalRoleType, setEpiscopalRoleType] = useState<BishopRoleType>('diocesan')
  const [canonicalStatus, setCanonicalStatus] = useState<ClericalStatusType>('active')
  const [dignities, setDignities] = useState<EcclesiasticalDignity[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedSlug, setSavedSlug] = useState<string | null>(null)

  const priestRecords = clergyRecords.filter((record) => record.highest_ordination_degree === 'presbyterate')
  const bishopRecords = clergyRecords.filter((record) => record.highest_ordination_degree === 'episcopate')
  const selectedClergy = priestRecords.find((record) => record.id === selectedClergyId)
  const selectedEntity = entities.find((entity) => entity.direct_entity_id === assignmentEntityId)
  const filteredOffices = assignmentEntityId
    ? offices.filter((office) => allowedOfficeIds.includes(office.id))
    : []

  useEffect(() => {
    async function loadData() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/admin/login')
        return
      }

      try {
        const catalogs = await loadBishopCatalogs(supabase)
        setClergyRecords(catalogs.clergyRecords)
        setEntities(catalogs.entities)
        setOffices(catalogs.offices)
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
      if (!assignmentEntityId) {
        setOfficeFilterMessage('Selecciona la entidad del cargo para ver sus cargos permitidos.')
        return
      }

      try {
        const ids = await loadAllowedOfficeIds(supabase, assignmentEntityId)
        setAllowedOfficeIds(ids)
        setOfficeFilterMessage(
          ids.length > 0
            ? 'Cargos episcopales filtrados por el nivel estructural seleccionado.'
            : 'Este nivel no tiene cargos configurados. Configúralos en Administración → Estructura antes de asignar uno.',
        )
      } catch (officeError) {
        setOfficeFilterMessage(officeError instanceof Error ? officeError.message : 'No se pudieron cargar los cargos permitidos.')
      }
    }

    loadOffices()
  }, [assignmentEntityId, supabase])

  useEffect(() => {
    if (officeConfigurationId && !filteredOffices.some((office) => office.id === officeConfigurationId)) {
      setOfficeConfigurationId('')
    }
  }, [filteredOffices, officeConfigurationId])

  function changeEpiscopalRole(value: BishopRoleType) {
    setEpiscopalRoleType(value)
    if (value === 'emeritus') {
      setCanonicalStatus('emeritus')
    } else if (canonicalStatus === 'emeritus') {
      setCanonicalStatus('active')
    }
  }

  function toggleDignity(value: EcclesiasticalDignity, checked: boolean) {
    setDignities((current) => checked
      ? [...new Set([...current, value])]
      : current.filter((item) => item !== value))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    setSavedSlug(null)

    const form = new FormData(event.currentTarget)
    const name = String(form.get('display_name') ?? '').trim() || displayName(form)
    const firstName = String(form.get('first_name') ?? '').trim()
    const lastName = String(form.get('last_name') ?? '').trim()

    if (mode === 'existing' && !selectedClergyId) {
      setError('Selecciona el sacerdote que será registrado como obispo.')
      setSaving(false)
      return
    }

    if (mode === 'new' && (!firstName || !lastName || !name)) {
      setError('Nombre y apellido son obligatorios para registrar un obispo externo.')
      setSaving(false)
      return
    }

    const payload = {
      mode,
      selected_clergy_id: selectedClergyId || null,
      first_name: firstName,
      middle_name: emptyToNull(form.get('middle_name')),
      last_name: lastName,
      second_last_name: emptyToNull(form.get('second_last_name')),
      display_name: name,
      slug: slugify(name || selectedClergy?.display_name || 'obispo'),
      birth_date: emptyToNull(form.get('birth_date')),
      birth_place: emptyToNull(form.get('birth_place')),
      biography_public: emptyToNull(form.get('biography_public')),
      incardination_entity_id: emptyToNull(form.get('incardination_entity_id')),
      assignment_entity_id: emptyToNull(form.get('assignment_entity_id')),
      priestly_ordination_date: emptyToNull(form.get('priestly_ordination_date')),
      episcopal_ordination_date: emptyToNull(form.get('episcopal_ordination_date')),
      religious_order: emptyToNull(form.get('religious_order')),
      ordination_place: emptyToNull(form.get('ordination_place')),
      principal_consecrator_person_id: emptyToNull(form.get('principal_consecrator_person_id')),
      co_consecrator_1_person_id: emptyToNull(form.get('co_consecrator_1_person_id')),
      co_consecrator_2_person_id: emptyToNull(form.get('co_consecrator_2_person_id')),
      principal_consecrator_name: emptyToNull(form.get('principal_consecrator_name')),
      co_consecrator_1_name: emptyToNull(form.get('co_consecrator_1_name')),
      co_consecrator_2_name: emptyToNull(form.get('co_consecrator_2_name')),
      episcopal_role_type: episcopalRoleType,
      canonical_status: canonicalStatus,
      dignities,
      title_see_name: emptyToNull(form.get('title_see_name')),
      office_configuration_id: emptyToNull(form.get('office_configuration_id')),
      title_override: emptyToNull(form.get('title_override')),
      appointment_start_date: emptyToNull(form.get('appointment_start_date')),
      appointment_notes_public: emptyToNull(form.get('appointment_notes_public')),
      source_name: emptyToNull(form.get('source_name')),
      source_url: emptyToNull(form.get('source_url')),
      source_checked_at: emptyToNull(form.get('source_checked_at')),
      ordination_notes_public: emptyToNull(form.get('ordination_notes_public')),
    }

    try {
      const data = await saveBishop(payload)
      setSavedSlug(data.slug ?? selectedClergy?.slug ?? null)
      setMessage(mode === 'existing'
        ? 'Episcopado, función y dignidades agregados a la misma ficha personal.'
        : 'Obispo externo registrado con una identidad única y dimensiones canónicas separadas.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el obispo.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="container">
        <div className="empty-state" role="status" aria-live="polite">Cargando asistente...</div>
      </main>
    )
  }

  return (
    <main
      aria-busy={saving}
      aria-labelledby="bishop-wizard-title"
      className="container dashboard-page admin-config-page"
    >
      <div className="detail-backlink"><Link href="/admin/nuevo">← Volver a agregar nueva ficha</Link></div>
      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Asistente paso a paso</p>
          <h1 id="bishop-wizard-title">Registrar obispo</h1>
          <p className="lead">La persona conserva una sola identidad. El episcopado, la función sobre una jurisdicción, el estado canónico, las dignidades y el cargo se registran por separado.</p>
        </div>
      </section>

      {error && <div className="error-box" id="bishop-wizard-error" role="alert" aria-live="assertive">{error}</div>}
      {message && (
        <div className="empty-state" role="status" aria-atomic="true" aria-live="polite">
          <strong>{message}</strong>
          {savedSlug && <Link href={`/personas/${savedSlug}`}>Ver ficha pública</Link>}
        </div>
      )}

      <div className="admin-wizard-layout">
        <AdminWizardProgress
          steps={wizardSteps}
          currentStep={step}
          maxReachableStep={steps.length - 1}
          onStepChange={setStep}
        />

        <form
          aria-busy={saving}
          aria-describedby={error ? 'bishop-wizard-error' : undefined}
          className="admin-form admin-config-form card dashboard-section admin-wizard-form"
          onSubmit={handleSubmit}
        >
          <div hidden={step !== 0}>
            <p className="eyebrow">Paso 1</p>
            <PersonIdentityStep
              mode={mode}
              onModeChange={setMode}
              selectedPersonId={selectedClergyId}
              onSelectedPersonChange={setSelectedClergyId}
              people={priestRecords}
              existingActionLabel="Agregar el episcopado a un sacerdote registrado."
              newActionLabel="Registrar un obispo externo que todavía no existe en SINEP RD."
              selectPlaceholder="Selecciona un sacerdote"
              existingSummary="Se conservarán su identidad, ordenaciones, código interno y trayectoria previa."
            />
            {mode === 'new' && (
              <div className="empty-state" role="status" aria-live="polite">
                <strong>Obispo externo</strong>
                <span>El sistema creará la identidad y añadirá los antecedentes sacramentales sin tratarlos como tipos independientes de persona.</span>
              </div>
            )}
          </div>

          <section hidden={step !== 1}>
            <p className="eyebrow">Paso 2</p>
            <h2>{mode === 'existing' ? 'Sacerdote seleccionado' : 'Datos básicos del obispo externo'}</h2>
            {mode === 'existing' ? (
              <div className="empty-state" role="status" aria-live="polite">
                <strong>{selectedClergy?.display_name ?? 'No seleccionado'}</strong>
                <span>Se actualizará la misma ficha, sin duplicarla.</span>
              </div>
            ) : (
              <>
                <label>Primer nombre<input autoComplete="given-name" name="first_name" /></label>
                <label>Segundo nombre<input autoComplete="additional-name" name="middle_name" /></label>
                <label>Primer apellido<input autoComplete="family-name" name="last_name" /></label>
                <label>Segundo apellido<input name="second_last_name" /></label>
                <label>Nombre visible<input name="display_name" /></label>
                <label>Fecha de nacimiento<input autoComplete="bday" name="birth_date" type="date" /></label>
                <label>Lugar de nacimiento<input name="birth_place" /></label>
                <label>Biografía pública<textarea name="biography_public" /></label>
              </>
            )}
          </section>

          <section hidden={step !== 2}>
            <p className="eyebrow">Paso 3</p>
            <h2>Historia sacramental</h2>
            <label>Ordenación sacerdotal<input name="priestly_ordination_date" type="date" /></label>
            <label>Ordenación episcopal<input name="episcopal_ordination_date" type="date" /></label>
            <label>Lugar de ordenación episcopal<input name="ordination_place" /></label>
            <label>Orden o congregación, si aplica<input name="religious_order" /></label>
            <label>
              Incardinación o pertenencia actual
              <select name="incardination_entity_id" value={incardinationEntityId} onChange={(event) => setIncardinationEntityId(event.target.value)}>
                <option value="">Sin incardinación seleccionada</option>
                {entities.map((entity) => <option key={entity.direct_entity_id} value={entity.direct_entity_id}>{entity.direct_entity_name}{entity.hierarchy_path ? ` · ${entity.hierarchy_path}` : ''}</option>)}
              </select>
            </label>
            <p className="meta">La incardinación queda como historial independiente y no define el grado del Orden.</p>

            <fieldset className="clergy-option-fieldset">
              <legend>Sucesión apostólica</legend>
              <div className="clergy-option-list">
                <label>
                  Consagrante principal registrado
                  <select name="principal_consecrator_person_id" defaultValue="">
                    <option value="">Sin consagrante registrado seleccionado</option>
                    {bishopRecords.map((record) => <option key={record.id} value={record.id}>{record.display_name}</option>)}
                  </select>
                </label>
                <label>Consagrante principal no registrado<input name="principal_consecrator_name" /></label>
                <label>
                  Primer co-consagrante registrado
                  <select name="co_consecrator_1_person_id" defaultValue="">
                    <option value="">Sin primer co-consagrante seleccionado</option>
                    {bishopRecords.map((record) => <option key={record.id} value={record.id}>{record.display_name}</option>)}
                  </select>
                </label>
                <label>Primer co-consagrante no registrado<input name="co_consecrator_1_name" /></label>
                <label>
                  Segundo co-consagrante registrado
                  <select name="co_consecrator_2_person_id" defaultValue="">
                    <option value="">Sin segundo co-consagrante seleccionado</option>
                    {bishopRecords.map((record) => <option key={record.id} value={record.id}>{record.display_name}</option>)}
                  </select>
                </label>
                <label>Segundo co-consagrante no registrado<input name="co_consecrator_2_name" /></label>
                <label>Notas públicas de la ordenación<textarea name="ordination_notes_public" /></label>
              </div>
            </fieldset>
          </section>

          <section hidden={step !== 3}>
            <p className="eyebrow">Paso 4</p>
            <h2>Función, estado, dignidades y cargo</h2>
            <label>
              Función episcopal
              <select value={episcopalRoleType} onChange={(event) => changeEpiscopalRole(event.target.value as BishopRoleType)}>
                <option value="diocesan">Obispo diocesano</option>
                <option value="auxiliary">Obispo auxiliar</option>
                <option value="coadjutor">Obispo coadjutor — con derecho de sucesión</option>
                <option value="titular">Obispo titular</option>
                <option value="emeritus">Obispo emérito</option>
                <option value="apostolic_administrator">Administrador apostólico</option>
                <option value="apostolic_vicar">Vicario apostólico</option>
                <option value="apostolic_prefect">Prefecto apostólico</option>
                <option value="other">Otra función episcopal</option>
              </select>
            </label>
            <label>Sede titular, si aplica<input name="title_see_name" /></label>
            <label>
              Estado canónico
              <select value={canonicalStatus} onChange={(event) => setCanonicalStatus(event.target.value as ClericalStatusType)}>
                <option value="active">Activo</option>
                <option value="retired">Retirado</option>
                <option value="emeritus">Emérito</option>
                <option value="suspended">Suspendido</option>
                <option value="restricted">Con restricciones</option>
                <option value="inactive">Inactivo</option>
                <option value="deceased">Fallecido</option>
                <option value="lost_clerical_state">Pérdida del estado clerical</option>
                <option value="unknown">No identificado</option>
              </select>
            </label>

            <fieldset className="clergy-option-fieldset">
              <legend>Dignidades o tratamientos</legend>
              <div className="clergy-option-list clergy-option-list--choices">
                {dignityOptions.map((option) => (
                  <label key={option.value} className="role-pill">
                    <input type="checkbox" checked={dignities.includes(option.value)} onChange={(event) => toggleDignity(option.value, event.target.checked)} />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="meta">Arzobispo, metropolitano, cardenal o monseñor no son grados adicionales del Orden.</p>

            <label>
              Jurisdicción o entidad de la función
              <select name="assignment_entity_id" value={assignmentEntityId} onChange={(event) => setAssignmentEntityId(event.target.value)}>
                <option value="">Sin jurisdicción o entidad seleccionada</option>
                {entities.map((entity) => <option key={entity.direct_entity_id} value={entity.direct_entity_id}>{entity.direct_entity_name} · {entity.direct_entity_type_name ?? 'Entidad'}</option>)}
              </select>
            </label>
            <div className="empty-state" role="status" aria-atomic="true" aria-live="polite">
              <strong>Ruta seleccionada</strong>
              <span>{selectedEntity?.hierarchy_path ?? selectedEntity?.direct_entity_name ?? 'Selecciona la jurisdicción o entidad.'}</span>
            </div>
            <label>
              Cargo configurado
              <select name="office_configuration_id" value={officeConfigurationId} onChange={(event) => setOfficeConfigurationId(event.target.value)} disabled={!assignmentEntityId || filteredOffices.length === 0}>
                <option value="">Sin cargo configurado por ahora</option>
                {filteredOffices.map((office) => <option key={office.id} value={office.id}>{office.display_name}</option>)}
              </select>
            </label>
            <p className="meta" role="status" aria-live="polite">{officeFilterMessage}</p>
            <label>Título público del nombramiento, si requiere una variante<input name="title_override" /></label>
            <label>Inicio de la función o nombramiento<input name="appointment_start_date" type="date" /></label>
            <label>Notas públicas de la función o del cargo<textarea name="appointment_notes_public" /></label>
          </section>

          <section hidden={step !== 4}>
            <p className="eyebrow">Paso 5</p>
            <h2>Fuente y revisión</h2>
            <label>Fuente<input name="source_name" /></label>
            <label>URL de la fuente<input name="source_url" type="url" /></label>
            <label>Fecha de revisión<input name="source_checked_at" type="date" /></label>
            <p className="lead">Se guardarán por separado la identidad, el episcopado, la función episcopal, el estado canónico, las dignidades y el nombramiento.</p>
          </section>

          <div className="admin-form-grid admin-wizard-actions" role="group" aria-label="Navegación y guardado del asistente">
            <button
              className="button button-secondary"
              disabled={step === 0 || saving}
              type="button"
              onClick={() => setStep(Math.max(0, step - 1))}
            >
              Anterior
            </button>
            <span aria-live="polite">Paso {step + 1} de {steps.length}</span>
            {step < steps.length - 1 ? (
              <button
                className="button button-primary"
                disabled={saving}
                type="button"
                onClick={() => setStep(Math.min(steps.length - 1, step + 1))}
              >
                Siguiente
              </button>
            ) : (
              <button className="button button-primary" aria-busy={saving} disabled={saving} type="submit">
                {saving ? 'Guardando...' : 'Guardar obispo'}
              </button>
            )}
          </div>
        </form>
      </div>
    </main>
  )
}
