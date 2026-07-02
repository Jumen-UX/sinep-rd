'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Entity = {
  id: string
  name: string
  slug: string
  entity_type_id: string | null
}

type PastoralEntity = {
  id: string
  name: string
  slug: string
}

type Chart = {
  id: string
  key: string
  name: string
}

type Unit = {
  id: string
  organization_chart_id: string
  parent_unit_id: string | null
  key: string
  name: string
  status: string | null
}

type EntityRelationship = {
  id: string
  parent_entity_id: string
  child_entity_id: string
  relationship_type: string | null
  start_date: string | null
  is_current: boolean
  notes: string | null
}

type PastoralRelationship = {
  id: string
  parent_pastoral_entity_id: string
  child_pastoral_entity_id: string
  relationship_type: string | null
  start_date: string | null
  is_current: boolean
  notes: string | null
}

type TabKey = 'territorial' | 'pastoral' | 'administrative'

const tabLabels: Record<TabKey, string> = {
  territorial: 'Territorial',
  pastoral: 'Pastoral',
  administrative: 'Administrativa',
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

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

export default function AdminEstructuraPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [activeTab, setActiveTab] = useState<TabKey>('territorial')
  const [entities, setEntities] = useState<Entity[]>([])
  const [pastoralEntities, setPastoralEntities] = useState<PastoralEntity[]>([])
  const [charts, setCharts] = useState<Chart[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [entityRelationships, setEntityRelationships] = useState<EntityRelationship[]>([])
  const [pastoralRelationships, setPastoralRelationships] = useState<PastoralRelationship[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedChartId, setSelectedChartId] = useState('')

  function entityName(id: string | null) {
    if (!id) return '—'
    return entities.find((item) => item.id === id)?.name ?? 'Entidad no encontrada'
  }

  function pastoralName(id: string | null) {
    if (!id) return '—'
    return pastoralEntities.find((item) => item.id === id)?.name ?? 'Pastoral no encontrada'
  }

  function unitName(id: string | null) {
    if (!id) return '—'
    return units.find((item) => item.id === id)?.name ?? 'Unidad no encontrada'
  }

  async function loadData() {
    setError(null)

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    const [entityRes, pastoralRes, chartRes, unitRes, entityRelRes, pastoralRelRes] = await Promise.all([
      supabase.from('ecclesiastical_entities').select('id,name,slug,entity_type_id').eq('status', 'active').order('name'),
      supabase.from('pastoral_entities').select('id,name,slug').eq('status', 'active').order('name'),
      supabase.from('organization_charts').select('id,key,name').eq('status', 'active').order('sort_order'),
      supabase.from('organization_units').select('id,organization_chart_id,parent_unit_id,key,name,status').eq('status', 'active').order('name'),
      supabase.from('entity_relationships').select('id,parent_entity_id,child_entity_id,relationship_type,start_date,is_current,notes').eq('status', 'active').order('created_at', { ascending: false }).limit(150),
      supabase.from('pastoral_relationships').select('id,parent_pastoral_entity_id,child_pastoral_entity_id,relationship_type,start_date,is_current,notes').eq('status', 'active').order('created_at', { ascending: false }).limit(150),
    ])

    const failed = [entityRes, pastoralRes, chartRes, unitRes, entityRelRes, pastoralRelRes].find((item) => item.error)
    if (failed?.error) {
      setError(failed.error.message)
    } else {
      setEntities((entityRes.data ?? []) as Entity[])
      setPastoralEntities((pastoralRes.data ?? []) as PastoralEntity[])
      setCharts((chartRes.data ?? []) as Chart[])
      setUnits((unitRes.data ?? []) as Unit[])
      setEntityRelationships((entityRelRes.data ?? []) as EntityRelationship[])
      setPastoralRelationships((pastoralRelRes.data ?? []) as PastoralRelationship[])
      if (!selectedChartId && chartRes.data?.[0]?.id) setSelectedChartId(chartRes.data[0].id)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function saveTerritorial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)

    const form = new FormData(event.currentTarget)
    const parentId = String(form.get('parent_entity_id') ?? '')
    const childId = String(form.get('child_entity_id') ?? '')
    const startDate = emptyToNull(form.get('start_date'))

    if (!parentId || !childId) {
      setError('Selecciona entidad superior y entidad dependiente.')
      setSaving(false)
      return
    }

    if (parentId === childId) {
      setError('Una entidad no puede depender de sí misma.')
      setSaving(false)
      return
    }

    await supabase
      .from('entity_relationships')
      .update({ is_current: false, end_date: startDate })
      .eq('child_entity_id', childId)
      .eq('is_current', true)

    const { error: insertError } = await supabase.from('entity_relationships').insert({
      parent_entity_id: parentId,
      child_entity_id: childId,
      relationship_type: String(form.get('relationship_type') ?? 'territorial'),
      start_date: startDate,
      is_current: true,
      status: 'active',
      notes: emptyToNull(form.get('notes')),
    })

    if (insertError) {
      setError(insertError.message)
    } else {
      setMessage('Dependencia territorial guardada correctamente.')
      event.currentTarget.reset()
      await loadData()
    }

    setSaving(false)
  }

  async function savePastoral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)

    const form = new FormData(event.currentTarget)
    const parentId = String(form.get('parent_pastoral_entity_id') ?? '')
    const childId = String(form.get('child_pastoral_entity_id') ?? '')
    const startDate = emptyToNull(form.get('start_date'))

    if (!parentId || !childId) {
      setError('Selecciona pastoral superior y pastoral dependiente.')
      setSaving(false)
      return
    }

    if (parentId === childId) {
      setError('Una pastoral no puede depender de sí misma.')
      setSaving(false)
      return
    }

    await supabase
      .from('pastoral_relationships')
      .update({ is_current: false, end_date: startDate })
      .eq('child_pastoral_entity_id', childId)
      .eq('is_current', true)

    const { error: insertError } = await supabase.from('pastoral_relationships').insert({
      parent_pastoral_entity_id: parentId,
      child_pastoral_entity_id: childId,
      relationship_type: String(form.get('relationship_type') ?? 'pastoral'),
      start_date: startDate,
      is_current: true,
      status: 'active',
      notes: emptyToNull(form.get('notes')),
    })

    if (!insertError) {
      await supabase.from('pastoral_entities').update({ parent_pastoral_entity_id: parentId }).eq('id', childId)
    }

    if (insertError) {
      setError(insertError.message)
    } else {
      setMessage('Dependencia pastoral guardada correctamente.')
      event.currentTarget.reset()
      await loadData()
    }

    setSaving(false)
  }

  async function saveAdministrative(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)

    const form = new FormData(event.currentTarget)
    const mode = String(form.get('admin_mode') ?? 'update')
    const chartId = String(form.get('organization_chart_id') ?? '')
    const parentUnitId = emptyToNull(form.get('parent_unit_id'))

    if (!chartId) {
      setError('Selecciona un organigrama.')
      setSaving(false)
      return
    }

    if (mode === 'create') {
      const name = String(form.get('new_unit_name') ?? '').trim()
      if (!name) {
        setError('Escribe el nombre de la unidad nueva.')
        setSaving(false)
        return
      }

      const { error: insertError } = await supabase.from('organization_units').insert({
        organization_chart_id: chartId,
        parent_unit_id: parentUnitId,
        name,
        key: `${slugify(name)}-${Date.now().toString(36)}`,
        description: emptyToNull(form.get('notes')),
        sort_order: 100,
        visibility: 'public',
        status: 'active',
      })

      if (insertError) setError(insertError.message)
      else {
        setMessage('Unidad administrativa creada correctamente.')
        event.currentTarget.reset()
        await loadData()
      }
    } else {
      const unitId = String(form.get('unit_id') ?? '')
      if (!unitId) {
        setError('Selecciona la unidad que quieres mover.')
        setSaving(false)
        return
      }
      if (unitId === parentUnitId) {
        setError('Una unidad no puede depender de sí misma.')
        setSaving(false)
        return
      }

      const { error: updateError } = await supabase
        .from('organization_units')
        .update({ parent_unit_id: parentUnitId, organization_chart_id: chartId })
        .eq('id', unitId)

      if (updateError) setError(updateError.message)
      else {
        setMessage('Dependencia administrativa actualizada correctamente.')
        event.currentTarget.reset()
        await loadData()
      }
    }

    setSaving(false)
  }

  const filteredUnits = selectedChartId
    ? units.filter((unit) => unit.organization_chart_id === selectedChartId)
    : units

  if (loading) {
    return <main className="container"><div className="empty-state">Cargando estructura...</div></main>
  }

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink">
        <Link href="/admin">← Volver al panel administrativo</Link>
      </div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Estructura institucional</h1>
          <p className="lead">
            Administra por separado la estructura territorial, la estructura pastoral y la estructura administrativa. Así el sistema no confunde una vicaría territorial con una vicaría pastoral.
          </p>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="empty-state">{message}</div>}

      <div className="dashboard-grid dashboard-summary">
        {(Object.keys(tabLabels) as TabKey[]).map((tab) => (
          <button
            className={`metric-card metric-button ${activeTab === tab ? 'active-filter' : ''}`}
            key={tab}
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            <strong>{tabLabels[tab]}</strong>
            <span>{tab === 'territorial' ? 'Diócesis, vicarías territoriales, zonas y parroquias' : tab === 'pastoral' ? 'Vicaría de pastoral, áreas y equipos' : 'Curia, oficinas y departamentos'}</span>
          </button>
        ))}
      </div>

      {activeTab === 'territorial' && (
        <section className="card dashboard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Estructura territorial</p>
              <h2>Dependencias eclesiásticas territoriales</h2>
            </div>
          </div>
          <form className="admin-form admin-config-form" onSubmit={saveTerritorial}>
            <select name="parent_entity_id" defaultValue="">
              <option value="">Entidad superior</option>
              {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
            </select>
            <select name="child_entity_id" defaultValue="">
              <option value="">Entidad dependiente</option>
              {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
            </select>
            <select name="relationship_type" defaultValue="territorial">
              <option value="territorial">Territorial</option>
              <option value="jurisdiction">Jurisdicción</option>
              <option value="depends_on">Dependencia</option>
              <option value="contains">Contiene</option>
            </select>
            <label>Fecha de inicio<input name="start_date" type="date" /></label>
            <textarea name="notes" placeholder="Notas internas o públicas" />
            <button className="button button-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar dependencia territorial'}</button>
          </form>

          <div className="table-wrap">
            <table className="data-table dashboard-list-table">
              <thead><tr><th>Superior</th><th>Dependiente</th><th>Relación</th><th>Inicio</th><th>Actual</th></tr></thead>
              <tbody>
                {entityRelationships.map((rel) => (
                  <tr key={rel.id}>
                    <td>{entityName(rel.parent_entity_id)}</td>
                    <td>{entityName(rel.child_entity_id)}</td>
                    <td>{rel.relationship_type ?? 'territorial'}</td>
                    <td>{formatDate(rel.start_date)}</td>
                    <td>{rel.is_current ? 'Sí' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'pastoral' && (
        <section className="card dashboard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Estructura pastoral</p>
              <h2>Dependencias pastorales</h2>
            </div>
          </div>
          <form className="admin-form admin-config-form" onSubmit={savePastoral}>
            <select name="parent_pastoral_entity_id" defaultValue="">
              <option value="">Pastoral superior</option>
              {pastoralEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
            </select>
            <select name="child_pastoral_entity_id" defaultValue="">
              <option value="">Pastoral dependiente</option>
              {pastoralEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
            </select>
            <select name="relationship_type" defaultValue="pastoral">
              <option value="pastoral">Pastoral</option>
              <option value="commission">Comisión</option>
              <option value="team">Equipo</option>
              <option value="coordination">Coordinación</option>
            </select>
            <label>Fecha de inicio<input name="start_date" type="date" /></label>
            <textarea name="notes" placeholder="Notas internas o públicas" />
            <button className="button button-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar dependencia pastoral'}</button>
          </form>

          <div className="table-wrap">
            <table className="data-table dashboard-list-table">
              <thead><tr><th>Superior</th><th>Dependiente</th><th>Relación</th><th>Inicio</th><th>Actual</th></tr></thead>
              <tbody>
                {pastoralRelationships.map((rel) => (
                  <tr key={rel.id}>
                    <td>{pastoralName(rel.parent_pastoral_entity_id)}</td>
                    <td>{pastoralName(rel.child_pastoral_entity_id)}</td>
                    <td>{rel.relationship_type ?? 'pastoral'}</td>
                    <td>{formatDate(rel.start_date)}</td>
                    <td>{rel.is_current ? 'Sí' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'administrative' && (
        <section className="card dashboard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Estructura administrativa</p>
              <h2>Unidades, oficinas y departamentos</h2>
            </div>
          </div>
          <form className="admin-form admin-config-form" onSubmit={saveAdministrative}>
            <select name="admin_mode" defaultValue="update">
              <option value="update">Mover unidad existente</option>
              <option value="create">Crear unidad nueva</option>
            </select>
            <select name="organization_chart_id" value={selectedChartId} onChange={(event) => setSelectedChartId(event.target.value)}>
              <option value="">Organigrama</option>
              {charts.map((chart) => <option key={chart.id} value={chart.id}>{chart.name}</option>)}
            </select>
            <select name="unit_id" defaultValue="">
              <option value="">Unidad existente</option>
              {filteredUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
            </select>
            <input name="new_unit_name" placeholder="Nombre de unidad nueva" />
            <select name="parent_unit_id" defaultValue="">
              <option value="">Sin superior / raíz</option>
              {filteredUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
            </select>
            <textarea name="notes" placeholder="Descripción o notas" />
            <button className="button button-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar estructura administrativa'}</button>
          </form>

          <div className="table-wrap">
            <table className="data-table dashboard-list-table">
              <thead><tr><th>Unidad</th><th>Depende de</th><th>Organigrama</th><th>Estado</th></tr></thead>
              <tbody>
                {filteredUnits.map((unit) => (
                  <tr key={unit.id}>
                    <td>{unit.name}</td>
                    <td>{unitName(unit.parent_unit_id)}</td>
                    <td>{charts.find((chart) => chart.id === unit.organization_chart_id)?.name ?? '—'}</td>
                    <td>{unit.status ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  )
}
