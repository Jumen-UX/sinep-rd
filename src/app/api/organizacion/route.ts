import { NextRequest, NextResponse } from 'next/server'
import { fetchSupabaseJson } from '@/lib/supabase/rest'

const unitColumns = [
  'id',
  'organization_chart_id',
  'parent_unit_id',
  'name',
  'description',
  'visibility',
  'status'
].join(',')

const chartColumns = [
  'id',
  'key',
  'name',
  'description'
].join(',')

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Falta el identificador de la unidad' }, { status: 400 })
  }

  try {
    const rows = await fetchSupabaseJson<Record<string, unknown>[]>('organization_units', {
      id: `eq.${id}`,
      status: 'eq.active',
      visibility: 'eq.public',
      select: unitColumns,
      limit: '1',
    })

    const unit = rows[0]

    if (!unit) {
      return NextResponse.json({ error: 'Unidad organizativa no encontrada' }, { status: 404 })
    }

    const chartId = unit.organization_chart_id ? String(unit.organization_chart_id) : ''
    const charts = chartId ? await fetchSupabaseJson<Record<string, unknown>[]>('organization_charts', {
      id: `eq.${chartId}`,
      status: 'eq.active',
      visibility: 'eq.public',
      select: chartColumns,
      limit: '1',
    }).catch(() => []) : []

    return NextResponse.json({ unit, chart: charts[0] ?? null })
  } catch (error) {
    console.error('Unexpected organization unit API error', error)
    return NextResponse.json({ error: 'No se pudo cargar la unidad organizativa' }, { status: 500 })
  }
}
