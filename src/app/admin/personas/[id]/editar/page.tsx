'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type PersonDetail = {
  person_id: string
  display_name: string | null
  person_type: string | null
  status: string | null
  birth_date: string | null
  birth_place: string | null
  death_date: string | null
  biography_public: string | null
  priest_type: string | null
  deacon_type: string | null
  canonical_status: string | null
  religious_institute_name: string | null
  can_update_proposal: boolean
}

type FormState = {
  display_name: string
  person_type: string
  status: string
  birth_date: string
  birth_place: string
  death_date: string
  biography_public: string
  priest_type: string
  deacon_type: string
  canonical_status: string
  religious_institute_name: string
  description: string
}

function toFormState(person: PersonDetail): FormState {
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
  const [form, setForm] = useState<FormState | null>(null)
  const [person, setPerson] = useState<PersonDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function loadPerson() {
      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (userError || !userData.user) {
        router.replace('/admin/login')
        return
      }

      const { data, error: detailError } = await supabase.rpc('admin_get_person_detail', {
        p_person_id: params.id,
      })

      if (detailError) {
        setError(detailError.message)
        setLoading(false)
        return
      }

      const firstRow = Array.isArray(data) ? data[0] : null

      if (!firstRow) {
        setError('No tienes acceso a esta persona o no existe.')
        setLoading(false)
        return
      }

      const detail = firstRow as PersonDetail

      if (!detail.can_update_proposal) {
        setError('No tienes permiso para proponer cambios sobre esta persona.')
        setLoading(false)
        return
      }

      setPerson(detail)
      setForm(toFormState(detail))
      setLoading(false)
    }

    loadPerson()
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

    const supabase = createClient()
    const { data, error: proposalError } = await supabase.rpc('admin_create_person_change_proposal', {
      p_person_id: params.id,
      p_proposed_data: {
        display_name: form.display_name,
        person_type: form.person_type,
        status: form.status,
        birth_date: form.birth_date,
        birth_place: form.birth_place,
        death_date: form.death_date,
        biography_public: form.biography_public,
        priest_type: form.priest_type,
        deacon_type: form.deacon_type,
        canonical_status: form.canonical_status,
        religious_institute_name: form.religious_institute_name,
      },
      p_description: form.description,
    })

    if (proposalError) {
      setError(proposalError.message)
      setSaving(false)
      return
    }

    const changeId = typeof data === 'object' && data && 'id' in data ? String(data.id) : null
    setNotice(changeId ? `Propuesta enviada. Solicitud: ${changeId}` : 'Propuesta enviada correctamente.')
    setSaving(false)
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
          <p className="lead">Los cambios se enviarán a revisión. No se modifica la ficha real hasta aprobación.</p>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {notice && <div className="empty-state">{notice}</div>}

      <section className="card admin-section">
        <form className="auth-form access-form" onSubmit={handleSubmit}>
          <label>
            Nombre visible
            <input value={form.display_name} onChange={(event) => updateField('display_name', event.target.value)} />
          </label>

          <label>
            Tipo de persona
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

          <label>
            Estado
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

          <label>
            Fecha de nacimiento
            <input type="date" value={form.birth_date} onChange={(event) => updateField('birth_date', event.target.value)} />
          </label>

          <label>
            Lugar de nacimiento
            <input value={form.birth_place} onChange={(event) => updateField('birth_place', event.target.value)} />
          </label>

          <label>
            Fecha de fallecimiento
            <input type="date" value={form.death_date} onChange={(event) => updateField('death_date', event.target.value)} />
          </label>

          <label>
            Estado canónico
            <input value={form.canonical_status} onChange={(event) => updateField('canonical_status', event.target.value)} />
          </label>

          <label>
            Tipo de sacerdote
            <select value={form.priest_type} onChange={(event) => updateField('priest_type', event.target.value)}>
              <option value="">No aplica / no indicado</option>
              <option value="diocesan">Diocesano</option>
              <option value="religious">Religioso</option>
            </select>
          </label>

          <label>
            Tipo de diácono
            <select value={form.deacon_type} onChange={(event) => updateField('deacon_type', event.target.value)}>
              <option value="">No aplica / no indicado</option>
              <option value="permanent">Permanente</option>
              <option value="transitional">Transitorio</option>
            </select>
          </label>

          <label>
            Instituto religioso
            <input value={form.religious_institute_name} onChange={(event) => updateField('religious_institute_name', event.target.value)} />
          </label>

          <label>
            Biografía pública
            <textarea value={form.biography_public} onChange={(event) => updateField('biography_public', event.target.value)} rows={6} />
          </label>

          <label>
            Justificación / fuente del cambio
            <textarea required value={form.description} onChange={(event) => updateField('description', event.target.value)} rows={4} placeholder="Indica la fuente, documento o razón pastoral/administrativa del cambio." />
          </label>

          <button className="button button-primary" disabled={saving} type="submit">
            {saving ? 'Enviando...' : 'Enviar propuesta'}
          </button>
        </form>
      </section>
    </main>
  )
}
