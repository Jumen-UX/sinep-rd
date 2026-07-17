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

export type AdminKpiGlobalSource = {
  summary: DashboardSummary | null
  peopleCount: number | null
  activeAssignments: number | null
}

const globalValueReaders: Record<string, (source: AdminKpiGlobalSource) => number | null> = {
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
  source: AdminKpiGlobalSource,
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

    if (!isUnrestricted) {
      return {
        id: kpi.id,
        value: null,
        valueKind: kpi.valueKind,
        status: 'unavailable',
        message: 'La agregación segura para este alcance todavía no está disponible.',
      }
    }

    const reader = globalValueReaders[kpi.id]
    const value = reader?.(source) ?? null

    return {
      id: kpi.id,
      value,
      valueKind: kpi.valueKind,
      status: value === null ? 'unavailable' : 'available',
      message: value === null
        ? 'La fuente de este indicador todavía no está disponible.'
        : 'Dato calculado para el alcance global o nacional activo.',
    }
  })
}
