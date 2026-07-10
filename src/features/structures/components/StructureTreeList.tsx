import type { StructureTreeNode } from '../types'

type StructureTreeListProps = {
  nodes: StructureTreeNode[]
  selectedNodeId?: string | null
  emptyMessage?: string
  onSelect: (node: StructureTreeNode) => void
}

function nodePath(node: StructureTreeNode) {
  return node.path_names.length > 0 ? node.path_names.join(' / ') : node.name
}

export function StructureTreeList({
  nodes,
  selectedNodeId = null,
  emptyMessage = 'Este catálogo todavía no tiene unidades.',
  onSelect,
}: StructureTreeListProps) {
  if (nodes.length === 0) return <div className="empty-state">{emptyMessage}</div>

  return (
    <div className="catalog-column" role="tree" aria-label="Árbol de unidades estructurales">
      {nodes.map((node) => {
        const selected = node.node_id === selectedNodeId
        return (
          <button
            aria-current={selected ? 'true' : undefined}
            className={`catalog-node ${selected ? 'active-filter' : ''}`}
            key={node.node_id}
            onClick={() => onSelect(node)}
            role="treeitem"
            style={{ marginLeft: `${Math.max(0, node.depth) * 14}px`, textAlign: 'left' }}
            type="button"
          >
            <div className="catalog-node-header">
              <strong>{node.name}</strong>
              <span className="catalog-badge">{node.level_name}</span>
            </div>
            <small>{nodePath(node)}</small>
          </button>
        )
      })}
    </div>
  )
}
