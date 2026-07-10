'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { EntityHierarchyEntity } from '@/components/admin/EntityHierarchyPicker'
import {
  loadAllowedOfficeIds,
  loadBishopCatalogs,
  saveBishop,
  type ClergyRecord,
  type OfficeConfig,
} from '../services/bishop-admin-service'

const steps = ['Origen', 'Datos básicos', 'Episcopado', 'Cargo', 'Revisión']

function emptyToNull(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text.length > 0 ? text : null
}

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedSlug, setSavedSlug] = useState<string | null>(null)

  const priestRecords = clergyRecords.filter((record) => record.person_type === 'priest')
  const bishopRecords = clergyRecords.filter((record) => record.person_type === 'bishop')
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
      setMessage(mode === 'existing' ? 'Sacerdote registrado como obispo correctamente.' : 'Obispo externo registrado correctamente con historial sacerdotal pendiente.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el obispo.')
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
          <p className="eyebrow">Asistente paso a paso</p>
          <h1>Registrar obispo</h1>
          <p className="lead">Primero busca si ya existe como sacerdote. Si existe, se completa esa misma ficha con sus datos episcopales. Solo usa obispo externo cuando todavía no existe su ficha sacerdotal en SINEP RD.</p>
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

      <form className="admin-form admin-config-form card dashboard-section" onSubmit={handleSubmit}>
        <section hidden={step !== 0}>
          <p className="eyebrow">Paso 1</p>
          <h2>¿Ya existe como sacerdote?</h2>
          <p className="meta">El flujo normal es seleccionar un sacerdote existente y agregar su ordenación episcopal. Así se evita duplicar personas.</p>
          <div className="dashboard-grid dashboard-summary">
            <button className={`metric-card metric-button ${mode === 'existing' ? 'active-filter' : ''}`} type="button" onClick={() => setMode('existing')}><strong>Sí</strong><span>Seleccionar sacerdote registrado</span></button>
            <button className={`metric-card metric-button ${mode === 'new' ? 'active-filter' : ''}`} type="button" onClick={() => { setMode('new'); setSelectedClergyId('') }}><strong>No</strong><span>Registrar obispo externo</span></button>
          </div>
          {mode === 'existing' && (
            <select value={selectedClergyId} onChange={(event) => setSelectedClergyId(event.target.value)}>
              <option value="">Selecciona sacerdote</option>
              {priestRecords.map((record) => <option key={record.id} value={record.id}>{record.display_name}</option>)}
            </select>
          )}
          {mode === 'new' && <div className="empty-state"><strong>Obispo externo</strong><span>Usa esta opción solo si fue enviado desde otra jurisdicción y todavía no está registrada su historia sacerdotal.</span></div>}
        </section>

        <section hidden={step !== 1}>
          <p className="eyebrow">Paso 2</p>
          <h2>{mode === 'existing' ? 'Sacerdote seleccionado' : 'Datos básicos del obispo externo'}</h2>
          {mode === 'existing' ? <div className="empty-state"><strong>{selectedClergy?.display_name ?? 'No seleccionado'}</strong><span>Se actualizará la misma ficha, sin duplicarla.</span></div> : (
            <>
              <input name="first_name" placeholder="Primer nombre" />
              <input name="middle_name" placeholder="Segundo nombre" />
              <input name="last_name" placeholder="Primer apellido" />
              <input name="second_last_name" placeholder="Segundo apellido" />
              <input name="display_name" placeholder="Nombre como aparecerá en la ficha" />
              <label>Fecha de nacimiento<input name="birth_date" type="date" /></label>
              <input name="birth_place" placeholder="Lugar de nacimiento" />
              <textarea name="biography_public" placeholder="Biografía pública breve" />
            </>
          )}
        </section>

        <section hidden={step !== 2}>
          <p className="eyebrow">Paso 3</p>
          <h2>Datos episcopales</h2>
          <label>Ordenación sacerdotal<input name="priestly_ordination_date" type="date" /></label>
          <label>Ordenación episcopal<input name="episcopal_ordination_date" type="date" /></label>
          <input name="ordination_place" placeholder="Lugar de ordenación episcopal" />
          <input name="religious_order" placeholder="Orden o congregación, si aplica" />
          <select name="incardination_entity_id" value={incardinationEntityId} onChange={(event) => setIncardinationEntityId(event.target.value)}>
            <option value="">Incardinación</option>
            {entities.map((entity) => <option key={entity.direct_entity_id} value={entity.direct_entity_id}>{entity.direct_entity_name}{entity.hierarchy_path ? ` · ${entity.hierarchy_path}` : ''}</option>)}
          </select>
          <h3>Sucesión apostólica</h3>
          <select name="principal_consecrator_person_id" defaultValue=""><option value="">Consagrante principal registrado</option>{bishopRecords.map((record) => <option key={record.id} value={record.id}>{record.display_name}</option>)}</select>
          <input name="principal_consecrator_name" placeholder="Consagrante principal si no está registrado" />
          <select name="co_consecrator_1_person_id" defaultValue=""><option value="">Co-consagrante 1 registrado</option>{bishopRecords.map((record) => <option key={record.id} value={record.id}>{record.display_name}</option>)}</select>
          <input name="co_consecrator_1_name" placeholder="Co-consagrante 1 si no está registrado" />
          <select name="co_consecrator_2_person_id" defaultValue=""><option value="">Co-consagrante 2 registrado</option>{bishopRecords.map((record) => <option key={record.id} value={record.id}>{record.display_name}</option>)}</select>
          <input name="co_consecrator_2_name" placeholder="Co-consagrante 2 si no está registrado" />
          <textarea name="ordination_notes_public" placeholder="Notas públicas" />
        </section>

        <section hidden={step !== 3}>
          <p className="eyebrow">Paso 4</p>
          <h2>Cargo episcopal</h2>
          <select name="assignment_entity_id" value={assignmentEntityId} onChange={(event) => setAssignmentEntityId(event.target.value)}>
            <option value="">Entidad del cargo</option>
            {entities.map((entity) => <option key={entity.direct_entity_id} value={entity.direct_entity_id}>{entity.direct_entity_name} · {entity.direct_entity_type_name ?? 'Entidad'}</option>)}
          </select>
          <div className="empty-state"><strong>Ruta</strong><span>{selectedEntity?.hierarchy_path ?? selectedEntity?.direct_entity_name ?? 'Selecciona la entidad.'}</span></div>
          <select name="office_configuration_id" value={officeConfigurationId} onChange={(event) => setOfficeConfigurationId(event.target.value)} disabled={!assignmentEntityId || filteredOffices.length === 0}>
            <option value="">Sin cargo por ahora</option>
            {filteredOffices.map((office) => <option key={office.id} value={office.id}>{office.display_name}</option>)}
          </select>
          <p className="meta">{officeFilterMessage}</p>
          <input name="title_override" placeholder="Título público: Obispo, Arzobispo, Auxiliar, Emérito" />
          <label>Inicio del nombramiento<input name="appointment_start_date" type="date" /></label>
          <textarea name="appointment_notes_public" placeholder="Notas públicas del cargo" />
        </section>

        <section hidden={step !== 4}>
          <p className="eyebrow">Paso 5</p>
          <h2>Fuente y revisión</h2>
          <input name="source_name" placeholder="Fuente" />
          <input name="source_url" placeholder="URL de fuente" />
          <label>Fecha de revisión<input name="source_checked_at" type="date" /></label>
          <p className="lead">Guarda el obispo. Si partiste de un sacerdote existente, se conservará su historial.</p>
        </section>

        <div className="admin-form-grid">
          <button className="button button-secondary" type="button" onClick={() => setStep(Math.max(0, step - 1))}>Anterior</button>
          {step < steps.length - 1
            ? <button className="button button-secondary" type="button" onClick={() => setStep(Math.min(steps.length - 1, step + 1))}>Siguiente</button>
            : <button className="button button-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar obispo'}</button>}
        </div>
      </form>
    </main>
  )
}
