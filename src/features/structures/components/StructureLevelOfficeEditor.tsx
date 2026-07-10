'use client'

import { useEffect, useState } from 'react'
import type { StructureLevel } from '../types'
import type { StructureOfficeOption } from '../services/structure-office-service'

type Props = {
  level: StructureLevel | null
  configured: StructureOfficeOption[]
  available: StructureOfficeOption[]
  saving: boolean
  onClose: () => void
  onSave: (officeIds: string[], defaultOfficeId: string | null) => void
}

export function StructureLevelOfficeEditor({ level, configured, available, saving, onClose, onSave }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const [defaultId, setDefaultId] = useState<string | null>(null)

  useEffect(() => {
    setSelected(configured.map((item) => item.id))
    setDefaultId(configured.find((item) => item.is_default)?.id ?? null)
  }, [configured])

  if (!level) return null

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
    if (defaultId === id && selected.includes(id)) setDefaultId(null)
  }

  return (
    <div className="catalog-column">
      <div className="section-heading">
        <div><p className="eyebrow">Cargos permitidos</p><h2>{level.name}</h2><p className="meta">Selecciona los cargos disponibles y marca uno como predeterminado.</p></div>
        <button className="button button-secondary" type="button" onClick={onClose}>Cerrar</button>
      </div>
      {available.map((office) => {
        const checked = selected.includes(office.id)
        return (
          <article className="catalog-level" key={office.id}>
            <label className="catalog-level-header">
              <span><input checked={checked} onChange={() => toggle(office.id)} type="checkbox" /> <strong>{office.display_name}</strong></span>
              <span><input checked={defaultId === office.id} disabled={!checked} name="default-office" onChange={() => setDefaultId(office.id)} type="radio" /> Predeterminado</span>
            </label>
            <small>{office.description ?? office.key}{office.requires_clergy ? ' · Requiere clérigo' : ''}</small>
          </article>
        )
      })}
      <div className="admin-card-actions">
        <button className="button button-primary" disabled={saving} type="button" onClick={() => onSave(selected, defaultId)}>Guardar cargos</button>
      </div>
    </div>
  )
}
