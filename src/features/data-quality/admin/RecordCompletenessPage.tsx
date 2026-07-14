'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  getAuthenticatedUserId,
  loadRecordCompleteness,
  saveDataFieldStatus,
  type CompletenessRow,
  type DataFieldStatus,
  type DataQualityTargetKind,
} from '../services/data-quality-admin-service'

type Segment = 'all' | 'dioceses' | 'parishes' | 'chapels' | 'clergy' | 'bishops' | 'priests' | 'pending' | 'complete'

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
    'Tipo de registro': 'person_type',
    Género: 'gender',
    'Fecha de nacimiento': 'birth_date',
    'Lugar de nacimiento': 'birth_place',
    'Biografía pública': 'biography_public',
  }
  return map[label] ?? label
}

function recordUrl(kind: DataQualityTargetKind, slug: string) {
  return kind === 'persons' ? `/personas/${slug}` : `/entidades/${slug}`
}

function displayRecordType(row: CompletenessRow) {
  const labels: Record<string, string> = {
    bishop: 'Obispo',
    priest: 'Sacerdote',
    deacon: 'Diácono',
    religious: 'Religioso/a',
    lay: 'Laico/a',
  }
  return row.entity_type_name ?? labels[row.person_type ?? ''] ?? row.person_type ?? '—'
}

function segmentLabel(segment: Segment) {
  const labels: Record<Segment, string> = {
    all: 'Todas las fichas',
    dioceses: 'Diócesis',
    parishes: 'Parroquias',
    chapels: 'Capillas',
    clergy: 'Clero y agentes',
    bishops: 'Obispos',
    priests: 'Sacerdotes',
    pending: 'Datos pendientes',
    complete: 'Fichas completas',
  }
  return labels[segment]
}

export default function RecordCompletenessPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [kind, setKind] = useState<DataQualityTargetKind>('ecclesiastical_entities')
  const [segment, setSegment] = useState<Segment>('all')
  const [scopeMode, setScopeMode] = useState<'all' | 'mine'>('all')
  const [entities, setEntities] = useState<CompletenessRow[]>([])
  const [agents, setAgents] = useState<CompletenessRow[]>([])
  const [fieldStatuses, setFieldStatuses] = useState<DataFieldStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function sourceRows(targetKind = kind) {
    return targetKind === 'ecclesiastical_entities' ? entities : agents
  }

  function matchesSegment(row: CompletenessRow, targetKind = kind, targetSegment = segment) {
    if (targetSegment === 'pending') return row.missing_count > 0
    if (targetSegment === 'complete') return row.missing_count === 0

    if (targetKind === 'ecclesiastical_entities') {
      if (targetSegment === 'dioceses') return ['archdiocese', 'diocese', 'military_ordinariate'].includes(row.entity_type_key ?? '')
      if (targetSegment === 'parishes') return ['parish', 'quasi_parish'].includes(row.entity_type_key ?? '')
      if (targetSegment === 'chapels') return row.entity_type_key === 'chapel'
      if (['clergy', 'bishops', 'priests'].includes(targetSegment)) return false
    }

    if (targetKind === 'persons') {
      if (targetSegment === 'clergy') return ['bishop', 'priest', 'deacon', 'religious', 'lay'].includes(row.person_type ?? '')
      if (targetSegment === 'bishops') return row.person_type === 'bishop'
      if (targetSegment === 'priests') return row.person_type === 'priest'
      if (['dioceses', 'parishes', 'chapels'].includes(targetSegment)) return false
    }

    return true
  }

  const rows = sourceRows().filter((row) => matchesSegment(row))
  const pendingRows = rows.filter((row) => row.missing_count > 0).sort((a, b) => a.completion_percent - b.completion_percent)
  const average = rows.length > 0 ? Math.round(rows.reduce((sum, row) => sum + row.completion_percent, 0) / rows.length) : 0
  const exceptionCount = fieldStatuses.filter((status) => status.record_table === kind && rows.some((row) => row.id === status.record_id)).length

  function count(targetKind: DataQualityTargetKind, targetSegment: Segment) {
    return sourceRows(targetKind).filter((row) => matchesSegment(row, targetKind, targetSegment)).length
  }

  function selectSegment(targetKind: DataQualityTargetKind, targetSegment: Segment) {
    setKind(targetKind)
    setSegment(targetSegment)
  }

  async function loadData() {
    setError(null)

    try {
      const userId = await getAuthenticatedUserId(supabase)
      if (!userId) {
        router.push('/admin/login')
        return
      }

      const snapshot = await loadRecordCompleteness(supabase)
      setEntities(snapshot.entities)
      setAgents(snapshot.persons)
      setFieldStatuses(snapshot.fieldStatuses)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el estado de fichas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function markUnknown(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    setError(null)

    const form = new FormData(event.currentTarget)
    const recordTable = String(form.get('record_table') ?? '') as DataQualityTargetKind
    const recordId = String(form.get('record_id') ?? '')
    const fieldName = String(form.get('field_name') ?? '')
    const status = form.get('status') === 'not_applicable' ? 'not_applicable' : 'unknown'

    if (!recordTable || !recordId || !fieldName) {
      setError('Selecciona la ficha y el dato que vas a marcar.')
      setSaving(false)
      return
    }

    try {
      const userId = await getAuthenticatedUserId(supabase)
      if (!userId) {
        router.push('/admin/login')
        return
      }

      await saveDataFieldStatus(supabase, {
        recordTable,
        recordId,
        fieldName,
        status,
        notes: String(form.get('notes') ?? '').trim() || null,
        userId,
      })

      setMessage('Dato marcado. Ya no generará alerta pendiente.')
      event.currentTarget.reset()
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el estado del dato.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className="container"><div className="empty-state">Cargando estado de fichas...</div></main>

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink"><Link href="/admin">← Volver al panel administrativo</Link></div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Calidad de datos</p>
          <h1>Estado de fichas</h1>
          <p className="lead">Filtra por ámbito, tipo de ficha y datos pendientes para organizar el trabajo de carga y revisión.</p>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="empty-state">{message}</div>}

      <section className="dashboard-grid dashboard-summary">
        <button className={`metric-card metric-button ${scopeMode === 'all' ? 'active-filter' : ''}`} type="button" onClick={() => setScopeMode('all')}>
          <strong>Todas</strong><span>Fichas visibles</span>
        </button>
        <button className={`metric-card metric-button ${scopeMode === 'mine' ? 'active-filter' : ''}`} type="button" onClick={() => setScopeMode('mine')}>
          <strong>Mi ámbito</strong><span>Filtro operativo</span>
        </button>
        <div className="metric-card"><strong>{rows.length}</strong><span>{segmentLabel(segment)}</span></div>
        <div className="metric-card"><strong>{average}%</strong><span>Avance promedio</span></div>
      </section>

      {scopeMode === 'mine' && <div className="empty-state">Este filtro queda preparado para limitar por diócesis, parroquia o pastoral asignada cuando se configuren los ámbitos de cada usuario.</div>}

      <section className="dashboard-grid dashboard-summary">
        <button className={`metric-card metric-button ${kind === 'ecclesiastical_entities' && segment === 'all' ? 'active-filter' : ''}`} type="button" onClick={() => selectSegment('ecclesiastical_entities', 'all')}><strong>{count('ecclesiastical_entities', 'all')}</strong><span>Entidades</span></button>
        <button className={`metric-card metric-button ${segment === 'dioceses' ? 'active-filter' : ''}`} type="button" onClick={() => selectSegment('ecclesiastical_entities', 'dioceses')}><strong>{count('ecclesiastical_entities', 'dioceses')}</strong><span>Diócesis</span></button>
        <button className={`metric-card metric-button ${segment === 'parishes' ? 'active-filter' : ''}`} type="button" onClick={() => selectSegment('ecclesiastical_entities', 'parishes')}><strong>{count('ecclesiastical_entities', 'parishes')}</strong><span>Parroquias</span></button>
        <button className={`metric-card metric-button ${segment === 'chapels' ? 'active-filter' : ''}`} type="button" onClick={() => selectSegment('ecclesiastical_entities', 'chapels')}><strong>{count('ecclesiastical_entities', 'chapels')}</strong><span>Capillas</span></button>
        <button className={`metric-card metric-button ${kind === 'persons' && segment === 'clergy' ? 'active-filter' : ''}`} type="button" onClick={() => selectSegment('persons', 'clergy')}><strong>{count('persons', 'clergy')}</strong><span>Clero y agentes</span></button>
        <button className={`metric-card metric-button ${segment === 'bishops' ? 'active-filter' : ''}`} type="button" onClick={() => selectSegment('persons', 'bishops')}><strong>{count('persons', 'bishops')}</strong><span>Obispos</span></button>
        <button className={`metric-card metric-button ${segment === 'priests' ? 'active-filter' : ''}`} type="button" onClick={() => selectSegment('persons', 'priests')}><strong>{count('persons', 'priests')}</strong><span>Sacerdotes</span></button>
        <button className={`metric-card metric-button ${segment === 'pending' ? 'active-filter' : ''}`} type="button" onClick={() => setSegment('pending')}><strong>{pendingRows.length}</strong><span>Datos pendientes</span></button>
        <button className={`metric-card metric-button ${segment === 'complete' ? 'active-filter' : ''}`} type="button" onClick={() => setSegment('complete')}><strong>{rows.filter((row) => row.missing_count === 0).length}</strong><span>Completas</span></button>
        <div className="metric-card"><strong>{exceptionCount}</strong><span>No identificado / no aplica</span></div>
      </section>

      <section className="card dashboard-section">
        <div className="section-heading">
          <div><p className="eyebrow">Alertas</p><h2>Datos pendientes</h2></div>
          <span className="meta">{pendingRows.length} pendientes</span>
        </div>
        <div className="table-wrap">
          <table className="data-table dashboard-list-table">
            <thead><tr><th>Ficha</th><th>Tipo</th><th>%</th><th>Faltan</th><th>Acción</th></tr></thead>
            <tbody>
              {pendingRows.map((row) => (
                <tr key={row.id}>
                  <td><Link href={recordUrl(kind, row.slug)}>{row.name}</Link></td>
                  <td>{displayRecordType(row)}</td>
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
          <select name="record_table" value={kind} onChange={(event) => setKind(event.target.value as DataQualityTargetKind)}>
            <option value="ecclesiastical_entities">Entidad eclesiástica</option>
            <option value="persons">Clero o agente</option>
          </select>
          <select name="record_id" defaultValue="">
            <option value="">Selecciona ficha</option>
            {pendingRows.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
          <select name="field_name" defaultValue="">
            <option value="">Dato pendiente</option>
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
