import type { EcclesiasticalEntity, StructureKind, StructureTemplate } from '../types'

type StructureSummaryProps = {
  diocese: EcclesiasticalEntity | null
  kind: StructureKind | null
  template: StructureTemplate | null
  customLevelCount: number
  nodeCount: number
}

export function StructureSummary({
  diocese,
  kind,
  template,
  customLevelCount,
  nodeCount,
}: StructureSummaryProps) {
  return (
    <div className="structure-catalog-summary">
      <strong>{diocese?.name ?? 'Selecciona una diócesis'}</strong>
      <span>{kind?.name ?? 'Territorial'} · {template?.name ?? 'sin catálogo activo'}</span>
      <small>{customLevelCount} niveles personalizados · {nodeCount} unidades</small>
    </div>
  )
}
