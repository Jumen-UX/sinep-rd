'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  loadOfficeConfigurationCatalogs,
  saveOfficeCatalogItem,
  saveOfficeConfiguration,
  seedOfficeConfigurationDefaults,
  type OfficeBaseRole,
  type OfficeCategory,
  type OfficeChart,
  type OfficeConfiguration,
  type OfficeCatalogTable,
  type OfficeScope,
} from '../services/office-configuration-admin-service'

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export default function OfficeConfigurationPage() {
  const router = useRouter()
  const [charts, setCharts] = useState<OfficeChart[]>([])
  const [roles, setRoles] = useState<OfficeBaseRole[]>([])
  const [scopes, setScopes] = useState<OfficeScope[]>([])
  const [categories, setCategories] = useState<OfficeCategory[]>([])
  const [configurations, setConfigurations] = useState<OfficeConfiguration[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])

  async function loadData() {
    setError(null)

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/admin/login')
        return
      }

      const catalogs = await loadOfficeConfigurationCatalogs(supabase)
      setCharts(catalogs.charts)
      setRoles(catalogs.roles)
      setScopes(catalogs.scopes)
      setCategories(catalogs.categories)
      setConfigurations(catalogs.configurations)
    } catch (loadError) {
      setError(errorMessage(loadError, 'No se pudo cargar la configuración.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  async function seedDefaults() {
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      await seedOfficeConfigurationDefaults(supabase)
      setMessage('Catálogos iniciales creados o actualizados.')
      await loadData()
    } catch (saveError) {
      setError(errorMessage(saveError, 'No se pudieron inicializar los catálogos.'))
    } finally {
      setSaving(false)
    }
  }

  async function createCatalogItem(event: FormEvent<HTMLFormElement>, table: OfficeCatalogTable) {
    event.preventDefault()
    const formElement = event.currentTarget
    setSaving(true)
    setError(null)
    setMessage(null)

    const form = new FormData(formElement)
    const name = String(form.get('name') ?? '').trim()
    const key = String(form.get('key') ?? '').trim() || slugify(name)

    if (!name || !key) {
      setError('Debes indicar nombre y clave.')
      setSaving(false)
      return
    }

    try {
      await saveOfficeCatalogItem(supabase, table, {
        name,
        key,
        description: String(form.get('description') ?? '').trim() || null,
        feminineName: String(form.get('feminine_name') ?? '').trim() || null,
        pluralName: String(form.get('plural_name') ?? '').trim() || null,
        adjectiveMasculine: String(form.get('adjective_masculine') ?? '').trim() || null,
        adjectiveFeminine: String(form.get('adjective_feminine') ?? '').trim() || null,
      })
      setMessage('Registro guardado.')
      formElement.reset()
      await loadData()
    } catch (saveError) {
      setError(errorMessage(saveError, 'No se pudo guardar el registro.'))
    } finally {
      setSaving(false)
    }
  }

  async function createConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setSaving(true)
    setError(null)
    setMessage(null)

    const form = new FormData(formElement)
    const displayName = String(form.get('display_name') ?? '').trim()
    const baseRoleId = String(form.get('base_role_id') ?? '')
    const scopeId = String(form.get('scope_id') ?? '')
    const categoryId = String(form.get('category_id') ?? '')
    const chartId = String(form.get('organization_chart_id') ?? '')
    const defaultTerm = String(form.get('default_term_months') ?? '').trim()

    const role = roles.find((item) => item.id === baseRoleId)
    const scope = scopes.find((item) => item.id === scopeId)
    const category = categories.find((item) => item.id === categoryId)
    const chart = chartId ? charts.find((item) => item.id === chartId) ?? null : null
    const key = String(form.get('key') ?? '').trim()
      || slugify(`${role?.key ?? 'role'}_${scope?.key ?? 'scope'}_${category?.key ?? 'category'}`)

    if (!displayName || !role || !scope || !category || !key) {
      setError('Debes completar nombre, cargo base, ámbito, categoría y clave.')
      setSaving(false)
      return
    }

    try {
      await saveOfficeConfiguration(supabase, {
        key,
        displayName,
        role,
        scope,
        category,
        chart,
        requiresClergy: form.get('requires_clergy') === 'on',
        isElective: form.get('is_elective') === 'on',
        isRenewable: form.get('is_renewable') === 'on',
        continuesUntilReplaced: form.get('continues_until_replaced') === 'on',
        defaultTermMonths: defaultTerm ? Number(defaultTerm) : null,
      })
      setMessage('Configuración de cargo guardada.')
      formElement.reset()
      await loadData()
    } catch (saveError) {
      setError(errorMessage(saveError, 'No se pudo guardar la configuración de cargo.'))
    } finally {
      setSaving(false)
    }
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
