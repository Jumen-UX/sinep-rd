'use client'

import { type FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  createPersonChangeProposal,
  getAdminPersonDetail,
  type AdminPersonDetail,
  type PersonChangeProposalInput,
} from '../services/person-admin-service'

type FormState = PersonChangeProposalInput & { description: string }

function toFormState(person: AdminPersonDetail): FormState {
  return {
    display_name: person.display_name ?? '',
    person_type: person.person_type ?? '',
    status: person.status ?? '',
    birth_date: person.birth_date ?? '',
    birth_place: person.birth_place ?? '',
    death_date: person.death_date ?? '',
    biography_public: person.biography_public ?? '',
    priest_type: person.priest_type ?? '',
    deacon_type: person.deacon_type ?? '',
    canonical_status: person.canonical_status ?? '',
    religious_institute_name: person.religious_institute_name ?? '',
    description: '',
  }
}

export default function EditPersonProposalPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [person, setPerson] = useState<AdminPersonDetail | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data, error: authError } = await supabase.auth.getUser()
      if (authError || !data.user) {
        router.replace('/admin/login')
        return
      }

      try {
        const detail = await getAdminPersonDetail(supabase, params.id)
        if (!detail) throw new Error('No tienes acceso a esta persona o no existe.')
        if (!detail.can_update_proposal) throw new Error('No tienes permiso para proponer cambios sobre esta persona.')
        setPerson(detail)
        setForm(toFormState(detail))
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la ficha.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [params.id, router])

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => current ? { ...current, [field]: value } : current)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) return

    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      const { description, ...proposedData } = form
      const changeId = await createPersonChangeProposal(createClient(), params.id, proposedData, description)
      setNotice(changeId ? `Propuesta enviada. Solicitud: ${changeId}` : 'Propuesta enviada correctamente.')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo enviar la propuesta.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className="container"><div className="empty-state">Cargando formulario...</div></main>

  if (error && !form) {
    return (
      <main className="container dashboard-page">
        <div className="detail-backlink"><Link href="/admin/personas">← Volver a personas</Link></div>
        <div className="error-box">{error}</div>
      </main>
    )
  }

  if (!form || !person) return null

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink"><Link href={`/admin/personas/${params.id}`}>← Volver a la ficha</Link></div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Propuesta de cambio</p>
          <h1>{person.display_name ?? 'Persona sin nombre'}</h1>
          <p className="lead">Los cambios se envían a revisión y no modifican la ficha real hasta ser aprobados.</p>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {notice && <div className="success-box">{notice}</div>}

      <section className="card admin-section">
        <form className="auth-form access-form" onSubmit={handleSubmit}>
          <label>Nombre visible<input value={form.display_name} onChange={(event) => updateField('display_name', event.target.value)} /></label>

          <label>Tipo de persona
            <select value={form.person_type} onChange={(event) => updateField('person_type', event.target.value)}>
              <option value="">No indicado</option>
              <option value="bishop">Obispo</option>
              <option value="priest">Sacerdote</option>
              <option value="deacon">Diácono</option>
              <option value="religious">Religioso/a</option>
              <option value="layperson">Laico/a</option>
              <option value="seminarian">Seminarista</option>
            </select>
          </label>

          <label>Estado
            <select value={form.status} onChange={(event) => updateField('status', event.target.value)}>
              <option value="">No indicado</option>
              <option value="active">Activo/a</option>
              <option value="retired">Retirado/a</option>
              <option value="emeritus">Emérito</option>
              <option value="transferred">Trasladado/a</option>
              <option value="inactive">Inactivo/a</option>
              <option value="suspended">Suspendido/a</option>
              <option value="deceased">Fallecido/a</option>
            </select>
          </label>

          <label>Fecha de nacimiento<input type="date" value={form.birth_date} onChange={(event) => updateField('birth_date', event.target.value)} /></label>
          <label>Lugar de nacimiento<input value={form.birth_place} onChange={(event) => updateField('birth_place', event.target.value)} /></label>
          <label>Fecha de fallecimiento<input type="date" value={form.death_date} onChange={(event) => updateField('death_date', event.target.value)} /></label>

          <label>Estado canónico
            <select value={form.canonical_status} onChange={(event) => updateField('canonical_status', event.target.value)}>
              <option value="">No indicado</option>
              <option value="active">Activo</option>
              <option value="retired">Retirado</option>
              <option value="suspended">Suspendido</option>
              <option value="deceased">Fallecido</option>
              <option value="unknown">No identificado</option>
            </select>
          </label>

          <label>Tipo de sacerdote
            <select value={form.priest_type} onChange={(event) => updateField('priest_type', event.target.value)}>
              <option value="">No aplica / no indicado</option>
              <option value="diocesan">Diocesano</option>
              <option value="religious">Religioso</option>
            </select>
          </label>

          <label>Tipo de diácono
            <select value={form.deacon_type} onChange={(event) => updateField('deacon_type', event.target.value)}>
              <option value="">No aplica / no indicado</option>
              <option value="permanent">Permanente</option>
              <option value="transitional">Transitorio</option>
            </select>
          </label>

          <label>Instituto religioso<input value={form.religious_institute_name} onChange={(event) => updateField('religious_institute_name', event.target.value)} /></label>
          <label>Biografía pública<textarea rows={6} value={form.biography_public} onChange={(event) => updateField('biography_public', event.target.value)} /></label>
          <label>Justificación o fuente del cambio<textarea required rows={4} value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Indica la fuente, documento o razón pastoral/administrativa." /></label>

          <button className="button button-primary" disabled={saving} type="submit">{saving ? 'Enviando...' : 'Enviar propuesta'}</button>
        </form>
      </section>
    </main>
  )
}
