import type { AdminKpiValueKind } from './admin-kpi-contract'
import type { ResolvedAdminKpi } from './admin-kpi-policy'
import type { DashboardSummary } from './admin-dashboard-service'

export type AdminKpiValueStatus = 'available' | 'unavailable' | 'not_applicable'

export type AdminKpiValue = {
  id: string
  value: number | null
  valueKind: AdminKpiValueKind
  status: AdminKpiValueStatus
  message: string
}

export type AdminKpiSource = {
  summary: DashboardSummary | null
  peopleCount: number | null
  activeAssignments: number | null
  contextualKpis: Record<string, number> | null
}

const globalValueReaders: Record<string, (source: AdminKpiSource) => number | null> = {
  'territorial.active_entities': (source) => source.summary?.active_entities ?? null,
  'territorial.active_parishes': (source) => source.summary?.active_parishes ?? null,
  'territorial.active_people': (source) => source.peopleCount,
  'pastoral.active_areas': (source) => source.summary?.active_pastoral_areas ?? null,
  'pastoral.active_units': (source) => source.summary?.active_organization_units ?? null,
  'administrative.active_assignments': (source) => source.activeAssignments,
  'administrative.pending_reviews': (source) => source.summary?.pending_change_requests ?? null,
}

export function resolveAdminKpiValues(
  kpis: readonly ResolvedAdminKpi[],
  source: AdminKpiSource,
  isUnrestricted: boolean,
): AdminKpiValue[] {
  return kpis.map((kpi) => {
    if (kpi.availability === 'not_applicable') {
      return {
        id: kpi.id,
        value: null,
        valueKind: kpi.valueKind,
        status: 'not_applicable',
        message: 'Este indicador no aplica al alcance seleccionado.',
      }
    }

    const value = isUnrestricted
      ? globalValueReaders[kpi.id]?.(source) ?? null
      : source.contextualKpis?.[kpi.id] ?? null

    if (value === null) {
      return {
        id: kpi.id,
        value: null,
        valueKind: kpi.valueKind,
        status: 'unavailable',
        message: isUnrestricted
          ? 'La fuente de este indicador todavía no está disponible.'
          : 'La agregación segura para este indicador todavía no está disponible en el alcance activo.',
      }
    }

    return {
      id: kpi.id,
      value,
      valueKind: kpi.valueKind,
      status: 'available',
      message: isUnrestricted
        ? 'Dato calculado para el alcance global o nacional activo.'
        : 'Dato calculado dentro del alcance territorial activo y sus descendientes autorizados.',
    }
  })
}
