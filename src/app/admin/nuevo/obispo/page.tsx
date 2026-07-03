'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Person = { id: string; display_name: string; slug: string; person_type: string }
type Entity = { direct_entity_id: string; direct_entity_name: string; direct_entity_type_name: string | null; hierarchy_path: string | null }
type Office = { id: string; display_name: string; organization_chart_id: string | null }

const steps = ['Origen', 'Persona', 'Episcopado', 'Cargo', 'Revisión']

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

export default function NuevoObispoPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [step, setStep] = useState(0)
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [people, setPeople] = useState<Person[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [offices, setOffices] = useState<Office[]>([])
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [assignmentEntityId, setAssignmentEntityId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedSlug, setSavedSlug] = useState<string | null>(null)

  const selectedPerson = people.find((person) => person.id === selectedPersonId)
  const selectedEntity = entities.find((entity) => entity.direct_entity_id === assignmentEntityId)

  async function loadData() {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    const [peopleRes, entityRes, officeRes] = await Promise.all([
      supabase.from('persons').select('id,display_name,slug,person_type').in('person_type', ['priest', 'bishop']).eq('status', 'active').order('display_name'),
      supabase.from('public_entity_hierarchy_paths').select('direct_entity_id,direct_entity_name,direct_entity_type_name,hierarchy_path').order('direct_entity_name'),
      supabase.from('office_configurations').select('id,display_name,organization_chart_id').eq('status', 'active').order('display_name'),
    ])

    if (peopleRes.error || entityRes.error || officeRes.error) {
      setError(peopleRes.error?.message ?? entityRes.error?.message ?? officeRes.error?.message ?? 'No se pudieron cargar los catálogos.')
    } else {
      setPeople((peopleRes.data ?? []) as Person[])
      setEntities((entityRes.data ?? []) as Entity[])
      setOffices((officeRes.data ?? []) as Office[])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    setSavedSlug(null)

    const form = new FormData(event.currentTarget)
    const { data: userData } = await supabase.auth.getUser()
    let personId = selectedPersonId
    let personSlug = selectedPerson?.slug ?? null

    if (mode === 'existing') {
      if (!personId) {
        setError('Selecciona una persona existente.')
        setSaving(false)
        return
      }
      const updateRes = await supabase.from('persons').update({ person_type: 'bishop' }).eq('id', personId)
      if (updateRes.error) {
        setError(updateRes.error.message)
        setSaving(false)
        return
      }
    } else {
      const name = String(form.get('display_name') ?? '').trim() || displayName(form)
      const firstName = String(form.get('first_name') ?? '').trim()
      const lastName = String(form.get('last_name') ?? '').trim()
      if (!firstName || !lastName || !name) {
        setError('Nombre, apellido y nombre público son obligatorios.')
        setSaving(false)
        return
      }
      const inserted = await supabase.from('persons').insert({
        first_name: firstName,
        middle_name: emptyToNull(form.get('middle_name')),
        last_name: lastName,
        second_last_name: emptyToNull(form.get('second_last_name')),
        display_name: name,
        slug: String(form.get('slug') ?? '').trim() || slugify(name),
        person_type: 'bishop',
        gender: 'male',
        birth_date: emptyToNull(form.get('birth_date')),
        birth_place: emptyToNull(form.get('birth_place')),
        biography_public: emptyToNull(form.get('biography_public')),
        status: 'active',
        visibility: 'public',
        created_by: userData.user?.id ?? null,
      }).select('id,slug').single()
      if (inserted.error) {
        setError(inserted.error.message)
        setSaving(false)
        return
      }
      personId = inserted.data.id
      personSlug = inserted.data.slug
    }

    const currentProfile = await supabase.from('clergy_profiles').select('id').eq('person_id', personId).maybeSingle()
    const profilePayload = {
      person_id: personId,
      incardination_entity_id: emptyToNull(form.get('incardination_entity_id')),
      current_service_entity_id: emptyToNull(form.get('assignment_entity_id')),
      priestly_ordination_date: emptyToNull(form.get('priestly_ordination_date')),
      episcopal_ordination_date: emptyToNull(form.get('episcopal_ordination_date')),
      religious_order: emptyToNull(form.get('religious_order')),
      canonical_status: 'active',
    }
    const profileRes = currentProfile.data?.id
      ? await supabase.from('clergy_profiles').update(profilePayload).eq('id', currentProfile.data.id)
      : await supabase.from('clergy_profiles').insert(profilePayload)
    if (profileRes.error) {
      setError(profileRes.error.message)
      setSaving(false)
      return
    }

    const ordRes = await supabase.from('episcopal_ordinations').insert({
      bishop_person_id: personId,
      ordination_date: emptyToNull(form.get('episcopal_ordination_date')),
      ordination_place: emptyToNull(form.get('ordination_place')),
      principal_consecrator_person_id: emptyToNull(form.get('principal_consecrator_person_id')),
      co_consecrator_1_person_id: emptyToNull(form.get('co_consecrator_1_person_id')),
      co_consecrator_2_person_id: emptyToNull(form.get('co_consecrator_2_person_id')),
      principal_consecrator_name: emptyToNull(form.get('principal_consecrator_name')),
      co_consecrator_1_name: emptyToNull(form.get('co_consecrator_1_name')),
      co_consecrator_2_name: emptyToNull(form.get('co_consecrator_2_name')),
      source_name: emptyToNull(form.get('source_name')),
      source_url: emptyToNull(form.get('source_url')),
      source_checked_at: emptyToNull(form.get('source_checked_at')),
      verification_status: 'pending_review',
      visibility: 'public',
      status: 'active',
      notes_public: emptyToNull(form.get('ordination_notes_public')),
      notes_internal: 'Creado desde asistente episcopal.',
      created_by: userData.user?.id ?? null,
    })
    if (ordRes.error) {
      setError(ordRes.error.message)
      setSaving(false)
      return
    }

    const officeId = emptyToNull(form.get('office_configuration_id'))
    if (officeId) {
      const office = offices.find((item) => item.id === officeId)
      const assignmentRes = await supabase.from('position_assignments').insert({
        person_id: personId,
        office_configuration_id: officeId,
        organization_chart_id: office?.organization_chart_id ?? null,
        ecclesiastical_entity_id: emptyToNull(form.get('assignment_entity_id')),
        title_override: emptyToNull(form.get('title_override')),
        start_date: emptyToNull(form.get('appointment_start_date')),
        term_start_date: emptyToNull(form.get('appointment_start_date')),
        is_current: true,
        assignment_status: 'active',
        selection_method: 'appointment',
        notes_public: emptyToNull(form.get('appointment_notes_public')),
        notes_internal: 'Cargo episcopal creado desde asistente episcopal.',
        verification_status: 'pending',
        visibility: 'public',
        record_status: 'active',
      })
      if (assignmentRes.error) {
        setError(assignmentRes.error.message)
        setSaving(false)
        return
      }
    }

    setSavedSlug(personSlug)
    setMessage(mode === 'existing' ? 'Persona existente actualizada como obispo.' : 'Persona episcopal creada correctamente.')
    setSaving(false)
  }

  if (loading) return <main className="container"><div className="empty-state">Cargando asistente...</div></main>

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink"><Link href="/admin/nuevo">← Volver a agregar nueva ficha</Link></div>
      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Asistente paso a paso</p>
          <h1>Nueva persona episcopal</h1>
          <p className="lead">Selecciona un sacerdote existente o crea una persona nueva. El sistema no duplica fichas existentes.</p>
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
        {step === 0 && (
          <section>
            <p className="eyebrow">Paso 1</p>
            <h2>Origen de la ficha</h2>
            <div className="dashboard-grid dashboard-summary">
              <button className={`metric-card metric-button ${mode === 'existing' ? 'active-filter' : ''}`} type="button" onClick={() => setMode('existing')}><strong>Existente</strong><span>Seleccionar sacerdote registrado</span></button>
              <button className={`metric-card metric-button ${mode === 'new' ? 'active-filter' : ''}`} type="button" onClick={() => setMode('new')}><strong>Nuevo</strong><span>Crear desde cero</span></button>
            </div>
            {mode === 'existing' && (
              <select value={selectedPersonId} onChange={(event) => setSelectedPersonId(event.target.value)}>
                <option value="">Selecciona persona</option>
                {people.map((person) => <option key={person.id} value={person.id}>{person.display_name} · {person.person_type}</option>)}
              </select>
            )}
          </section>
        )}

        {step === 1 && (
          <section>
            <p className="eyebrow">Paso 2</p>
            <h2>{mode === 'existing' ? 'Persona seleccionada' : 'Datos personales'}</h2>
            {mode === 'existing' ? <div className="empty-state"><strong>{selectedPerson?.display_name ?? 'No seleccionado'}</strong><span>Se actualizará la misma ficha, sin duplicarla.</span></div> : (
              <>
                <input name="first_name" placeholder="Primer nombre" />
                <input name="middle_name" placeholder="Segundo nombre" />
                <input name="last_name" placeholder="Primer apellido" />
                <input name="second_last_name" placeholder="Segundo apellido" />
                <input name="display_name" placeholder="Nombre público" />
                <input name="slug" placeholder="Slug opcional" />
                <label>Fecha de nacimiento<input name="birth_date" type="date" /></label>
                <input name="birth_place" placeholder="Lugar de nacimiento" />
                <textarea name="biography_public" placeholder="Biografía pública breve" />
              </>
            )}
          </section>
        )}

        {step === 2 && (
          <section>
            <p className="eyebrow">Paso 3</p>
            <h2>Datos episcopales</h2>
            <label>Ordenación sacerdotal<input name="priestly_ordination_date" type="date" /></label>
            <label>Ordenación episcopal<input name="episcopal_ordination_date" type="date" /></label>
            <input name="ordination_place" placeholder="Lugar de ordenación episcopal" />
            <input name="religious_order" placeholder="Orden o congregación, si aplica" />
            <select name="incardination_entity_id" defaultValue=""><option value="">Incardinación</option>{entities.map((entity) => <option key={entity.direct_entity_id} value={entity.direct_entity_id}>{entity.direct_entity_name}</option>)}</select>
            <h3>Sucesión apostólica</h3>
            <select name="principal_consecrator_person_id" defaultValue=""><option value="">Consagrante principal registrado</option>{people.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select>
            <input name="principal_consecrator_name" placeholder="Consagrante principal si no está registrado" />
            <select name="co_consecrator_1_person_id" defaultValue=""><option value="">Co-consagrante 1 registrado</option>{people.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select>
            <input name="co_consecrator_1_name" placeholder="Co-consagrante 1 si no está registrado" />
            <select name="co_consecrator_2_person_id" defaultValue=""><option value="">Co-consagrante 2 registrado</option>{people.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select>
            <input name="co_consecrator_2_name" placeholder="Co-consagrante 2 si no está registrado" />
            <textarea name="ordination_notes_public" placeholder="Notas públicas" />
          </section>
        )}

        {step === 3 && (
          <section>
            <p className="eyebrow">Paso 4</p>
            <h2>Cargo episcopal</h2>
            <select name="office_configuration_id" defaultValue=""><option value="">Sin cargo por ahora</option>{offices.map((office) => <option key={office.id} value={office.id}>{office.display_name}</option>)}</select>
            <input name="title_override" placeholder="Título público: Obispo, Arzobispo, Auxiliar, Emérito" />
            <select name="assignment_entity_id" value={assignmentEntityId} onChange={(event) => setAssignmentEntityId(event.target.value)}><option value="">Entidad del cargo</option>{entities.map((entity) => <option key={entity.direct_entity_id} value={entity.direct_entity_id}>{entity.direct_entity_name} · {entity.direct_entity_type_name ?? 'Entidad'}</option>)}</select>
            <div className="empty-state"><strong>Ruta</strong><span>{selectedEntity?.hierarchy_path ?? selectedEntity?.direct_entity_name ?? 'Selecciona la entidad.'}</span></div>
            <label>Inicio del nombramiento<input name="appointment_start_date" type="date" /></label>
            <textarea name="appointment_notes_public" placeholder="Notas públicas del cargo" />
          </section>
        )}

        {step === 4 && (
          <section>
            <p className="eyebrow">Paso 5</p>
            <h2>Fuente y revisión</h2>
            <input name="source_name" placeholder="Fuente" />
            <input name="source_url" placeholder="URL de fuente" />
            <label>Fecha de revisión<input name="source_checked_at" type="date" /></label>
            <p className="lead">Guarda la persona episcopal. Si partiste de un sacerdote existente, se conservará su historial.</p>
          </section>
        )}

        <div className="admin-form-grid">
          <button className="button button-secondary" type="button" onClick={() => setStep(Math.max(0, step - 1))}>Anterior</button>
          {step < steps.length - 1 ? <button className="button button-secondary" type="button" onClick={() => setStep(Math.min(steps.length - 1, step + 1))}>Siguiente</button> : <button className="button button-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar persona episcopal'}</button>}
        </div>
      </form>
    </main>
  )
}
