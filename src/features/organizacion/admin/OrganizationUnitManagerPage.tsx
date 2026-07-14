'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  loadOrganizationUnitCatalogs,
  saveOrganizationUnit,
  transitionOrganizationUnit,
  type OrganizationUnit,
  type OrganizationUnitCatalogs,
  type OrganizationUnitLifecycleAction,
  type SaveOrganizationUnitPayload,
} from '../services/organization-unit-admin-service'

const emptyCatalogs: OrganizationUnitCatalogs = { entities: [], charts: [], pastoralAreas: [], units: [] }

type UnitFormState = {
  name: string
  key: string
  description: string
  parentUnitId: string
  pastoralAreaId: string
  sortOrder: string
  validFrom: string
  validTo: string
}

type TreeRow = { unit: OrganizationUnit; depth: number }
type LifecycleOption = { action: OrganizationUnitLifecycleAction; label: string; destructive?: boolean }

function emptyForm(): UnitFormState {
  return { name: '', key: '', description: '', parentUnitId: '', pastoralAreaId: '', sortOrder: '0', validFrom: '', validTo: '' }
}

function formFromUnit(unit: OrganizationUnit): UnitFormState {
  return {
    name: unit.name,
    key: unit.key,
    description: unit.description ?? '',
    parentUnitId: unit.parent_unit_id ?? '',
    pastoralAreaId: unit.pastoral_area_id ?? '',
    sortOrder: String(unit.sort_order ?? 0),
    validFrom: unit.valid_from ?? '',
    validTo: unit.valid_to ?? '',
  }
}

function flattenTree(units: OrganizationUnit[]): TreeRow[] {
  const byParent = new Map<string | null, OrganizationUnit[]>()
  const knownIds = new Set(units.map((unit) => unit.id))
  for (const unit of units) {
    const parentId = unit.parent_unit_id && knownIds.has(unit.parent_unit_id) ? unit.parent_unit_id : null
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), unit])
  }
  for (const siblings of byParent.values()) siblings.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'es'))

  const rows: TreeRow[] = []
  const visited = new Set<string>()
  const append = (parentId: string | null, depth: number) => {
    for (const unit of byParent.get(parentId) ?? []) {
      if (visited.has(unit.id)) continue
      visited.add(unit.id)
      rows.push({ unit, depth })
      append(unit.id, depth + 1)
    }
  }
  append(null, 0)
  for (const unit of units) if (!visited.has(unit.id)) rows.push({ unit, depth: 0 })
  return rows
}

function descendantIds(units: OrganizationUnit[], unitId: string | null) {
  const result = new Set<string>()
  if (!unitId) return result
  let changed = true
  while (changed) {
    changed = false
    for (const unit of units) {
      if (unit.parent_unit_id === unitId || (unit.parent_unit_id && result.has(unit.parent_unit_id))) {
        if (!result.has(unit.id)) {
          result.add(unit.id)
          changed = true
        }
      }
    }
  }
  return result
}

function statusLabel(status: OrganizationUnit['status']) {
  return status === 'active' ? 'Activa' : status === 'inactive' ? 'Inactiva' : status === 'archived' ? 'Archivada' : 'Borrador'
}

function visibilityLabel(visibility: OrganizationUnit['visibility']) {
  return visibility === 'public' ? 'Pública' : visibility === 'private' ? 'Privada' : 'Interna'
}

function lifecycleOptions(unit: OrganizationUnit): LifecycleOption[] {
  if (unit.status === 'draft') return [{ action: 'approve', label: 'Aprobar unidad' }, { action: 'archive', label: 'Archivar', destructive: true }]
  if (unit.status === 'active') return [
    unit.visibility === 'public' ? { action: 'unpublish', label: 'Retirar publicación' } : { action: 'publish', label: 'Publicar' },
    { action: 'deactivate', label: 'Desactivar', destructive: true },
    { action: 'archive', label: 'Archivar', destructive: true },
  ]
  if (unit.status === 'inactive') return [{ action: 'restore_draft', label: 'Restaurar como borrador' }, { action: 'archive', label: 'Archivar', destructive: true }]
  return [{ action: 'restore_draft', label: 'Restaurar como borrador' }]
}

export default function OrganizationUnitManagerPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [catalogs, setCatalogs] = useState<OrganizationUnitCatalogs>(emptyCatalogs)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [transitioning, setTransitioning] = useState<OrganizationUnitLifecycleAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [selectedEntityId, setSelectedEntityId] = useState('')
  const [selectedChartId, setSelectedChartId] = useState('')
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [form, setForm] = useState<UnitFormState>(emptyForm)

  const filteredUnits = useMemo(() => catalogs.units.filter((unit) => unit.ecclesiastical_entity_id === selectedEntityId && unit.organization_chart_id === selectedChartId), [catalogs.units, selectedChartId, selectedEntityId])
  const selectedUnit = catalogs.units.find((unit) => unit.id === selectedUnitId) ?? null
  const treeRows = useMemo(() => flattenTree(filteredUnits), [filteredUnits])
  const excludedParentIds = useMemo(() => descendantIds(filteredUnits, selectedUnitId), [filteredUnits, selectedUnitId])
  const parentOptions = filteredUnits.filter((unit) => unit.id !== selectedUnitId && !excludedParentIds.has(unit.id))
  const selectedEntity = catalogs.entities.find((entity) => entity.id === selectedEntityId)
  const selectedChart = catalogs.charts.find((chart) => chart.id === selectedChartId)
  const rootCount = filteredUnits.filter((unit) => !unit.parent_unit_id).length
  const activeCount = filteredUnits.filter((unit) => unit.status === 'active' && unit.is_current).length
  const draftCount = filteredUnits.filter((unit) => unit.status === 'draft' && unit.is_current).length

  async function refresh(preferredUnitId?: string | null) {
    const next = await loadOrganizationUnitCatalogs(supabase)
    setCatalogs(next)
    const entityId = selectedEntityId || next.entities.find((entity) => entity.slug === 'arquidiocesis-metropolitana-de-santo-domingo')?.id || next.entities[0]?.id || ''
    const chartId = selectedChartId || next.charts.find((chart) => chart.key === 'diocesan_pastoral')?.id || next.charts[0]?.id || ''
    setSelectedEntityId(entityId)
    setSelectedChartId(chartId)
    const selected = next.units.find((unit) => unit.id === (preferredUnitId ?? selectedUnitId))
    setSelectedUnitId(selected?.id ?? null)
    setForm(selected ? formFromUnit(selected) : emptyForm())
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase.auth.getUser()
      if (!data.user) return router.replace('/admin/login')
      try {
        const next = await loadOrganizationUnitCatalogs(supabase)
        if (cancelled) return
        setCatalogs(next)
        setSelectedEntityId(next.entities.find((entity) => entity.slug === 'arquidiocesis-metropolitana-de-santo-domingo')?.id ?? next.entities[0]?.id ?? '')
        setSelectedChartId(next.charts.find((chart) => chart.key === 'diocesan_pastoral')?.id ?? next.charts[0]?.id ?? '')
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la organización.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [router, supabase])

  function beginNewUnit(parentUnitId = '') {
    setSelectedUnitId(null)
    setForm({ ...emptyForm(), parentUnitId })
    setError(null)
    setMessage(null)
    window.location.hash = 'organization-unit-form'
  }

  function selectUnit(unit: OrganizationUnit) {
    setSelectedUnitId(unit.id)
    setForm(formFromUnit(unit))
    setError(null)
    setMessage(null)
    window.location.hash = 'organization-unit-form'
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedEntityId || !selectedChartId) return setError('Selecciona la diócesis y el organigrama.')
    if (!form.name.trim()) return setError('El nombre de la unidad es obligatorio.')

    const payload: SaveOrganizationUnitPayload = {
      ...(selectedUnitId ? { id: selectedUnitId } : {}),
      organization_chart_id: selectedChartId,
      ecclesiastical_entity_id: selectedEntityId,
      parent_unit_id: form.parentUnitId || null,
      pastoral_area_id: form.pastoralAreaId || null,
      key: form.key.trim() || null,
      name: form.name.trim(),
      description: form.description.trim() || null,
      sort_order: Number.parseInt(form.sortOrder, 10) || 0,
      valid_from: form.validFrom || null,
      valid_to: form.validTo || null,
    }

    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const saved = await saveOrganizationUnit(payload)
      await refresh(saved.id)
      setMessage(selectedUnitId ? 'Contenido de la unidad actualizado.' : 'Unidad creada como borrador interno.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la unidad organizativa.')
    } finally {
      setSaving(false)
    }
  }

  async function handleLifecycle(action: OrganizationUnitLifecycleAction, destructive = false) {
    if (!selectedUnit) return
    if (destructive && !window.confirm('Esta acción modifica el ciclo de vida de la unidad. ¿Deseas continuar?')) return
    setTransitioning(action)
    setError(null)
    setMessage(null)
    try {
      const updated = await transitionOrganizationUnit(selectedUnit.id, action)
      await refresh(updated.id)
      setMessage('Ciclo de vida actualizado y registrado en auditoría.')
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : 'No se pudo cambiar el ciclo de vida.')
    } finally {
      setTransitioning(null)
    }
  }

  if (loading) return <div className="empty-state">Cargando organización eclesial...</div>

  return <main className="admin-organization-page" id="top">
    <header className="admin-top-header">
      <div className="admin-top-title"><span className="admin-mini-mark">ORG</span><strong>Organización funcional</strong></div>
      <div className="admin-top-actions"><Link className="button button-secondary" href="/admin">Volver al panel</Link><Link className="button button-secondary" href="/admin/asignaciones">Nombramientos</Link></div>
    </header>

    <section className="admin-welcome-panel"><div><p className="eyebrow">Organigramas</p><h1>Unidades, jerarquías y ámbitos</h1><p className="lead">Gestiona pastorales, curia, gobierno y otras unidades funcionales sin mezclarlas con la estructura territorial.</p><div className="role-list admin-role-list"><span className="role-pill">Edición separada</span><span className="role-pill">Aprobación explícita</span><span className="role-pill">Publicación auditada</span></div></div><div className="admin-welcome-illustration" aria-hidden="true">▦</div></section>

    <section className="admin-stat-strip" aria-label="Resumen organizativo"><a href="#organization-tree"><span>▥</span><strong>{filteredUnits.length}</strong><small>Unidades</small></a><a href="#organization-tree"><span>⌂</span><strong>{rootCount}</strong><small>Raíces</small></a><a href="#organization-tree"><span>✓</span><strong>{activeCount}</strong><small>Activas</small></a><a href="#organization-tree"><span>◌</span><strong>{draftCount}</strong><small>Borradores</small></a></section>
    {error && <div className="error-box">{error}</div>}{message && <div className="success-box">{message}</div>}

    <section className="card dashboard-section"><div className="section-heading"><div><p className="eyebrow">Ámbito de trabajo</p><h2>Diócesis y organigrama</h2></div><span className="meta">{selectedEntity?.name ?? 'Sin diócesis'} · {selectedChart?.name ?? 'Sin organigrama'}</span></div><div className="admin-form admin-config-form"><label>Diócesis<select value={selectedEntityId} onChange={(event) => { setSelectedEntityId(event.target.value); beginNewUnit() }}><option value="">Seleccionar diócesis</option>{catalogs.entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label><label>Organigrama<select value={selectedChartId} onChange={(event) => { setSelectedChartId(event.target.value); beginNewUnit() }}><option value="">Seleccionar organigrama</option>{catalogs.charts.map((chart) => <option key={chart.id} value={chart.id}>{chart.name}</option>)}</select></label><p className="meta">{selectedChart?.description ?? 'Cada organigrama mantiene su propia jerarquía y sus cargos compatibles.'}</p></div></section>

    <section className="card dashboard-section" id="organization-tree"><div className="section-heading"><div><p className="eyebrow">Jerarquía</p><h2>Árbol de unidades</h2></div><button className="button button-primary" onClick={() => beginNewUnit()} type="button">+ Nueva unidad</button></div>{treeRows.length === 0 ? <div className="empty-state"><strong>Este organigrama todavía no tiene unidades.</strong><span>Crea la primera unidad raíz.</span></div> : <div className="table-wrap"><table className="data-table dashboard-list-table"><thead><tr><th>Unidad</th><th>Área pastoral</th><th>Estado</th><th>Visibilidad</th><th>Orden</th><th>Acciones</th></tr></thead><tbody>{treeRows.map(({ unit, depth }) => { const area = catalogs.pastoralAreas.find((item) => item.id === unit.pastoral_area_id); return <tr key={unit.id}><td style={{ paddingLeft: `${0.75 + depth * 1.5}rem` }}><strong>{depth > 0 ? '↳ ' : ''}{unit.name}</strong><small className="meta">{unit.key}</small></td><td>{area?.name ?? 'Unidad cabecera'}</td><td>{statusLabel(unit.status)}{unit.is_current ? '' : ' · histórica'}</td><td>{visibilityLabel(unit.visibility)}</td><td>{unit.sort_order}</td><td><button className="button button-secondary" onClick={() => selectUnit(unit)} type="button">Editar y revisar</button>{' '}<button className="button button-secondary" onClick={() => beginNewUnit(unit.id)} type="button">Agregar debajo</button></td></tr> })}</tbody></table></div>}</section>

    <section className="card dashboard-section" id="organization-unit-form"><div className="section-heading"><div><p className="eyebrow">{selectedUnitId ? 'Editar contenido' : 'Nueva unidad'}</p><h2>{selectedUnitId ? form.name : 'Datos organizativos'}</h2></div>{selectedUnitId && <button className="button button-secondary" onClick={() => beginNewUnit()} type="button">Cancelar edición</button>}</div>
      {selectedUnit && <div className="admin-form admin-config-form" aria-label="Ciclo de vida de la unidad"><div><strong>Estado actual</strong><p className="meta">{statusLabel(selectedUnit.status)} · {visibilityLabel(selectedUnit.visibility)} · {selectedUnit.is_current ? 'Vigente' : 'Histórica'}</p></div><div className="admin-top-actions">{lifecycleOptions(selectedUnit).map((option) => <button className={option.destructive ? 'button button-secondary' : 'button button-primary'} disabled={transitioning !== null || saving} key={option.action} onClick={() => void handleLifecycle(option.action, option.destructive)} type="button">{transitioning === option.action ? 'Procesando…' : option.label}</button>)}</div><p className="meta">Estado, visibilidad y vigencia cambian solo mediante acciones explícitas y auditadas.</p></div>}
      <form className="admin-form admin-config-form" onSubmit={handleSubmit}><label>Nombre<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></label><label>Clave técnica opcional<input value={form.key} onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))} placeholder="Se genera automáticamente" /></label><label>Unidad superior<select value={form.parentUnitId} onChange={(event) => setForm((current) => ({ ...current, parentUnitId: event.target.value }))}><option value="">Unidad raíz</option>{flattenTree(parentOptions).map(({ unit, depth }) => <option key={unit.id} value={unit.id}>{'— '.repeat(depth)}{unit.name}</option>)}</select></label><label>Área pastoral<select value={form.pastoralAreaId} onChange={(event) => setForm((current) => ({ ...current, pastoralAreaId: event.target.value }))}><option value="">Sin área pastoral / unidad cabecera</option>{catalogs.pastoralAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label><label>Orden<input min="0" type="number" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} /></label><label>Vigente desde<input type="date" value={form.validFrom} onChange={(event) => setForm((current) => ({ ...current, validFrom: event.target.value }))} /></label><label>Vigente hasta<input type="date" value={form.validTo} onChange={(event) => setForm((current) => ({ ...current, validTo: event.target.value }))} /></label><label>Descripción<textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label><p className="meta">El guardado modifica contenido y jerarquía. No aprueba, publica ni cambia la vigencia de la unidad.</p><button className="button button-primary" disabled={saving || transitioning !== null || !selectedEntityId || !selectedChartId}>{saving ? 'Guardando…' : selectedUnitId ? 'Guardar contenido' : 'Crear borrador'}</button></form>
    </section>
  </main>
}
