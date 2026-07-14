'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  hasDeathRegistrationSession,
  loadDeathRegistrationPeople,
  registerDeath,
  type PersonOption,
} from '../services/death-registration-admin-service'

function emptyToNull(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text.length > 0 ? text : null
}

function personTypeLabel(value: string) {
  if (value === 'bishop') return 'Obispo'
  if (value === 'priest') return 'Sacerdote'
  if (value === 'deacon') return 'Diácono'
  if (value === 'religious') return 'Religioso/a'
  if (value === 'layperson') return 'Laico/a'
  return 'Persona'
}

function getInitialPersonId() {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('person') ?? ''
}

export default function DeathRegistrationPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [people, setPeople] = useState<PersonOption[]>([])
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [closeAssignments, setCloseAssignments] = useState(true)
  const [registerParishVacancy, setRegisterParishVacancy] = useState(false)
  const [registerJurisdictionVacancy, setRegisterJurisdictionVacancy] = useState(false)
  const [savedSlug, setSavedSlug] = useState<string | null>(null)
  const [closedCount, setClosedCount] = useState(0)
  const [vacancyCount, setVacancyCount] = useState(0)

  const selectedPerson = people.find((person) => person.id === selectedPersonId)

  useEffect(() => {
    async function loadPeople() {
      try {
        if (!await hasDeathRegistrationSession(supabase)) {
          router.push('/admin/login')
          return
        }
        const rows = await loadDeathRegistrationPeople(supabase)
        setPeople(rows)
        const initialPersonId = getInitialPersonId()
        if (initialPersonId && rows.some((person) => person.id === initialPersonId)) setSelectedPersonId(initialPersonId)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las personas.')
      } finally {
        setLoading(false)
      }
    }
    loadPeople()
  }, [router, supabase])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    setSavedSlug(null)
    setClosedCount(0)
    setVacancyCount(0)

    const form = new FormData(event.currentTarget)
    const deathDate = emptyToNull(form.get('death_date'))
    if (!selectedPersonId || !deathDate) {
      setError(!selectedPersonId ? 'Selecciona la persona que será marcada como fallecida.' : 'La fecha de fallecimiento es obligatoria.')
      setSaving(false)
      return
    }

    try {
      const result = await registerDeath({
        person_id: selectedPersonId,
        death_date: deathDate,
        death_place: emptyToNull(form.get('death_place')),
        source_name: emptyToNull(form.get('source_name')),
        source_url: emptyToNull(form.get('source_url')),
        source_checked_at: emptyToNull(form.get('source_checked_at')),
        notes_public: emptyToNull(form.get('notes_public')),
        notes_internal: emptyToNull(form.get('notes_internal')),
        close_active_assignments: closeAssignments,
        register_parish_vacancy: registerParishVacancy,
        register_jurisdiction_vacancy: registerJurisdictionVacancy,
      })
      setSavedSlug(result.slug ?? selectedPerson?.slug ?? null)
      setClosedCount(result.closed_assignments_count ?? 0)
      setVacancyCount(result.registered_vacancies_count ?? 0)
      setPeople((current) => current.filter((person) => person.id !== selectedPersonId))
      setSelectedPersonId('')
      setRegisterParishVacancy(false)
      setRegisterJurisdictionVacancy(false)
      setMessage('Fallecimiento registrado correctamente.')
      event.currentTarget.reset()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo marcar el fallecimiento.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className="container"><div className="empty-state">Cargando personas...</div></main>

  return <main className="container dashboard-page admin-config-page">
    <div className="detail-backlink"><Link href="/admin">← Volver al panel administrativo</Link></div>
    <section className="dashboard-hero card"><div><p className="eyebrow">Acción administrativa</p><h1>Marcar fallecimiento</h1><p className="lead">Esta acción no borra la ficha. Actualiza el estado y conserva el historial.</p></div></section>
    {error && <div className="error-box">{error}</div>}
    {message && <div className="empty-state"><strong>{message}</strong><span>Cargos cerrados: {closedCount}</span><span>Vacantes registradas: {vacancyCount}</span>{savedSlug && <Link href={`/personas/${savedSlug}`}>Ver ficha pública</Link>}</div>}
    <form className="admin-form admin-config-form card dashboard-section" onSubmit={handleSubmit}>
      <section><p className="eyebrow">Persona</p><h2>Selecciona la ficha existente</h2><select value={selectedPersonId} onChange={(event) => setSelectedPersonId(event.target.value)}><option value="">Selecciona una persona</option>{people.map((person) => <option key={person.id} value={person.id}>{person.display_name} · {personTypeLabel(person.person_type)}</option>)}</select></section>
      <section><p className="eyebrow">Fallecimiento</p><h2>Datos del deceso</h2><label>Fecha de fallecimiento<input name="death_date" type="date" required /></label><input name="death_place" placeholder="Lugar de fallecimiento" /><textarea name="notes_public" placeholder="Nota pública breve, si aplica" /><textarea name="notes_internal" placeholder="Notas internas de verificación" /></section>
      <section><p className="eyebrow">Fuente</p><h2>Confirmación</h2><input name="source_name" placeholder="Fuente de confirmación" /><input name="source_url" placeholder="URL de la fuente, si existe" /><label>Fecha de revisión<input name="source_checked_at" type="date" /></label></section>
      <section><p className="eyebrow">Cargos activos</p><h2>Qué hacer con sus responsabilidades</h2><label className="role-pill"><input checked={closeAssignments} onChange={(event) => setCloseAssignments(event.target.checked)} type="checkbox" />Cerrar todos los cargos activos.</label><label className="role-pill"><input checked={registerParishVacancy} disabled={!closeAssignments} onChange={(event) => setRegisterParishVacancy(event.target.checked)} type="checkbox" />Registrar vacante parroquial cuando corresponda.</label><label className="role-pill"><input checked={registerJurisdictionVacancy} disabled={!closeAssignments} onChange={(event) => setRegisterJurisdictionVacancy(event.target.checked)} type="checkbox" />Registrar sede vacante cuando corresponda.</label></section>
      <button className="button button-primary" disabled={saving}>{saving ? 'Guardando...' : 'Marcar fallecimiento'}</button>
    </form>
  </main>
}
