import type { PublicJurisdictionStructureNode } from '@/lib/public/jurisdiction-structure'

type TreeNode = PublicJurisdictionStructureNode & { children: TreeNode[] }

function buildTree(nodes: PublicJurisdictionStructureNode[]) {
  const byId = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const node of nodes) byId.set(node.node_id, { ...node, children: [] })

  for (const node of byId.values()) {
    const parent = node.parent_node_id ? byId.get(node.parent_node_id) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  return roots
}

function StructureBranch({ node }: { node: TreeNode }) {
  const label = node.official_name || node.name
  const content = (
    <div className="public-directory-item jurisdiction-structure-node">
      <div>
        <strong>{label}</strong>
        <span>{node.level_name}</span>
      </div>
      <small>{node.children.length > 0 ? `${node.children.length} dependencias inmediatas` : 'Sin dependencias públicas'}</small>
    </div>
  )

  if (node.children.length === 0) return <li>{content}</li>

  return (
    <li>
      <details open={node.depth === 0}>
        <summary>{content}</summary>
        <ul className="jurisdiction-structure-list">
          {node.children.map((child) => <StructureBranch key={child.node_id} node={child} />)}
        </ul>
      </details>
    </li>
  )
}

export default function PublicJurisdictionStructure({ nodes }: { nodes: PublicJurisdictionStructureNode[] }) {
  if (nodes.length === 0) return null

  const roots = buildTree(nodes)

  return (
    <section className="container dashboard-page public-jurisdiction-structure" id="estructura-territorial" aria-labelledby="estructura-territorial-title">
      <div className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Organización territorial</p>
            <h2 id="estructura-territorial-title">Estructura jurisdiccional</h2>
            <p>Explore las dependencias territoriales públicas y vigentes de esta jurisdicción.</p>
          </div>
        </div>
        <ul className="jurisdiction-structure-list jurisdiction-structure-roots">
          {roots.map((root) => <StructureBranch key={root.node_id} node={root} />)}
        </ul>
      </div>
    </section>
  )
}
