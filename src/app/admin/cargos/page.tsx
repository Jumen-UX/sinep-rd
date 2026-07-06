'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type OfficeRow = {
  id: string
  key: string
  display_name: string
  description: string | null
  requires_clergy: boolean
  allowed_person_types: string[]
  status: string
  office_base_roles: { name: string } | { name: string }[] | null
  office_scopes: { name: string } | { name: string }[] | null
  office_categories: { name: string } | { name: string }[] | null
  organization_charts: { name: string } | { name: string }[] | null
}

type ChangeRequest = {
  id: string
  title: string
  description: string | null
  proposed_data: Record<string, unknown>
  status: string
  created_at: string
  submitted_at: string | null
}

const personTypes = [
  ['bishop', 'Obispo'],
  ['priest', 'Sacerdote'],
  ['deacon', 'Diácono'],
  ['religious', 'Religioso/a'],
  ['layperson', 'Laico/a'],
]

const categoryOptions = [
  ['ecclesiastical', 'Eclesial'],
  ['pastoral', 'Pastoral'],
  ['administrative', 'Administrativo'],
]

const scopeOptions = [
  ['parish', 'Parroquial'],
  ['pastoral_zone', 'Zona pastoral'],
  ['diocesan', 'Diocesano'],
  ['national', 'Nacional'],
  ['institutional', 'Institucional'],
]

function relationName(value: { name: string } | { name: string }[] | null) {
  if (!value) return '—'
  if (Array.isArray(value)) return value[0]?.name ?? '—'
  return value.name
}

function personTypeLabel(value: string) {
  return personTypes.find(([key]) => key === value)?.[1] ?? value
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(value))
}

function toPayload(form: FormData) {
  const allowed = personTypes
    .map(([value]) => value)
    .filter((value) => form.get(`person_type_${value}`) === 'on')

  return {
    display_name: String(form.get('display_name') ?? '').trim(),
    key: String(form.get('key') ?? '').trim() || undefined,
    base_role_name: String(form.get('base_role_name') ?? '').trim() || undefined,
    base_role_key: String(form.get('base_role_key') ?? '').trim() || undefined,
    category_key: String(form.get('category_key') ?? 'pastoral'),
    category_name: String(form.get('category_name') ?? '').trim() || undefined,
    scope_key: String(form.get('scope_key') ?? 'diocesan'),
    scope_name: String(form.get('scope_name') ?? '').trim() || undefined,
    organization_chart_key: String(form.get('organization_chart_key') ?? '').trim() || undefined,
    organization_chart_name: String(form.get('organization_chart_name') ?? '').trim() || undefined,
    description: String(form.get('description') ?? '').trim() || undefined,
    reason: String(form.get('reason') ?? '').trim() || undefined,
    source_name: String(form.get('source_name') ?? '').trim() || undefined,
    source_url: String(form.get('source_url') ?? '').trim() || undefined,
    requires_clergy: form.get('requires_clergy') === 'on',
    allowed_person_types: allowed.length > 0 ? allowed : ['bishop', 'priest', 'deacon', 'religious', 'layperson'],
    continues_until_replaced: form.get('continues_until_replaced') !== 'off',
    is_renewable: form.get('is_renewable') !== 'off',
    is_elective: form.get('is_elective') === 'on',
    scope_type: 'other',
    priority: 'normal',
  }
}

export default function AdminCargosPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [offices, setOffices] = useState<OfficeRow[]>([])
  const [requests, setRequests] = useState<ChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    setError(null)

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    const [officeRes, requestRes] = await Promise.all([
      supabase
        .from('office_configurations')
        .select('id,key,display_name,description,requires_clergy,allowed_person_types,status,office_base_roles(name),office_scopes(name),office_categories(name),organization_charts(name)')
        .eq('status', 'active')
        .order('display_name'),
      supabase
        .from('change_requests')
        .select('id,title,description,proposed_data,status,created_at,submitted_at')
        .eq('target_table', 'office_configurations')
        .in('status', ['pending_review', 'needs_changes'])
        .order('submitted_at', { ascending: false, nullsFirst: false }),
    ])

    if (officeRes.error) setError(officeRes.error.message)
    setOffices((officeRes.data ?? []) as unknown as OfficeRow[])
    setRequests((requestRes.data ?? []) as ChangeRequest[])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function submitCargo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)

    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const intent = String(form.get('intent') ?? 'suggest')
    const payload = toPayload(form)

    if (!payload.display_name) {
      setError('Debes indicar el nombre visible del cargo.')
      setSaving(false)
      return
    }

    const endpoint = intent === 'admin_create' ? '/api/admin/cargos' : '/api/admin/cargos/sugerir'

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error ?? 'No se pudo procesar el cargo.')

      setMessage(intent === 'admin_create' ? 'Cargo oficial guardado correctamente.' : 'Sugerencia enviada para revisión.')
      formElement.reset()
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar el cargo.')
    } finally {
      setSaving(false)
    }
  }

  async function reviewRequest(id: string, decision: 'approved' | 'rejected' | 'needs_changes') {
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/solicitudes-cambio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ change_request_id: id, decision }),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error ?? 'No se pudo revisar la solicitud.')

      setMessage(decision === 'approved' ? 'Solicitud aprobada y aplicada.' : 'Solicitud actualizada.')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo revisar la solicitud.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <main className="container"><div className="empty-state">Cargando cargos...</div></main>
  }

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink">
        <Link href="/admin">← Volver al panel administrativo</Link>
      </div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Modelo de crecimiento controlado</p>
          <h1>Cargos y oficios</h1>
          <p className="lead">
            Los administradores crean cargos oficiales. Los editores pueden sugerir cargos nuevos con justificación y fuente para revisión.
          </p>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="empty-state">{message}</div>}

      <section className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Nuevo cargo</p>
            <h2>Crear oficialmente o sugerir</h2>
          </div>
        </div>

        <form className="admin-form admin-config-form" onSubmit={submitCargo}>
          <input name="display_name" placeholder="Nombre visible, ej. Capellán" />
          <input name="key" placeholder="Clave opcional, ej. capellan_institucional" />
          <input name="base_role_name" placeholder="Cargo base, ej. Capellán" />
          <input name="base_role_key" placeholder="Clave del cargo base opcional" />

          <select name="category_key" defaultValue="pastoral">
            {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input name="category_name" placeholder="Nueva categoría si aplica" />

          <select name="scope_key" defaultValue="diocesan">
            {scopeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input name="scope_name" placeholder="Nuevo ámbito si aplica" />

          <input name="organization_chart_name" placeholder="Organigrama, ej. Capellanías" />
          <input name="organization_chart_key" placeholder="Clave de organigrama opcional" />

          <textarea name="description" placeholder="Descripción del cargo" />
          <textarea name="reason" placeholder="Justificación de la sugerencia o motivo administrativo" />
          <input name="source_name" placeholder="Fuente o documento" />
          <input name="source_url" placeholder="URL de fuente" />

          <div className="role-list">
            {personTypes.map(([value, label]) => (
              <label className="role-pill" key={value}>
                <input name={`person_type_${value}`} type="checkbox" defaultChecked={value === 'priest'} /> {label}
              </label>
            ))}
          </div>

          <label className="role-pill"><input name="requires_clergy" type="checkbox" defaultChecked /> Requiere clero</label>
          <label className="role-pill"><input name="is_elective" type="checkbox" /> Es electivo</label>

          <div className="actions">
            <button className="button button-primary" name="intent" value="admin_create" disabled={saving}>Crear cargo oficial</button>
            <button className="button button-secondary" name="intent" value="suggest" disabled={saving}>Sugerir para revisión</button>
          </div>
        </form>
      </section>

      <section className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Solicitudes</p>
            <h2>Sugerencias pendientes</h2>
          </div>
          <span className="meta">{requests.length} pendientes</span>
        </div>

        <div className="timeline-list">
          {requests.length === 0 && <p className="meta">No hay sugerencias pendientes.</p>}
          {requests.map((request) => (
            <div className="timeline-item" key={request.id}>
              <strong>{request.title}</strong>
              <span>{request.description ?? 'Sin justificación registrada'}</span>
              <small>Enviada: {formatDate(request.submitted_at ?? request.created_at)} · Estado: {request.status}</small>
              <small>Cargo: {String(request.proposed_data?.display_name ?? 'No indicado')}</small>
              <div className="actions">
                <button className="button button-primary" onClick={() => reviewRequest(request.id, 'approved')} disabled={saving}>Aprobar</button>
                <button className="button button-secondary" onClick={() => reviewRequest(request.id, 'needs_changes')} disabled={saving}>Pedir cambios</button>
                <button className="button button-secondary" onClick={() => reviewRequest(request.id, 'rejected')} disabled={saving}>Rechazar</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Catálogo oficial</p>
            <h2>Cargos activos</h2>
          </div>
          <span className="meta">{offices.length} cargos</span>
        </div>

        <div className="table-wrap">
          <table className="data-table dashboard-list-table">
            <thead>
              <tr><th>Cargo</th><th>Categoría</th><th>Ámbito</th><th>Organigrama</th><th>Personas permitidas</th></tr>
            </thead>
            <tbody>
              {offices.map((office) => (
                <tr key={office.id}>
                  <td>
                    <div>
                      <strong>{office.display_name}</strong>
                      <br />
                      <small className="meta">{office.key}</small>
                    </div>
                  </td>
                  <td>{relationName(office.office_categories)}</td>
                  <td>{relationName(office.office_scopes)}</td>
                  <td>{relationName(office.organization_charts)}</td>
                  <td>{office.allowed_person_types?.map(personTypeLabel).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
