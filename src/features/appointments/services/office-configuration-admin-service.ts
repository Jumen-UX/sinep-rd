import type { SupabaseClient } from '@supabase/supabase-js'

export type OfficeCatalogItem = {
  id: string
  key: string
  name: string
  status?: string | null
}

export type OfficeChart = OfficeCatalogItem & {
  description: string | null
}

export type OfficeBaseRole = OfficeCatalogItem & {
  feminine_name: string | null
  plural_name: string | null
}

export type OfficeScope = OfficeCatalogItem & {
  adjective_masculine: string | null
  adjective_feminine: string | null
}

export type OfficeCategory = OfficeCatalogItem & {
  description: string | null
}

export type OfficeConfiguration = {
  id: string
  key: string
  display_name: string
  base_role_id: string
  scope_id: string
  category_id: string
  organization_chart_id: string | null
  requires_clergy: boolean
  is_elective: boolean
  is_renewable: boolean
  default_term_months: number | null
  continues_until_replaced: boolean
  status: string
}

export type OfficeCatalogTable =
  | 'organization_charts'
  | 'office_base_roles'
  | 'office_scopes'
  | 'office_categories'

export type OfficeConfigurationCatalogs = {
  charts: OfficeChart[]
  roles: OfficeBaseRole[]
  scopes: OfficeScope[]
  categories: OfficeCategory[]
  configurations: OfficeConfiguration[]
}

export type SaveOfficeCatalogItemInput = {
  name: string
  key: string
  description?: string | null
  feminineName?: string | null
  pluralName?: string | null
  adjectiveMasculine?: string | null
  adjectiveFeminine?: string | null
}

export type SaveOfficeConfigurationInput = {
  key: string
  displayName: string
  role: OfficeBaseRole
  scope: OfficeScope
  category: OfficeCategory
  chart: OfficeChart | null
  requiresClergy: boolean
  isElective: boolean
  isRenewable: boolean
  continuesUntilReplaced: boolean
  defaultTermMonths: number | null
}

const initialCharts = [
  { key: 'ecclesial', name: 'Organigrama eclesial', description: 'Estructura canónica y eclesial.', sort_order: 10 },
  { key: 'pastoral', name: 'Organigrama pastoral', description: 'Estructura de pastorales, comisiones y equipos.', sort_order: 20 },
  { key: 'administrative', name: 'Organigrama administrativo', description: 'Estructura administrativa y operativa.', sort_order: 30 },
]

const initialRoles = [
  { key: 'coordinator', name: 'Coordinador', feminine_name: 'Coordinadora', plural_name: 'Coordinadores', sort_order: 10 },
  { key: 'advisor', name: 'Asesor', feminine_name: 'Asesora', plural_name: 'Asesores', sort_order: 20 },
  { key: 'director', name: 'Director', feminine_name: 'Directora', plural_name: 'Directores', sort_order: 30 },
  { key: 'manager', name: 'Encargado', feminine_name: 'Encargada', plural_name: 'Encargados', sort_order: 40 },
  { key: 'secretary', name: 'Secretario', feminine_name: 'Secretaria', plural_name: 'Secretarios', sort_order: 50 },
  { key: 'treasurer', name: 'Tesorero', feminine_name: 'Tesorera', plural_name: 'Tesoreros', sort_order: 60 },
  { key: 'administrator', name: 'Administrador', feminine_name: 'Administradora', plural_name: 'Administradores', sort_order: 70 },
  { key: 'delegate', name: 'Delegado', feminine_name: 'Delegada', plural_name: 'Delegados', sort_order: 80 },
  { key: 'responsible', name: 'Responsable', feminine_name: 'Responsable', plural_name: 'Responsables', sort_order: 90 },
  { key: 'member', name: 'Miembro', feminine_name: 'Miembro', plural_name: 'Miembros', sort_order: 100 },
  { key: 'parish_priest', name: 'Párroco', feminine_name: null, plural_name: 'Párrocos', sort_order: 110 },
  { key: 'vicar', name: 'Vicario', feminine_name: null, plural_name: 'Vicarios', sort_order: 120 },
  { key: 'bishop', name: 'Obispo', feminine_name: null, plural_name: 'Obispos', sort_order: 130 },
  { key: 'chancellor', name: 'Canciller', feminine_name: null, plural_name: 'Cancilleres', sort_order: 140 },
  { key: 'economus', name: 'Ecónomo', feminine_name: null, plural_name: 'Ecónomos', sort_order: 150 },
]

const initialScopes = [
  { key: 'national', name: 'Nacional', adjective_masculine: 'nacional', adjective_feminine: 'nacional', sort_order: 10 },
  { key: 'archdiocesan', name: 'Arquidiocesano', adjective_masculine: 'arquidiocesano', adjective_feminine: 'arquidiocesana', sort_order: 20 },
  { key: 'diocesan', name: 'Diocesano', adjective_masculine: 'diocesano', adjective_feminine: 'diocesana', sort_order: 30 },
  { key: 'vicarial', name: 'Vicarial', adjective_masculine: 'vicarial', adjective_feminine: 'vicarial', sort_order: 40 },
  { key: 'zonal', name: 'Zonal', adjective_masculine: 'zonal', adjective_feminine: 'zonal', sort_order: 50 },
  { key: 'parish', name: 'Parroquial', adjective_masculine: 'parroquial', adjective_feminine: 'parroquial', sort_order: 60 },
  { key: 'community', name: 'Comunitario', adjective_masculine: 'comunitario', adjective_feminine: 'comunitaria', sort_order: 70 },
]

const initialCategories = [
  { key: 'canonical', name: 'Canónico', description: 'Oficios eclesiásticos o canónicos.', sort_order: 10 },
  { key: 'pastoral', name: 'Pastoral', description: 'Responsabilidades pastorales, comisiones y equipos.', sort_order: 20 },
  { key: 'administrative', name: 'Administrativo', description: 'Responsabilidades administrativas u operativas.', sort_order: 30 },
  { key: 'honorary', name: 'Honorífico', description: 'Títulos, tratamientos o reconocimientos.', sort_order: 40 },
  { key: 'consultative', name: 'Consultivo', description: 'Consejos y organismos consultivos.', sort_order: 50 },
  { key: 'term_based', name: 'Por período', description: 'Cargos con duración definida y renovación.', sort_order: 60 },
]

function throwIfError(error: { message: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback)
}

export async function loadOfficeConfigurationCatalogs(
  supabase: SupabaseClient,
): Promise<OfficeConfigurationCatalogs> {
  const [chartResult, roleResult, scopeResult, categoryResult, configurationResult] = await Promise.all([
    supabase.from('organization_charts').select('id,key,name,description,status').order('sort_order'),
    supabase.from('office_base_roles').select('id,key,name,feminine_name,plural_name,status').order('sort_order'),
    supabase.from('office_scopes').select('id,key,name,adjective_masculine,adjective_feminine,status').order('sort_order'),
    supabase.from('office_categories').select('id,key,name,description,status').order('sort_order'),
    supabase
      .from('office_configurations')
      .select('id,key,display_name,base_role_id,scope_id,category_id,organization_chart_id,requires_clergy,is_elective,is_renewable,default_term_months,continues_until_replaced,status')
      .order('display_name'),
  ])

  const error = chartResult.error
    ?? roleResult.error
    ?? scopeResult.error
    ?? categoryResult.error
    ?? configurationResult.error
  throwIfError(error, 'No se pudo cargar la configuración de cargos.')

  return {
    charts: (chartResult.data ?? []) as OfficeChart[],
    roles: (roleResult.data ?? []) as OfficeBaseRole[],
    scopes: (scopeResult.data ?? []) as OfficeScope[],
    categories: (categoryResult.data ?? []) as OfficeCategory[],
    configurations: (configurationResult.data ?? []) as OfficeConfiguration[],
  }
}

export async function seedOfficeConfigurationDefaults(supabase: SupabaseClient) {
  const results = await Promise.all([
    supabase.from('organization_charts').upsert(initialCharts, { onConflict: 'key' }),
    supabase.from('office_base_roles').upsert(initialRoles, { onConflict: 'key' }),
    supabase.from('office_scopes').upsert(initialScopes, { onConflict: 'key' }),
    supabase.from('office_categories').upsert(initialCategories, { onConflict: 'key' }),
  ])

  const failed = results.find((result) => result.error)
  throwIfError(failed?.error ?? null, 'No se pudieron inicializar los catálogos de cargos.')
}

export async function saveOfficeCatalogItem(
  supabase: SupabaseClient,
  table: OfficeCatalogTable,
  input: SaveOfficeCatalogItemInput,
) {
  switch (table) {
    case 'organization_charts': {
      const result = await supabase.from('organization_charts').upsert({
        name: input.name,
        key: input.key,
        status: 'active',
        description: input.description ?? null,
      }, { onConflict: 'key' })
      throwIfError(result.error, 'No se pudo guardar el organigrama.')
      return
    }
    case 'office_base_roles': {
      const result = await supabase.from('office_base_roles').upsert({
        name: input.name,
        key: input.key,
        status: 'active',
        feminine_name: input.feminineName ?? null,
        plural_name: input.pluralName ?? null,
      }, { onConflict: 'key' })
      throwIfError(result.error, 'No se pudo guardar el cargo base.')
      return
    }
    case 'office_scopes': {
      const result = await supabase.from('office_scopes').upsert({
        name: input.name,
        key: input.key,
        status: 'active',
        adjective_masculine: input.adjectiveMasculine ?? null,
        adjective_feminine: input.adjectiveFeminine ?? null,
      }, { onConflict: 'key' })
      throwIfError(result.error, 'No se pudo guardar el ámbito.')
      return
    }
    case 'office_categories': {
      const result = await supabase.from('office_categories').upsert({
        name: input.name,
        key: input.key,
        status: 'active',
        description: input.description ?? null,
      }, { onConflict: 'key' })
      throwIfError(result.error, 'No se pudo guardar la categoría.')
    }
  }
}

export async function saveOfficeConfiguration(
  supabase: SupabaseClient,
  input: SaveOfficeConfigurationInput,
) {
  const { error } = await supabase.rpc('admin_save_office_configuration', {
    payload: {
      key: input.key,
      display_name: input.displayName,
      base_role_key: input.role.key,
      base_role_name: input.role.name,
      feminine_name: input.role.feminine_name,
      plural_name: input.role.plural_name,
      scope_key: input.scope.key,
      scope_name: input.scope.name,
      scope_adjective_masculine: input.scope.adjective_masculine,
      scope_adjective_feminine: input.scope.adjective_feminine,
      category_key: input.category.key,
      category_name: input.category.name,
      category_description: input.category.description,
      organization_chart_key: input.chart?.key ?? null,
      organization_chart_name: input.chart?.name ?? null,
      organization_chart_description: input.chart?.description ?? null,
      requires_clergy: input.requiresClergy,
      is_elective: input.isElective,
      is_renewable: input.isRenewable,
      default_term_months: input.defaultTermMonths,
      continues_until_replaced: input.continuesUntilReplaced,
    },
  })

  throwIfError(error, 'No se pudo guardar la configuración de cargo.')
}
