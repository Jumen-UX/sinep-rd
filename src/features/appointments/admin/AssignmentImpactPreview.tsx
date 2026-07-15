import type {
  AssignmentOfficeConfiguration,
  AssignmentPerson,
  RawAssignment,
} from '../services/assignment-admin-service'

type AssignmentImpactPreviewProps = {
  config: AssignmentOfficeConfiguration | undefined
  person: AssignmentPerson | undefined
  currentAssignments: RawAssignment[]
  startDate: string
  assignmentStatus: string
  predecessorAssignmentId: string
  closePreviousCurrent: boolean
  people: AssignmentPerson[]
}

function dateLabel(value: string | null) {
  if (!value) return 'sin fecha definida'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

export function AssignmentImpactPreview({
  config,
  person,
  currentAssignments,
  startDate,
  assignmentStatus,
  predecessorAssignmentId,
  closePreviousCurrent,
  people,
}: AssignmentImpactPreviewProps) {
  if (!config) {
    return (
      <section className="empty-state" aria-live="polite">
        <strong>Vista previa del impacto</strong>
        <span>Selecciona un cargo y su ámbito para calcular la sucesión.</span>
      </section>
    )
  }

  const predecessor = currentAssignments.find((assignment) => assignment.id === predecessorAssignmentId)
  const assignmentsToClose = config.holder_cardinality === 'single'
    ? currentAssignments
    : closePreviousCurrent
      ? currentAssignments.filter((assignment) => assignment.person_id === person?.id)
      : []
  const assignmentsToKeep = currentAssignments.filter(
    (assignment) => !assignmentsToClose.some((candidate) => candidate.id === assignment.id),
  )
  const projectedCurrentCount = assignmentStatus === 'vacant'
    ? assignmentsToKeep.length
    : assignmentsToKeep.length + 1
  const exceedsCapacity = config.holder_cardinality === 'multiple'
    && config.max_current_holders !== null
    && projectedCurrentCount > config.max_current_holders

  return (
    <section className={`empty-state ${exceedsCapacity ? 'error-box' : ''}`} aria-live="polite">
      <strong>Vista previa del impacto</strong>
      <span>
        {assignmentStatus === 'vacant'
          ? `Se registrará una vacante para ${config.display_name}.`
          : `${person?.display_name ?? 'La persona seleccionada'} asumirá ${config.display_name} desde ${dateLabel(startDate || null)}.`}
      </span>
      <span>
        Cardinalidad: {config.holder_cardinality === 'single'
          ? 'titular único'
          : config.max_current_holders
            ? `hasta ${config.max_current_holders} titulares`
            : 'múltiples titulares sin límite configurado'}.
      </span>
      {currentAssignments.length === 0 && <span>No existen titulares vigentes en este ámbito.</span>}
      {currentAssignments.map((assignment) => {
        const currentPerson = people.find((candidate) => candidate.id === assignment.person_id)
        const willClose = assignmentsToClose.some((candidate) => candidate.id === assignment.id)
        return (
          <span key={assignment.id}>
            {willClose ? 'Se cerrará' : 'Se conservará'}: {currentPerson?.display_name ?? 'Vacante'}
            {' · '}inicio {dateLabel(assignment.start_date)}
            {assignment.term_end_date ? ` · fin previsto ${dateLabel(assignment.term_end_date)}` : ''}.
          </span>
        )
      })}
      {predecessor && (
        <span>
          Predecesor explícito: {people.find((candidate) => candidate.id === predecessor.person_id)?.display_name ?? 'Vacante'}.
        </span>
      )}
      <span>Titulares vigentes después de guardar: {projectedCurrentCount}.</span>
      {exceedsCapacity && (
        <span>La operación excedería la cantidad máxima de titulares. Cierra un nombramiento vigente o revisa la configuración.</span>
      )}
    </section>
  )
}
