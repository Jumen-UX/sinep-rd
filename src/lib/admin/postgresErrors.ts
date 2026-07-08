type PostgresLikeError = {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
}

function isPostgresLikeError(error: unknown): error is PostgresLikeError {
  return typeof error === 'object' && error !== null && ('message' in error || 'code' in error)
}

export function toSpanishAdminError(error: unknown, fallback = 'No se pudo completar la operación.'): string {
  if (!isPostgresLikeError(error)) return fallback

  const code = error.code
  const message = error.message ?? ''

  if (code === '23505') {
    if (message.includes('position_assignments_one_current_per_scope')) {
      return 'Ya existe una asignación actual para ese mismo cargo y entidad. Cierra la asignación anterior o revisa el historial antes de guardar.'
    }
    return 'Ya existe un registro con esos datos. Revisa si estás intentando crear un duplicado.'
  }

  if (code === '23503') return 'No se encontró uno de los registros relacionados. Verifica las selecciones antes de guardar.'
  if (code === '23514') return 'Uno de los valores no cumple las reglas permitidas para este formulario.'
  if (code === '42501') return 'No tienes permiso para realizar esta acción administrativa.'
  if (code === 'P0001' && message) return message

  if (message.includes('duplicate key')) return 'Ya existe un registro con esos datos. Revisa si estás intentando crear un duplicado.'
  if (message.includes('violates foreign key constraint')) return 'No se encontró uno de los registros relacionados. Verifica las selecciones antes de guardar.'
  if (message.includes('permission denied')) return 'No tienes permiso para realizar esta acción administrativa.'

  return message || fallback
}
