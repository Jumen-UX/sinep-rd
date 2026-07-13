import Link from 'next/link'
import styles from './EntityRelationshipMap.module.css'

export type EntityRelationship = {
  id: string
  parent_entity_id: string
  child_entity_id: string
  relationship_type: string | null
  start_date: string | null
  is_current: boolean
}

export type EntityRelationshipNode = {
  id: string
  name: string
  slug: string
}

type Props = {
  entity: EntityRelationshipNode
  relationships: EntityRelationship[]
  relatedEntities: EntityRelationshipNode[]
}

const relationshipLabels: Record<string, string> = {
  parent: 'Dependencia superior',
  child: 'Estructuras subordinadas',
  member_of: 'Miembro de',
  depends_on: 'Depende de',
  contains: 'Contiene',
  territorial: 'Relación territorial',
  pastoral: 'Relación pastoral',
  administrative: 'Relación administrativa',
}

function labelRelationship(value: string | null, direction: 'parent' | 'child') {
  if (!value) return direction === 'parent' ? 'Dependencia superior' : 'Estructura subordinada'
  return relationshipLabels[value] ?? value.replaceAll('_', ' ')
}

export function buildEntityRelationshipMap(
  entity: EntityRelationshipNode,
  relationships: EntityRelationship[],
  relatedEntities: EntityRelationshipNode[],
) {
  const entityById = new Map(relatedEntities.map((item) => [item.id, item]))
  const active = relationships.filter((relationship) => relationship.is_current)

  const parents = active
    .filter((relationship) => relationship.child_entity_id === entity.id)
    .map((relationship) => ({
      relationship,
      entity: entityById.get(relationship.parent_entity_id),
    }))
    .filter((item): item is { relationship: EntityRelationship; entity: EntityRelationshipNode } => Boolean(item.entity))

  const children = active
    .filter((relationship) => relationship.parent_entity_id === entity.id)
    .map((relationship) => ({
      relationship,
      entity: entityById.get(relationship.child_entity_id),
    }))
    .filter((item): item is { relationship: EntityRelationship; entity: EntityRelationshipNode } => Boolean(item.entity))

  return {
    parents: parents.sort((left, right) => left.entity.name.localeCompare(right.entity.name, 'es')),
    children: children.sort((left, right) => left.entity.name.localeCompare(right.entity.name, 'es')),
  }
}

function RelationshipCard({
  item,
  direction,
}: {
  item: { relationship: EntityRelationship; entity: EntityRelationshipNode }
  direction: 'parent' | 'child'
}) {
  return (
    <article className={styles.node}>
      <span className={styles.type}>{labelRelationship(item.relationship.relationship_type, direction)}</span>
      <strong>{item.entity.name}</strong>
      {item.relationship.start_date && <small>Desde {item.relationship.start_date}</small>}
      <Link href={`/entidades/${item.entity.slug}`}>Ver ficha</Link>
    </article>
  )
}

export default function EntityRelationshipMap({ entity, relationships, relatedEntities }: Props) {
  const map = buildEntityRelationshipMap(entity, relationships, relatedEntities)

  if (map.parents.length === 0 && map.children.length === 0) return null

  return (
    <section className="card dashboard-section" aria-labelledby="entity-relationship-map-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Estructura territorial e institucional</p>
          <h2 id="entity-relationship-map-title">Mapa jerárquico</h2>
          <p className="meta">Las conexiones se generan desde las relaciones activas registradas para esta entidad.</p>
        </div>
      </div>

      <div className={styles.map}>
        {map.parents.length > 0 && (
          <div className={styles.level}>
            <span className={styles.levelLabel}>Nivel superior</span>
            <div className={styles.grid}>
              {map.parents.map((item) => (
                <RelationshipCard direction="parent" item={item} key={item.relationship.id} />
              ))}
            </div>
          </div>
        )}

        <div className={styles.current}>
          <span>Entidad actual</span>
          <strong>{entity.name}</strong>
        </div>

        {map.children.length > 0 && (
          <div className={styles.level}>
            <span className={styles.levelLabel}>Nivel subordinado</span>
            <div className={styles.grid}>
              {map.children.map((item) => (
                <RelationshipCard direction="child" item={item} key={item.relationship.id} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
