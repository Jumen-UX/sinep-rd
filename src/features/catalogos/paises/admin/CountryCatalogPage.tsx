'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AdminModuleHeader from '@/components/admin/AdminModuleHeader'
import AdminStatusNotice from '@/components/admin/AdminStatusNotice'
import { createClient } from '@/lib/supabase/client'

type CatalogCountry = {
  key: string
  iso2: string
  iso3: string | null
  name: string
  name_en: string
  official_name_en: string | null
  common_name_en: string | null
  flag_emoji: string | null
  flag_alt: string | null
}

type EnabledCountry = {
  id: string
  iso2: string
  iso3: string | null
  name: string
  official_name: string | null
  flag_emoji: string | null
  flag_image_url: string | null
  flag_alt: string | null
  status: string
  visibility: string
}

type PublicCountry = {
  key: string
  iso2: string
  name: string
  flag_emoji: string | null
  flag_image_url: string | null
}

type CountriesResponse = {
  catalog_countries: CatalogCountry[]
  enabled_countries: EnabledCountry[]
  public_countries: PublicCountry[]
  error?: string
  code?: string
  detail?: string
}

type EnableCountryResponse = { country_id?: string | null; iso2?: string; error?: string }

type LoadError = { title: string; description: string; code?: string }

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function flag(country: { flag_emoji?: string | null; flag_image_url?: string | null; name?: string | null }) {
  if (country.flag_image_url) return <img alt={`Bandera de ${country.name ?? 'país'}`} className="admin-country-flag-image" src={country.flag_image_url} />
  return <span className="admin-country-flag-emoji" role="img" aria-label={`Bandera de ${country.name ?? 'país'}`}>{country.flag_emoji ?? '▦'}</span>
}

function loadErrorMessage(status: number, data: CountriesResponse | null): LoadError {
  if (status === 401) return { title: 'La sesión administrativa venció.', description: 'Inicia sesión nuevamente para consultar el catálogo.', code: 'UNAUTHORIZED' }
  if (status === 403) return { title: 'No tienes permisos para consultar países.', description: 'Solicita acceso al catálogo territorial.', code: 'FORBIDDEN' }
  if (data?.code === 'COUNTRY_CATALOG_UNAVAILABLE') return { title: 'El catálogo ISO no está disponible.', description: data.detail ?? 'Revisa permisos o disponibilidad de la vista public_country_catalog.', code: data.code }
  return { title: data?.error ?? 'No se pudo cargar el módulo de países.', description: data?.detail ?? 'Puedes volver a intentar sin recargar toda la aplicación.', code: data?.code }
}

export default function CountryCatalogPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [catalog, setCatalog] = useState<CatalogCountry[]>([])
  const [enabledCountries, setEnabledCountries] = useState<EnabledCountry[]>([])
  const [publicCountries, setPublicCountries] = useState<PublicCountry[]>([])
  const [query, setQuery] = useState('')
  const [selectedIso2, setSelectedIso2] = useState('')
  const [flagImageUrl, setFlagImageUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<LoadError | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const enabledKeys = useMemo(() => new Set(enabledCountries.map((country) => country.iso2)), [enabledCountries])
  const publicKeys = useMemo(() => new Set(publicCountries.map((country) => country.iso2 ?? country.key)), [publicCountries])
  const availableCatalog = useMemo(() => {
    const search = normalize(query)
    return catalog
      .filter((country) => !enabledKeys.has(country.iso2))
      .filter((country) => !search || normalize(`${country.name} ${country.name_en} ${country.iso2} ${country.iso3 ?? ''}`).includes(search))
      .slice(0, 48)
  }, [catalog, enabledKeys, query])
  const selectedCountry = catalog.find((country) => country.iso2 === selectedIso2) ?? null

  async function loadCountries() {
    setLoadError(null)
    setLoading(true)
    try {
      const response = await fetch('/api/admin/paises', { cache: 'no-store' })
      const data = await response.json().catch(() => null) as CountriesResponse | null
      if (!response.ok || !data) throw loadErrorMessage(response.status, data)
      setCatalog(data.catalog_countries ?? [])
      setEnabledCountries(data.enabled_countries ?? [])
      setPublicCountries(data.public_countries ?? [])
    } catch (error) {
      const parsed = error as LoadError
      setLoadError(parsed?.title ? parsed : { title: 'No se pudo cargar el módulo de países.', description: 'Comprueba la conexión e inténtalo nuevamente.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) {
        router.replace('/admin/login')
        return
      }
      await loadCountries()
    }
    init()
  }, [router])

  async function handleEnableCountry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedCountry) {
      setActionError('Selecciona un país del catálogo ISO.')
      return
    }

    setSaving(true)
    setActionError(null)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/paises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iso2: selectedCountry.iso2, flag_image_url: flagImageUrl }),
      })
      const data = await response.json() as EnableCountryResponse
      if (!response.ok) throw new Error(data.error ?? 'No se pudo habilitar el país.')

      setMessage(`${selectedCountry.name} fue habilitado. Aparecerá públicamente cuando tenga una jurisdicción pública activa.`)
      setSelectedIso2('')
      setFlagImageUrl('')
      setQuery('')
      await loadCountries()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo habilitar el país.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="admin-countries-page" id="top">
      <AdminModuleHeader
        badge="ISO"
        title="Países"
        eyebrow="Catálogo territorial"
        heading="Países ISO"
        description="Selecciona países desde el catálogo oficial. La publicación pública depende de que exista al menos una jurisdicción activa y visible."
        tags={['Selección desde catálogo', 'Bandera automática', 'Publicación condicionada']}
        actions={<><Link className="button button-secondary" href="/admin">Volver al panel</Link><Link className="button button-primary" href="/admin/nuevo/jurisdiccion">Crear jurisdicción</Link></>}
      />

      {loadError && <AdminStatusNotice tone="error" title={loadError.title} description={loadError.description} action={<button className="button button-secondary" type="button" onClick={loadCountries}>Reintentar</button>} />}
      {actionError && <AdminStatusNotice tone="error" title="No se pudo completar la operación" description={actionError} />}
      {message && <AdminStatusNotice tone="success" title="País habilitado" description={message} />}

      <section className="admin-stat-strip" aria-label="Resumen de países">
        <a href="#enabled-countries"><span>◎</span><strong>{enabledCountries.length}</strong><small>Países habilitados</small></a>
        <a href="#enabled-countries"><span>◉</span><strong>{publicCountries.length}</strong><small>Visibles públicamente</small></a>
        <a href="#country-catalog"><span>▤</span><strong>{catalog.length}</strong><small>Países en catálogo ISO</small></a>
        <a href="/admin/nuevo/jurisdiccion"><span>▥</span><strong>+</strong><small>Nueva jurisdicción</small></a>
        <a href="/admin/estructura"><span>▦</span><strong>↗</strong><small>Estructura territorial</small></a>
      </section>

      <section className="grid two-columns" id="country-catalog">
        <section className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Catálogo ISO</p><h2>Seleccionar país</h2><p className="meta">Busca por nombre, ISO2 o ISO3. Los países ya habilitados se excluyen automáticamente.</p></div></div>
          <label>Buscar país<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ej.: República Dominicana, DO, DOM" /></label>

          {loading && <AdminStatusNotice tone="info" title="Consultando catálogo" description="Cargando países y estado de publicación…" />}
          {!loading && !loadError && availableCatalog.length === 0 && <AdminStatusNotice tone="empty" title="No hay coincidencias disponibles" description={query ? 'Cambia el término de búsqueda.' : 'Todos los países del catálogo ya están habilitados.'} />}

          <div className="admin-country-grid">
            {availableCatalog.map((country) => {
              const selected = country.iso2 === selectedIso2
              return (
                <button className={`entity-card admin-country-card${selected ? ' is-selected' : ''}`} key={country.iso2} type="button" onClick={() => setSelectedIso2(country.iso2)}>
                  <div className="admin-country-heading"><span className="admin-country-flag">{flag(country)}</span><div><p className="entity-type">{country.iso2} · {country.iso3 ?? 'Sin ISO3'}</p><h2>{country.name}</h2><p className="meta">{country.name_en}</p></div></div>
                </button>
              )
            })}
          </div>
        </section>

        <form className="admin-form admin-config-form card dashboard-section" onSubmit={handleEnableCountry}>
          <div className="section-heading"><div><p className="eyebrow">Ficha del país</p><h2>{selectedCountry ? selectedCountry.name : 'Selecciona un país'}</h2><p className="meta">Revisa los datos oficiales antes de habilitarlo.</p></div></div>

          {selectedCountry ? (
            <>
              <div className="admin-country-heading"><span className="admin-country-flag">{flag(selectedCountry)}</span><div><p className="entity-type">{selectedCountry.iso2} · {selectedCountry.iso3 ?? 'Sin ISO3'}</p><h2>{selectedCountry.name}</h2><p className="meta">{selectedCountry.official_name_en ?? selectedCountry.name_en}</p></div></div>
              <div className="admin-check-list"><div>✓ Código ISO2 disponible</div><div>✓ Código ISO3 {selectedCountry.iso3 ? 'disponible' : 'pendiente'}</div><div>✓ Bandera automática</div><div>⚠ No será público hasta tener jurisdicción activa</div></div>
              <label>Imagen de bandera personalizada opcional<input value={flagImageUrl} onChange={(event) => setFlagImageUrl(event.target.value)} placeholder="https://.../bandera.svg" type="url" /></label>
              <button className="button button-primary" disabled={saving} type="submit">{saving ? 'Habilitando…' : `Habilitar ${selectedCountry.name}`}</button>
            </>
          ) : (
            <AdminStatusNotice tone="empty" title="Ningún país seleccionado" description="Selecciona un país del catálogo para ver su ficha y habilitarlo." />
          )}
        </form>
      </section>

      <section className="card dashboard-section" id="enabled-countries">
        <div className="section-heading"><div><p className="eyebrow">Países activos</p><h2>Países habilitados en SINEP</h2><p className="meta">Pueden utilizarse al crear jurisdicciones y estructuras.</p></div></div>
        <div className="admin-country-grid">
          {enabledCountries.length === 0 && !loading && <AdminStatusNotice tone="empty" title="Todavía no hay países habilitados" description="Selecciona el primero desde el catálogo ISO." />}
          {enabledCountries.map((country) => (
            <article className="entity-card admin-country-card" key={country.id}>
              <div className="admin-country-heading"><span className="admin-country-flag">{flag(country)}</span><div><p className="entity-type">{country.iso2} · {country.iso3 ?? 'Sin ISO3'}</p><h2>{country.name}</h2><p className="meta">{country.official_name ?? 'Sin nombre oficial'}</p></div></div>
              <div className="role-list"><span className="role-pill">{country.status}</span><span className="role-pill">{country.visibility}</span><span className="role-pill">{publicKeys.has(country.iso2) ? 'Visible en dashboard' : 'Pendiente de jurisdicción pública'}</span></div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
