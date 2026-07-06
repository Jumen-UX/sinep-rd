'use client'

import { useEffect, useMemo, useState } from 'react'

export type EntityHierarchyEntity = {
  direct_entity_id: string
  direct_entity_name: string
  direct_entity_slug: string | null
  direct_entity_type_key: string | null
  direct_entity_type_name: string | null
  jurisdiction_id: string | null
  jurisdiction_name: string | null
  jurisdiction_slug: string | null
  vicariate_id: string | null
  vicariate_name: string | null
  vicariate_slug: string | null
  zone_id: string | null
  zone_name: string | null
  zone_slug: string | null
  parish_id: string | null
  parish_name: string | null
  parish_slug: string | null
  hierarchy_path: string | null
}

type Option = {
  id: string
  name: string
}

type Props = {
  entities: EntityHierarchyEntity[]
  value: string
  name: string
  label: string
  help?: string
  allowCreateParish?: boolean
  onChange: (value: string) => void
  onCreated?: () => Promise<void> | void
}

function uniqueOptions(rows: EntityHierarchyEntity[], idKey: keyof EntityHierarchyEntity, nameKey: keyof EntityHierarchyEntity): Option[] {
  const map = new Map<string, string>()
  rows.forEach((row) => {
    const id = row[idKey]
    const name = row[nameKey]
    if (typeof id === 'string' && typeof name === 'string' && !map.has(id)) {
      map.set(id, name)
    }
  })
  return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function EntityHierarchyPicker({ entities, value, name, label, help, allowCreateParish = false, onChange, onCreated }: Props) {
  const [jurisdictionId, setJurisdictionId] = useState('')
  const [vicariateId, setVicariateId] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newParishName, setNewParishName] = useState('')
  const [savingParish, setSavingParish] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const selected = entities.find((entity) => entity.direct_entity_id === value)

  useEffect(() => {
    if (!selected) return
    setJurisdictionId(selected.jurisdiction_id ?? '')
    setVicariateId(selected.vicariate_id ?? '')
    setZoneId(selected.zone_id ?? '')
  }, [selected?.direct_entity_id])

  const jurisdictionOptions = useMemo(() => uniqueOptions(entities, 'jurisdiction_id', 'jurisdiction_name'), [entities])

  const rowsForJurisdiction = useMemo(() => (
    jurisdictionId ? entities.filter((entity) => entity.jurisdiction_id === jurisdictionId || entity.direct_entity_id === jurisdictionId) : entities
  ), [entities, jurisdictionId])

  const vicariateOptions = useMemo(() => uniqueOptions(rowsForJurisdiction, 'vicariate_id', 'vicariate_name'), [rowsForJurisdiction])

  const rowsForVicariate = useMemo(() => (
    vicariateId ? rowsForJurisdiction.filter((entity) => entity.vicariate_id === vicariateId || entity.direct_entity_id === vicariateId) : rowsForJurisdiction
  ), [rowsForJurisdiction, vicariateId])

  const zoneOptions = useMemo(() => uniqueOptions(rowsForVicariate, 'zone_id', 'zone_name'), [rowsForVicariate])

  const rowsForZone = useMemo(() => (
    zoneId ? rowsForVicariate.filter((entity) => entity.zone_id === zoneId || entity.direct_entity_id === zoneId) : rowsForVicariate
  ), [rowsForVicariate, zoneId])

  const parishOptions = useMemo(() => {
    const text = search.trim().toLowerCase()
    return rowsForZone
      .filter((entity) => entity.direct_entity_type_key === 'parish' || entity.direct_entity_type_key === 'quasi_parish')
      .filter((entity) => !text || entity.direct_entity_name.toLowerCase().includes(text))
      .sort((a, b) => a.direct_entity_name.localeCompare(b.direct_entity_name, 'es'))
  }, [rowsForZone, search])

  const parentIdForNewParish = zoneId || vicariateId || jurisdictionId
  const parentNameForNewParish =
    zoneOptions.find((item) => item.id === zoneId)?.name ||
    vicariateOptions.find((item) => item.id === vicariateId)?.name ||
    jurisdictionOptions.find((item) => item.id === jurisdictionId)?.name ||
    ''

  async function createParish() {
    setLocalError(null)
    const parishName = newParishName.trim()
    if (!parishName) {
      setLocalError('Escribe el nombre de la parroquia.')
      return
    }
    if (!parentIdForNewParish) {
      setLocalError('Selecciona primero la diócesis, vicaría o zona donde pertenece la parroquia.')
      return
    }

    setSavingParish(true)
    try {
      const response = await fetch('/api/admin/entidad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type_key: 'parish',
          name: parishName,
          slug: slugify(`${parishName}-${parentNameForNewParish || 'parroquia'}`),
          country: 'República Dominicana',
          parent_entity_id: parentIdForNewParish,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudo crear la parroquia.')
      await onCreated?.()
      onChange(data.entity_id)
      setNewParishName('')
      setShowCreate(false)
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'No se pudo crear la parroquia.')
    } finally {
      setSavingParish(false)
    }
  }

  return (
    <div className="card compact-section">
      <h3>{label}</h3>
      {help && <p className="meta">{help}</p>}
      <input name={name} type="hidden" value={value} />

      <label>
        Jurisdicción
        <select value={jurisdictionId} onChange={(event) => { setJurisdictionId(event.target.value); setVicariateId(''); setZoneId(''); onChange('') }}>
          <option value="">Todas las jurisdicciones</option>
          {jurisdictionOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </label>

      {vicariateOptions.length > 0 && (
        <label>
          Vicaría
          <select value={vicariateId} onChange={(event) => { setVicariateId(event.target.value); setZoneId(''); onChange('') }}>
            <option value="">Todas las vicarías</option>
            {vicariateOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </label>
      )}

      {zoneOptions.length > 0 && (
        <label>
          Zona pastoral
          <select value={zoneId} onChange={(event) => { setZoneId(event.target.value); onChange('') }}>
            <option value="">Todas las zonas</option>
            {zoneOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </label>
      )}

      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar parroquia por nombre" />

      <label>
        Parroquia
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Sin parroquia seleccionada</option>
          {parishOptions.map((entity) => (
            <option key={entity.direct_entity_id} value={entity.direct_entity_id}>
              {entity.direct_entity_name}{entity.hierarchy_path ? ` · ${entity.hierarchy_path}` : ''}
            </option>
          ))}
        </select>
      </label>

      <div className="empty-state">
        <strong>{selected?.direct_entity_name ?? 'Sin parroquia seleccionada'}</strong>
        <span>{selected?.hierarchy_path ?? 'Usa los filtros para reducir parroquias con nombres parecidos.'}</span>
      </div>

      {allowCreateParish && (
        <div>
          <button className="button button-secondary" type="button" onClick={() => setShowCreate((current) => !current)}>
            {showCreate ? 'Cancelar nueva parroquia' : 'No aparece, agregar parroquia aquí'}
          </button>
          {showCreate && (
            <div className="compact-section">
              <p className="meta">Se creará dentro de: {parentNameForNewParish || 'selecciona primero la dependencia'}</p>
              <input value={newParishName} onChange={(event) => setNewParishName(event.target.value)} placeholder="Nombre de la nueva parroquia" />
              {localError && <div className="error-box">{localError}</div>}
              <button className="button button-primary" disabled={savingParish} type="button" onClick={createParish}>
                {savingParish ? 'Creando...' : 'Crear y seleccionar parroquia'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
