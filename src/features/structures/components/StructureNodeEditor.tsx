'use client'

import type { FormEvent } from 'react'
import type { ChildLevelOption, EcclesiasticalEntity, StructureTreeNode } from '../types'

type StructureNodeEditorProps = {
  allowedLevels: ChildLevelOption[]
  entities: EcclesiasticalEntity[]
  parentNodes: StructureTreeNode[]
  selectedParentNodeId: string
  saving: boolean
  onParentChange: (nodeId: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function StructureNodeEditor({
  allowedLevels,
  entities,
  parentNodes,
  selectedParentNodeId,
  saving,
  onParentChange,
  onSubmit,
}: StructureNodeEditorProps) {
  return (
    <form className="catalog-form" onSubmit={onSubmit}>
      <div className="catalog-form-grid">
        <label>
          Unidad superior
          <select
            name="parent_node_id"
            onChange={(event) => onParentChange(event.target.value)}
            value={selectedParentNodeId}
          >
            <option value="">Raíz del catálogo</option>
            {parentNodes.map((node) => (
              <option key={node.node_id} value={node.node_id}>{node.path_names.join(' / ')}</option>
            ))}
          </select>
        </label>
        <label>
          Tipo de nivel permitido
          <select name="level_id" required>
            <option value="">Seleccionar nivel</option>
            {allowedLevels.map((level) => (
              <option key={level.level_id} value={level.level_id}>{level.level_name}</option>
            ))}
          </select>
        </label>
        <label>
          Nombre
          <input name="name" required />
        </label>
        <label>
          Nombre oficial
          <input name="official_name" />
        </label>
        <label>
          Código
          <input name="code" />
        </label>
        <label>
          Entidad eclesiástica vinculada
          <select name="linked_ecclesiastical_entity_id">
            <option value="">Sin entidad vinculada</option>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>{entity.name}</option>
            ))}
          </select>
        </label>
        <label>
          Inicio de vigencia
          <input name="start_date" type="date" />
        </label>
      </div>
      <label>
        Descripción
        <textarea name="description" />
      </label>
      <button className="button button-primary" disabled={saving || allowedLevels.length === 0} type="submit">
        {saving ? 'Guardando...' : 'Agregar unidad'}
      </button>
      {allowedLevels.length === 0 && (
        <p className="meta">El nivel seleccionado no admite unidades hijas. Selecciona otro padre o configura una relación entre niveles.</p>
      )}
    </form>
  )
}
