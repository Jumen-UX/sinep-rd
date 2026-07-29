import 'server-only'

import { fetchSupabaseJson } from '@/lib/supabase/rest'

export type PublicOrganizationDetail = {
  unit: {
    id: string
    name: string
    description: string | null
    parent_unit_id: string | null
  }
  chart: {
    id: string
    name: string
    description: string | null
  } | null
}

const unitColumns = [
  'id',
  'organization_chart_id',
  'parent_unit_id',
  'name',
  'description',
  'visibility',
  'status',
].join(',')

const chartColumns = [
  'id',
  'key',
  'name',
  'description',
].join(',')

export async function loadUncachedPublicOrganizationDetail(id: string): Promise<PublicOrganizationDetail | null> {
  const rows = await fetchSupabaseJson<Array<Record<string, unknown>>>('organization_units', {
    id: `eq.${id}`,
    status: 'eq.active',
    visibility: 'eq.public',
    select: unitColumns,
    limit: '1',
  })

  const unit = rows[0]
  if (!unit) return null

  const chartId = typeof unit.organization_chart_id === 'string' ? unit.organization_chart_id : ''
  const charts = chartId
    ? await fetchSupabaseJson<Array<Record<string, unknown>>>('organization_charts', {
        id: `eq.${chartId}`,
        status: 'eq.active',
        visibility: 'eq.public',
        select: chartColumns,
        limit: '1',
      }).catch(() => [])
    : []

  const chart = charts[0]

  return {
    unit: {
      id: String(unit.id),
      name: String(unit.name),
      description: typeof unit.description === 'string' ? unit.description : null,
      parent_unit_id: typeof unit.parent_unit_id === 'string' ? unit.parent_unit_id : null,
    },
    chart: chart
      ? {
          id: String(chart.id),
          name: String(chart.name),
          description: typeof chart.description === 'string' ? chart.description : null,
        }
      : null,
  }
}
