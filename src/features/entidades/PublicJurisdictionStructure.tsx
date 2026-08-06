import type { PublicJurisdictionStructureNode } from '@/lib/public/jurisdiction-structure'

type TreeNode = PublicJurisdictionStructureNode & { children: TreeNode[] }

function buildTree(nodes: PublicJurisdictionStructureNode[]) {
  const byId = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const node of nodes) byId.set(node.account_id, { ...node, children: [] })

  for (const node of byId.values()) {
    const parent = node.parent_account_id ? byId.get(node.parent_account_id) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  return roots
}

function StructureBranch({ node, rootDepth }: { node: TreeNode; rootDepth: number }) {
  const label = node.official_name || node.name
  const content = (
    <div className="public-directory-item jurisdiction-structure-node">
      <div>
        <strong>{label}</strong>
        <span>{node.account_type_name}</span>
      </div>
      <small>{node.children.length > 0 ? `${node.children.length} dependencias inmediatas` : 'Sin dependencias jurisdiccionales públicas'}</small>
    </div>
  )

  if (node.children.length === 0) return <li>{content}</li>

  return (
    <li>
      <details open={node.depth === rootDepth}>
        <summary>{content}</summary>
        <ul className="jurisdiction-structure-list">
          {node.children.map((child) => (
            <StructureBranch key={child.account_id} node={child} rootDepth={rootDepth} />
          ))}
        </ul>
      </details>
    </li>
  )
}

export default function PublicJurisdictionStructure({ nodes }: { nodes: PublicJurisdictionStructureNode[] }) {
  if (nodes.length === 0) return null

  const roots = buildTree(nodes)
  const rootDepth = Math.min(...roots.map((root) => root.depth))

  return (
    <section className="container dashboard-page public-jurisdiction-structure" id="organizacion-jurisdiccional" aria-labelledby="organizacion-jurisdiccional-title">
      <div className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Organización eclesiástica</p>
            <h2 id="organizacion-jurisdiccional-title">Relaciones jurisdiccionales vigentes</h2>
            <p>Consulta esta jurisdicción y las cuentas públicas que dependen actualmente de ella.</p>
          </div>
        </div>
        <ul className="jurisdiction-structure-list jurisdiction-structure-roots">
          {roots.map((root) => (
            <StructureBranch key={root.account_id} node={root} rootDepth={rootDepth} />
          ))}
        </ul>
      </div>
    </section>
  )
}
