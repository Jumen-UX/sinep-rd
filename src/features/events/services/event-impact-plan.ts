import type {
  ApplicationPlan,
  ConflictPreview,
  PlanAction,
  RelationshipConflict,
} from './event-application-admin-service'

export type ImpactIssue = {
  severity: 'error' | 'warning'
  code: string
  message: string
  actionId: string | null
}

export type ImpactNode = {
  id: string
  order: number
  type: string
  title: string
  description: string | null
  target: string
  beforeState: Record<string, unknown> | null
  afterState: Record<string, unknown> | null
  dependsOn: string[]
  changesState: boolean
  requiresManualReview: boolean
  blocking: boolean
  compensable: boolean
}

export type DeterministicImpactPlan = {
  eventId: string
  eventTitle: string
  generatedFrom: 'canonical_event_actions'
  readOnly: true
  nodes: ImpactNode[]
  issues: ImpactIssue[]
  warnings: ImpactIssue[]
  conflicts: ImpactIssue[]
  derivedUpdates: string[]
  hasCycle: boolean
  canApprove: boolean
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))].sort()
}

function targetLabel(action: PlanAction) {
  return action.target_organization_unit_name
    ?? action.subject_organization_unit_name
    ?? action.target_entity_name
    ?? action.subject_entity_name
    ?? 'Destino pendiente'
}

function stateFromPayload(payload: Record<string, unknown>, key: string) {
  const value = payload[key]
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function conflictMap(preview: ConflictPreview) {
  return new Map(preview.actions.map((action) => [action.action_id, action.conflicts]))
}

function detectCycle(nodes: ImpactNode[]) {
  const dependencies = new Map(nodes.map((node) => [node.id, node.dependsOn]))
  const visiting = new Set<string>()
  const visited = new Set<string>()

  function visit(id: string): boolean {
    if (visiting.has(id)) return true
    if (visited.has(id)) return false
    visiting.add(id)
    for (const dependency of dependencies.get(id) ?? []) {
      if (dependencies.has(dependency) && visit(dependency)) return true
    }
    visiting.delete(id)
    visited.add(id)
    return false
  }

  return nodes.some((node) => visit(node.id))
}

function issueFromConflict(actionId: string, conflict: RelationshipConflict): ImpactIssue {
  return {
    severity: conflict.severity,
    code: conflict.code,
    message: conflict.message,
    actionId,
  }
}

export function buildDeterministicImpactPlan(
  plan: ApplicationPlan,
  preview: ConflictPreview,
): DeterministicImpactPlan {
  const orderedActions = [...plan.actions].sort((left, right) => (
    left.sort_order - right.sort_order || left.id.localeCompare(right.id)
  ))
  const knownIds = new Set(orderedActions.map((action) => action.id))
  const conflictsByAction = conflictMap(preview)
  const issues: ImpactIssue[] = []

  const nodes = orderedActions.map((action, index): ImpactNode => {
    const dependsOn = stringArray(action.payload.depends_on_action_ids)
    for (const dependencyId of dependsOn) {
      if (!knownIds.has(dependencyId)) {
        issues.push({
          severity: 'error',
          code: 'missing_action_dependency',
          message: `La acción depende de una acción inexistente: ${dependencyId}.`,
          actionId: action.id,
        })
      }
    }

    const actionConflicts = conflictsByAction.get(action.id) ?? []
    issues.push(...actionConflicts.map((conflict) => issueFromConflict(action.id, conflict)))

    return {
      id: action.id,
      order: index + 1,
      type: action.action_type_key,
      title: action.action_type_name,
      description: action.description,
      target: targetLabel(action),
      beforeState: stateFromPayload(action.payload, 'before_state'),
      afterState: stateFromPayload(action.payload, 'after_state'),
      dependsOn,
      changesState: action.changes_state,
      requiresManualReview: action.requires_manual_review,
      blocking: action.status === 'failed'
        || action.requires_manual_review
        || actionConflicts.some((conflict) => conflict.severity === 'error'),
      compensable: action.payload.compensable !== false,
    }
  })

  if (!plan.event.effective_date) {
    issues.push({ severity: 'error', code: 'missing_effective_date', message: 'El evento no tiene fecha efectiva.', actionId: null })
  }
  if (plan.event.verification_status !== 'verified') {
    issues.push({ severity: 'warning', code: 'event_not_verified', message: 'La fuente todavía no está verificada formalmente.', actionId: null })
  }
  if (plan.event.evidence_status === 'fuente_secundaria') {
    issues.push({ severity: 'warning', code: 'secondary_source', message: 'El evento se apoya en una fuente secundaria.', actionId: null })
  }

  const hasCycle = detectCycle(nodes)
  if (hasCycle) {
    issues.push({ severity: 'error', code: 'cyclic_action_dependencies', message: 'El plan contiene un ciclo de dependencias.', actionId: null })
  }

  const conflicts = issues.filter((issue) => issue.severity === 'error')
  const warnings = issues.filter((issue) => issue.severity === 'warning')
  const derivedUpdates = [...new Set([
    'Línea temporal institucional',
    ...(nodes.some((node) => node.type.includes('relationship')) ? ['Relaciones institucionales'] : []),
    ...(nodes.some((node) => node.target !== 'Destino pendiente') ? ['Fichas de entidades o unidades afectadas'] : []),
    ...(nodes.some((node) => node.changesState) ? ['Indicadores y estadísticas derivadas'] : []),
    'Índices y cachés públicos relacionados',
  ])]

  return {
    eventId: plan.event.id,
    eventTitle: plan.event.title,
    generatedFrom: 'canonical_event_actions',
    readOnly: true,
    nodes,
    issues,
    warnings,
    conflicts,
    derivedUpdates,
    hasCycle,
    canApprove: nodes.length > 0
      && conflicts.length === 0
      && nodes.every((node) => !node.blocking),
  }
}
