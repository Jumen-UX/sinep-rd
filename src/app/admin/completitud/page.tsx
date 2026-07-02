'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type CompletenessRow = {
  id: string
  name: string
  slug: string
  entity_type_name?: string | null
  entity_type_key?: string | null
  person_type?: string | null
  required_count: number
  missing_count: number
  missing_fields: string[] | null
  completion_percent: number
}

type TargetKind = 'ecclesiastical_entities' | 'persons'

function fieldKey(label: string) {
  const map: Record<string, string> = {
    Nombre: 'name',
    'Nombre oficial': 'official_name',
    Dirección: 'address',
    Teléfono: 'phone',
    Territorio: 'territory_summary',
    'Fecha de erección/creación': 'erected_at',
    Correo: 'email',
    'Sitio web': 'website',
    'Tipo de persona': 'person_type',
    Género: 'gender',
    'Fecha de nacimiento': 'birth_date',
    'Lugar de nacimiento': 'birth_place',
    'Biografía pública': 'biography_public',
  }
  return map[label] ?? label
}

function recordUrl(kind: TargetKind, slug: string) {
  return kind === 'persons' ? `/personas/${slug}` : `/entidades/${slug}`
}

export default function AdminCompletitudPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [kind, setKind] = useState<TargetKind>('ecclesiastical_entities')
  const [entities, setEntities] = useState<CompletenessRow[]>([])
  const [people, setPeople] = useState<CompletenessRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const rows = kind === 'ecclesiastical_entities' ? entities : people
  const pendingRows = rows.filter((row) => row.missing_count > 0).sort((a, b) => a.completion_percent - b.completion_percent)
  const average = rows.length > 0 ? Math.round(rows.reduce((sum, row) => sum + row.completion_percent, 0) / rows.length) : 0

  async function loadData() {
    setError(null)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    const [entityRes, personRes] = await Promise.all([
      supabase.from('admin_entity_completeness').select('*').order('completion_percent', { ascending: true }).limit(300),
      supabase.from('admin_person_completeness').select('*').order('completion_percent', { ascending: true }).limit(300),
    ])

    if (entityRes.error || personRes.error) {
      setError(entityRes.error?.message ?? personRes.error?.message ?? 'No se pudo cargar completitud')
    } else {
      setEntities((entityRes.data ?? []) as CompletenessRow[])
      setPeople((personRes.data ?? []) as CompletenessRow[])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function markUnknown(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    setError(null)

    const form = new FormData(event.currentTarget)
    const recordTable = String(form.get('record_table') ?? '') as TargetKind
    const recordId = String(form.get('record_id') ?? '')
    const fieldName = String(form.get('field_name') ?? '')
    const status = String(form.get('status') ?? 'unknown')

    if (!recordTable || !recordId || !fieldName) {
      setError('Selecciona el registro y el dato que vas a marcar.')
      setSaving(false)
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    const { error: saveError } = await supabase.from('data_field_statuses').upsert({
      record_table: recordTable,
      record_id: recordId,
      field_name: fieldName,
      status,
      notes: String(form.get('notes') ?? '').trim() || null,
      created_by: userData.user?.id ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'record_table,record_id,field_name' })

    if (saveError) {
      setError(saveError.message)
    } else {
      setMessage('Dato marcado. Ya no generará alerta de completitud.')
      event.currentTarget.reset()
      await loadData()
    }
    setSaving(false)
  }

  if (loading) return <main className="container"><div className="empty-state">Cargando completitud...</div></main>

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink"><Link href="/admin">← Volver al panel administrativo</Link></div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Calidad de datos</p>
          <h1>Completitud de fichas</h1>
          <p className="lead">Visualiza el porcentaje de fichas completadas y marca datos como no identificados o no aplicables para que dejen de generar alertas.</p>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="empty-state">{message}</div>}

      <section className="dashboard-grid dashboard-summary">
        <button className={`metric-card metric-button ${kind === 'ecclesiastical_entities' ? 'active-filter' : ''}`} type="button" onClick={() => setKind('ecclesiastical_entities')}>
          <strong>{entities.length}</strong><span>Entidades · promedio {entities.length ? Math.round(entities.reduce((s, r) => s + r.completion_percent, 0) / entities.length) : 0}%</span>
        </button>
        <button className={`metric-card metric-button ${kind === 'persons' ? 'active-filter' : ''}`} type="button" onClick={() => setKind('persons')}>
          <strong>{people.length}</strong><span>Personas · promedio {people.length ? Math.round(people.reduce((s, r) => s + r.completion_percent, 0) / people.length) : 0}%</span>
        </button>
        <div className="metric-card"><strong>{pendingRows.length}</strong><span>Fichas con datos faltantes</span></div>
        <div className="metric-card"><strong>{average}%</strong><span>Completitud promedio actual</span></div>
      </section>

      <section className="card dashboard-section">
        <div className="section-heading">
          <div><p className="eyebrow">Alertas</p><h2>Datos faltantes</h2></div>
          <span className="meta">{pendingRows.length} pendientes</span>
        </div>
        <div className="table-wrap">
          <table className="data-table dashboard-list-table">
            <thead><tr><th>Ficha</th><th>Tipo</th><th>%</th><th>Faltan</th><th>Acción</th></tr></thead>
            <tbody>
              {pendingRows.map((row) => (
                <tr key={row.id}>
                  <td><Link href={recordUrl(kind, row.slug)}>{row.name}</Link></td>
                  <td>{row.entity_type_name ?? row.person_type ?? '—'}</td>
                  <td><strong>{row.completion_percent}%</strong></td>
                  <td>{(row.missing_fields ?? []).join(', ') || '—'}</td>
                  <td><a href="#marcar">Marcar dato</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="marcar" className="card dashboard-section">
        <div className="section-heading">
          <div><p className="eyebrow">Excepción</p><h2>Marcar dato no identificado</h2></div>
        </div>
        <form className="admin-form admin-config-form" onSubmit={markUnknown}>
          <select name="record_table" value={kind} onChange={(event) => setKind(event.target.value as TargetKind)}>
            <option value="ecclesiastical_entities">Entidad eclesiástica</option>
            <option value="persons">Persona</option>
          </select>
          <select name="record_id" defaultValue="">
            <option value="">Selecciona ficha</option>
            {pendingRows.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
          <select name="field_name" defaultValue="">
            <option value="">Dato faltante</option>
            {Array.from(new Set(pendingRows.flatMap((row) => row.missing_fields ?? []))).map((field) => <option key={field} value={fieldKey(field)}>{field}</option>)}
          </select>
          <select name="status" defaultValue="unknown">
            <option value="unknown">No identificado</option>
            <option value="not_applicable">No aplica</option>
          </select>
          <textarea name="notes" placeholder="Nota: dónde se buscó, por qué no se identificó o por qué no aplica" />
          <button className="button button-primary" disabled={saving}>{saving ? 'Guardando...' : 'Marcar y ocultar alerta'}</button>
        </form>
      </section>
    </main>
  )
}
