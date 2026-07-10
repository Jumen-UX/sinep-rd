'use client'

import type { FormEvent } from 'react'
import type { EntityType, StructureLevel } from '../types'

type StructureLevelEditorProps = {
  editingLevel: StructureLevel | null
  entityTypes: EntityType[]
  parentLevels: StructureLevel[]
  saving: boolean
  onCancel: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function StructureLevelEditor({
  editingLevel,
  entityTypes,
  parentLevels,
  saving,
  onCancel,
  onSubmit,
}: StructureLevelEditorProps) {
  return (
    <form className="catalog-form" onSubmit={onSubmit}>
      <input name="id" type="hidden" value={editingLevel?.id ?? ''} />
      <div className="catalog-form-grid">
        <label>
          Nombre del nivel
          <input defaultValue={editingLevel?.name ?? ''} name="name" required />
        </label>
        <label>
          Nombre plural
          <input defaultValue={editingLevel?.plural_name ?? ''} name="plural_name" />
        </label>
        <label>
          Clave interna
          <input defaultValue={editingLevel?.level_key ?? ''} name="level_key" placeholder="zona-pastoral" />
        </label>
        <label>
          Nivel padre
          <select defaultValue={editingLevel?.parent_level_id ?? ''} name="parent_level_id" required>
            <option value="">Seleccionar nivel padre</option>
            {parentLevels.map((level) => (
              <option key={level.id} value={level.id}>{level.name}</option>
            ))}
          </select>
        </label>
        <label>
          Orden visible
          <input defaultValue={editingLevel ? editingLevel.level_order + 1 : 3} min={3} name="display_order" required type="number" />
        </label>
        <label>
          Tipo de entidad vinculado
          <select defaultValue={editingLevel?.linked_entity_type_id ?? ''} name="linked_entity_type_id">
            <option value="">Sin tipo obligatorio</option>
            {entityTypes.map((entityType) => (
              <option key={entityType.id} value={entityType.id}>{entityType.name}</option>
            ))}
          </select>
        </label>
        <label>
          Ámbito
          <select defaultValue={editingLevel?.scope ?? 'ecclesial'} name="scope">
            <option value="ecclesial">Eclesial</option>
            <option value="pastoral">Pastoral</option>
            <option value="administrative">Administrativo</option>
            <option value="organic">Orgánico</option>
          </select>
        </label>
      </div>
      <label>
        Descripción
        <textarea defaultValue={editingLevel?.description ?? ''} name="description" />
      </label>
      <div className="catalog-level-actions">
        <label><input defaultChecked={editingLevel?.is_entry_point ?? false} name="is_entry_point" type="checkbox" /> Punto de entrada</label>
        <label><input defaultChecked={editingLevel?.is_required ?? true} name="is_required" type="checkbox" /> Nivel requerido</label>
      </div>
      <div className="admin-card-actions">
        <button className="button button-primary" disabled={saving} type="submit">
          {saving ? 'Guardando...' : editingLevel ? 'Actualizar nivel' : 'Agregar nivel'}
        </button>
        {editingLevel && (
          <button className="button button-secondary" disabled={saving} onClick={onCancel} type="button">Cancelar edición</button>
        )}
      </div>
    </form>
  )
}
