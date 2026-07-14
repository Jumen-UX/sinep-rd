'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type CatalogItem = {
  id: string
  key: string
  name: string
  status?: string | null
}

type Chart = CatalogItem & {
  description: string | null
}

type BaseRole = CatalogItem & {
  feminine_name: string | null
  plural_name: string | null
}

type Scope = CatalogItem & {
  adjective_masculine: string | null
  adjective_feminine: string | null
}

type Category = CatalogItem & {
  description: string | null
}

type OfficeConfiguration = {
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

type CatalogTable =
  | 'organization_charts'
  | 'office_base_roles'
  | 'office_scopes'
  | 'office_categories'

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

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export default function AdminCargosPage() {
  const router = useRouter()
  const [charts, setCharts] = useState<Chart[]>([])
  const [roles, setRoles] = useState<BaseRole[]>([])
  const [scopes, setScopes] = useState<Scope[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [configurations, setConfigurations] = useState<OfficeConfiguration[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])

  async function loadData() {
    setError(null)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    const [chartRes, roleRes, scopeRes, categoryRes, configRes] = await Promise.all([
      supabase.from('organization_charts').select('id,key,name,description,status').order('sort_order'),
      supabase.from('office_base_roles').select('id,key,name,feminine_name,plural_name,status').order('sort_order'),
      supabase.from('office_scopes').select('id,key,name,adjective_masculine,adjective_feminine,status').order('sort_order'),
      supabase.from('office_categories').select('id,key,name,description,status').order('sort_order'),
      supabase.from('office_configurations').select('id,key,display_name,base_role_id,scope_id,category_id,organization_chart_id,requires_clergy,is_elective,is_renewable,default_term_months,continues_until_replaced,status').order('display_name'),
    ])

    if (chartRes.error || roleRes.error || scopeRes.error || categoryRes.error || configRes.error) {
      setError(chartRes.error?.message || roleRes.error?.message || scopeRes.error?.message || categoryRes.error?.message || configRes.error?.message || 'No se pudo cargar la configuración')
    } else {
      setCharts((chartRes.data ?? []) as Chart[])
      setRoles((roleRes.data ?? []) as BaseRole[])
      setScopes((scopeRes.data ?? []) as Scope[])
      setCategories((categoryRes.data ?? []) as Category[])
      setConfigurations((configRes.data ?? []) as OfficeConfiguration[])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function seedDefaults() {
    setSaving(true)
    setError(null)
    setMessage(null)

    const operations = [
      supabase.from('organization_charts').upsert(initialCharts, { onConflict: 'key' }),
      supabase.from('office_base_roles').upsert(initialRoles, { onConflict: 'key' }),
      supabase.from('office_scopes').upsert(initialScopes, { onConflict: 'key' }),
      supabase.from('office_categories').upsert(initialCategories, { onConflict: 'key' }),
    ]

    const results = await Promise.all(operations)
    const failed = results.find((result) => result.error)

    if (failed?.error) {
      setError(failed.error.message)
    } else {
      setMessage('Catálogos iniciales creados o actualizados.')
      await loadData()
    }

    setSaving(false)
  }

  async function createCatalogItem(event: FormEvent<HTMLFormElement>, table: CatalogTable) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)

    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const key = String(form.get('key') ?? '').trim() || slugify(name)

    if (!name || !key) {
      setError('Debes indicar nombre y clave.')
      setSaving(false)
      return
    }

    let saveError: { message: string } | null = null

    switch (table) {
      case 'organization_charts': {
        const result = await supabase.from('organization_charts').upsert({
          name,
          key,
          status: 'active',
          description: String(form.get('description') ?? '').trim() || null,
        }, { onConflict: 'key' })
        saveError = result.error
        break
      }
      case 'office_base_roles': {
        const result = await supabase.from('office_base_roles').upsert({
          name,
          key,
          status: 'active',
          feminine_name: String(form.get('feminine_name') ?? '').trim() || null,
          plural_name: String(form.get('plural_name') ?? '').trim() || null,
        }, { onConflict: 'key' })
        saveError = result.error
        break
      }
      case 'office_scopes': {
        const result = await supabase.from('office_scopes').upsert({
          name,
          key,
          status: 'active',
          adjective_masculine: String(form.get('adjective_masculine') ?? '').trim() || null,
          adjective_feminine: String(form.get('adjective_feminine') ?? '').trim() || null,
        }, { onConflict: 'key' })
        saveError = result.error
        break
      }
      case 'office_categories': {
        const result = await supabase.from('office_categories').upsert({
          name,
          key,
          status: 'active',
          description: String(form.get('description') ?? '').trim() || null,
        }, { onConflict: 'key' })
        saveError = result.error
        break
      }
    }

    if (saveError) {
      setError(saveError.message)
    } else {
      setMessage('Registro guardado.')
      event.currentTarget.reset()
      await loadData()
    }

    setSaving(false)
  }

  async function createConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)

    const form = new FormData(event.currentTarget)
    const displayName = String(form.get('display_name') ?? '').trim()
    const baseRoleId = String(form.get('base_role_id') ?? '')
    const scopeId = String(form.get('scope_id') ?? '')
    const categoryId = String(form.get('category_id') ?? '')
    const chartId = String(form.get('organization_chart_id') ?? '') || null
    const defaultTerm = String(form.get('default_term_months') ?? '').trim()

    const role = roles.find((item) => item.id === baseRoleId)
    const scope = scopes.find((item) => item.id === scopeId)
    const category = categories.find((item) => item.id === categoryId)
    const key = String(form.get('key') ?? '').trim() || slugify(`${role?.key ?? 'role'}_${scope?.key ?? 'scope'}_${category?.key ?? 'category'}`)

    if (!displayName || !baseRoleId || !scopeId || !categoryId || !key) {
      setError('Debes completar nombre, cargo base, ámbito, categoría y clave.')
      setSaving(false)
      return
    }

    const { error: saveError } = await supabase.from('office_configurations').upsert({
      key,
      display_name: displayName,
      base_role_id: baseRoleId,
      scope_id: scopeId,
      category_id: categoryId,
      organization_chart_id: chartId,
      requires_clergy: form.get('requires_clergy') === 'on',
      is_elective: form.get('is_elective') === 'on',
      is_renewable: form.get('is_renewable') === 'on',
      continues_until_replaced: form.get('continues_until_replaced') === 'on',
      default_term_months: defaultTerm ? Number(defaultTerm) : null,
      status: 'active',
      visibility: 'public',
    }, { onConflict: 'key' })

    if (saveError) {
      setError(saveError.message)
    } else {
      setMessage('Configuración de cargo guardada.')
      event.currentTarget.reset()
      await loadData()
    }

    setSaving(false)
  }

  const roleById = new Map(roles.map((item) => [item.id, item]))
  const scopeById = new Map(scopes.map((item) => [item.id, item]))
  const categoryById = new Map(categories.map((item) => [item.id, item]))
  const chartById = new Map(charts.map((item) => [item.id, item]))

  if (loading) {
    return <main className="container"><div className="empty-state">Cargando configuración...</div></main>
  }

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink">
        <Link href="/admin">← Volver al panel administrativo</Link>
      </div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Configuración</p>
          <h1>Cargos, ámbitos y organigramas</h1>
          <p className="lead">
            Define cargos base, ámbitos, categorías y combinaciones permitidas. Luego estas configuraciones se usarán para organigramas eclesiales, pastorales y administrativos.
          </p>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="empty-state">{message}</div>}

      <section className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Inicialización</p>
            <h2>Catálogos base</h2>
          </div>
          <button className="button button-primary" type="button" disabled={saving} onClick={seedDefaults}>
            {saving ? 'Guardando...' : 'Crear valores iniciales'}
          </button>
        </div>
        <p className="meta">Este botón crea organigramas, cargos base, ámbitos y categorías iniciales. Puedes editarlos o ampliarlos después.</p>
      </section>

      <section className="dashboard-grid admin-form-grid">
        <form className="card dashboard-section admin-form" onSubmit={(event) => createCatalogItem(event, 'organization_charts')}>
          <h2>Organigrama</h2>
          <input name="name" placeholder="Nombre" />
          <input name="key" placeholder="Clave opcional" />
          <textarea name="description" placeholder="Descripción" />
          <button className="button button-primary" disabled={saving}>Guardar</button>
        </form>

        <form className="card dashboard-section admin-form" onSubmit={(event) => createCatalogItem(event, 'office_base_roles')}>
          <h2>Cargo base</h2>
          <input name="name" placeholder="Coordinador" />
          <input name="key" placeholder="coordinator" />
          <input name="feminine_name" placeholder="Coordinadora" />
          <input name="plural_name" placeholder="Coordinadores" />
          <button className="button button-primary" disabled={saving}>Guardar</button>
        </form>

        <form className="card dashboard-section admin-form" onSubmit={(event) => createCatalogItem(event, 'office_scopes')}>
          <h2>Ámbito</h2>
          <input name="name" placeholder="Diocesano" />
          <input name="key" placeholder="diocesan" />
          <input name="adjective_masculine" placeholder="diocesano" />
          <input name="adjective_feminine" placeholder="diocesana" />
          <button className="button button-primary" disabled={saving}>Guardar</button>
        </form>

        <form className="card dashboard-section admin-form" onSubmit={(event) => createCatalogItem(event, 'office_categories')}>
          <h2>Categoría</h2>
          <input name="name" placeholder="Pastoral" />
          <input name="key" placeholder="pastoral" />
          <textarea name="description" placeholder="Descripción" />
          <button className="button button-primary" disabled={saving}>Guardar</button>
        </form>
      </section>

      <section className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Combinación</p>
            <h2>Nueva configuración de cargo</h2>
          </div>
        </div>
        <form className="admin-form admin-config-form" onSubmit={createConfiguration}>
          <input name="display_name" placeholder="Coordinador diocesano" />
          <input name="key" placeholder="clave opcional" />
          <select name="base_role_id" defaultValue=""><option value="">Cargo base</option>{roles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select name="scope_id" defaultValue=""><option value="">Ámbito</option>{scopes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select name="category_id" defaultValue=""><option value="">Categoría</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select name="organization_chart_id" defaultValue=""><option value="">Organigrama opcional</option>{charts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <input name="default_term_months" placeholder="Duración en meses" type="number" min="1" />
          <label><input name="requires_clergy" type="checkbox" /> Requiere clérigo</label>
          <label><input name="is_elective" type="checkbox" /> Puede ser por elección</label>
          <label><input name="is_renewable" type="checkbox" defaultChecked /> Es renovable</label>
          <label><input name="continues_until_replaced" type="checkbox" defaultChecked /> Continúa hasta sustitución</label>
          <button className="button button-primary" disabled={saving}>Guardar configuración</button>
        </form>
      </section>

      <section className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Listado</p>
            <h2>Configuraciones existentes</h2>
          </div>
          <span className="meta">{configurations.length} registros</span>
        </div>
        <div className="table-wrap">
          <table className="data-table dashboard-list-table">
            <thead>
              <tr>
                <th>Configuración</th>
                <th>Cargo base</th>
                <th>Ámbito</th>
                <th>Categoría</th>
                <th>Organigrama</th>
                <th>Período</th>
                <th>Reglas</th>
              </tr>
            </thead>
            <tbody>
              {configurations.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.display_name}</strong><small>{item.key}</small></td>
                  <td>{roleById.get(item.base_role_id)?.name ?? '—'}</td>
                  <td>{scopeById.get(item.scope_id)?.name ?? '—'}</td>
                  <td>{categoryById.get(item.category_id)?.name ?? '—'}</td>
                  <td>{item.organization_chart_id ? chartById.get(item.organization_chart_id)?.name ?? '—' : '—'}</td>
                  <td>{item.default_term_months ? `${item.default_term_months} meses` : 'Sin período fijo'}</td>
                  <td>{item.continues_until_replaced ? 'Continúa hasta sustitución' : 'Finaliza al vencer'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
