'use client'

import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  created_at: string | null
  updated_at: string | null
}

type PublicCountry = {
  key: string
  iso2: string
  name: string
  flag_emoji: string | null
  flag_image_url: string | null
}

type CatalogResponse = { countries: CatalogCountry[] }
type AdminCountriesResponse = { enabled_countries: EnabledCountry[]; public_countries: PublicCountry[]; error?: string }
type EnableCountryResponse = { country_id?: string | null; iso2?: string; error?: string }

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function countryFlag(country: { flag_emoji?: string | null; flag_image_url?: string | null; name?: string | null }) {
  if (country.flag_image_url) return <img alt={`Bandera de ${country.name ?? 'país'}`} className="admin-country-flag-image" src={country.flag_image_url} />
  return <span aria-label={`Bandera de ${country.name ?? 'país'}`} className="admin-country-flag-emoji" role="img">{country.flag_emoji ?? '▦'}</span>
}

function publicStatusLabel(country: EnabledCountry, publicKeys: Set<string>) {
  if (publicKeys.has(country.iso2)) return 'Visible en dashboard'
  return 'No visible hasta cargar jurisdicciones públicas'
}

export default function AdminPaisesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [catalog, setCatalog] = useState<CatalogCountry[]>([])
  const [enabledCountries, setEnabledCountries] = useState<EnabledCountry[]>([])
  const [publicCountries, setPublicCountries] = useState<PublicCountry[]>([])
  const [query, setQuery] = useState('')
  const [selectedIso2, setSelectedIso2] = useState('')
  const [flagImageUrl, setFlagImageUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const enabledKeys = useMemo(() => new Set(enabledCountries.map((country) => country.iso2)), [enabledCountries])
  const publicKeys = useMemo(() => new Set(publicCountries.map((country) => country.iso2 ?? country.key)), [publicCountries])

  const filteredCatalog = useMemo(() => {
    const search = normalize(query)
    const source = catalog.filter((country) => !enabledKeys.has(country.iso2))
    if (!search) return source.slice(0, 40)

    return source
      .filter((country) => {
        const haystack = normalize(`${country.name} ${country.name_en} ${country.iso2} ${country.iso3 ?? ''}`)
        return haystack.includes(search)
      })
      .slice(0, 40)
  }, [catalog, enabledKeys, query])

  const selectedCountry = catalog.find((country) => country.iso2 === selectedIso2) ?? filteredCatalog[0] ?? null

  async function loadCountries() {
    setError(null)
    const [catalogResponse, adminResponse] = await Promise.all([
      fetch('/api/catalog/countries'),
      fetch('/api/admin/paises'),
    ])

    if (!catalogResponse.ok) {
      const data = await catalogResponse.json().catch(() => null) as { error?: string } | null
      throw new Error(data?.error ?? 'No se pudo cargar el catálogo ISO.')
    }

    if (!adminResponse.ok) {
      const data = await adminResponse.json().catch(() => null) as { error?: string } | null
      throw new Error(data?.error ?? 'No se pudieron cargar los países habilitados.')
    }

    const catalogData = await catalogResponse.json() as CatalogResponse
    const adminData = await adminResponse.json() as AdminCountriesResponse

    setCatalog(catalogData.countries ?? [])
    setEnabledCountries(adminData.enabled_countries ?? [])
    setPublicCountries(adminData.public_countries ?? [])
  }

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) {
        router.replace('/admin/login')
        return
      }

      try {
        await loadCountries()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el módulo de países.')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [router])

  async function handleEnableCountry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    const iso2 = selectedCountry?.iso2 ?? selectedIso2
    if (!iso2) {
      setError('Selecciona un país del catálogo ISO.')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/admin/paises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iso2, flag_image_url: flagImageUrl }),
      })

      const data = await response.json() as EnableCountryResponse
      if (!response.ok) throw new Error(data.error ?? 'No se pudo habilitar el país.')

      setMessage(`País ${iso2} habilitado correctamente. No aparecerá en la página pública hasta tener jurisdicciones activas.`)
      setSelectedIso2('')
      setFlagImageUrl('')
      setQuery('')
      await loadCountries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo habilitar el país.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="empty-state">Cargando países...</div>

  return (
    <main className="admin-countries-page" id="top">
      <header className="admin-top-header">
        <div className="admin-top-title">
          <span className="admin-mini-mark">ISO</span>
          <strong>Países</strong>
        </div>
        <div className="admin-top-actions">
          <Link className="button button-secondary" href="/admin">Volver al panel</Link>
          <Link className="button button-primary" href="/admin/nuevo/jurisdiccion">Crear jurisdicción</Link>
        </div>
      </header>

      <section className="admin-welcome-panel">
        <div>
          <p className="eyebrow">Catálogo territorial</p>
          <h1>Países ISO</h1>
          <p className="lead">Habilita países desde listas oficiales. Un país habilitado no aparece en la página pública hasta que tenga jurisdicciones eclesiásticas públicas registradas.</p>
          <div className="role-list admin-role-list">
            <span className="role-pill">Selección desde catálogo</span>
            <span className="role-pill">Bandera automática</span>
            <span className="role-pill">Publicación condicionada</span>
          </div>
        </div>
        <div className="admin-welcome-illustration" aria-hidden="true">◎</div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box">{message}</div>}

      <section className="admin-stat-strip" aria-label="Resumen de países">
        <a href="#enabled-countries"><span>◎</span><strong>{enabledCountries.length}</strong><small>Países habilitados</small></a>
        <a href="#enabled-countries"><span>◉</span><strong>{publicCountries.length}</strong><small>Visibles públicamente</small></a>
        <a href="#country-catalog"><span>▤</span><strong>{catalog.length}</strong><small>Países en catálogo ISO</small></a>
        <a href="/admin/nuevo/jurisdiccion"><span>▥</span><strong>+</strong><small>Nueva jurisdicción</small></a>
        <a href="/admin/estructura"><span>▦</span><strong>↗</strong><small>Estructura territorial</small></a>
      </section>

      <section className="grid two-columns" id="country-catalog">
        <form className="admin-form admin-config-form card dashboard-section" onSubmit={handleEnableCountry}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Habilitar país</p>
              <h2>Seleccionar desde catálogo ISO</h2>
              <p className="meta">Busca por nombre, ISO2 o ISO3. Si el país ya existe en la lista, no se duplica.</p>
            </div>
          </div>

          <label>
            Buscar país
            <input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedIso2('') }} placeholder="Ej.: Puerto Rico, PR, PRI" />
          </label>

          <label>
            País del catálogo
            <select value={selectedIso2 || selectedCountry?.iso2 || ''} onChange={(event) => setSelectedIso2(event.target.value)}>
              {filteredCatalog.length === 0 && <option value="">No hay países disponibles</option>}
              {filteredCatalog.map((country) => (
                <option key={country.iso2} value={country.iso2}>{country.flag_emoji ?? '▦'} {country.name} · {country.iso2}/{country.iso3}</option>
              ))}
            </select>
          </label>

          {selectedCountry && (
            <div className="empty-state">
              <strong>{selectedCountry.flag_emoji ?? '▦'} {selectedCountry.name}</strong>
              <span>{selectedCountry.iso2} · {selectedCountry.iso3 ?? 'Sin ISO3'} · {selectedCountry.name_en}</span>
            </div>
          )}

          <label>
            Imagen de bandera personalizada opcional
            <input value={flagImageUrl} onChange={(event) => setFlagImageUrl(event.target.value)} placeholder="https://.../bandera.svg" type="url" />
          </label>
          <p className="meta">Si no colocas imagen, el sistema usa la bandera emoji derivada del código ISO2.</p>

          <button className="button button-primary" disabled={saving || !selectedCountry} type="submit">
            {saving ? 'Habilitando...' : 'Habilitar país'}
          </button>
        </form>

        <section className="card dashboard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Regla pública</p>
              <h2>Cuándo aparece en la página principal</h2>
              <p className="meta">La vista pública solo muestra países con al menos una jurisdicción pública activa.</p>
            </div>
          </div>
          <div className="empty-state">
            <strong>Habilitar país ≠ publicar país</strong>
            <span>Primero habilitas el país. Luego creas provincia eclesiástica, arquidiócesis, diócesis u ordinariato. Solo entonces aparece en el dashboard.</span>
          </div>
          <ul className="admin-check-list">
            <li>Catálogo ISO para evitar escritura libre.</li>
            <li>Bandera por emoji o imagen personalizada.</li>
            <li>Solo países con datos públicos salen al usuario final.</li>
          </ul>
        </section>
      </section>

      <section className="card dashboard-section" id="enabled-countries">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Países activos</p>
            <h2>Países habilitados en SINEP</h2>
            <p className="meta">Estos países pueden usarse al crear estructuras y jurisdicciones.</p>
          </div>
        </div>

        <div className="admin-country-grid">
          {enabledCountries.length === 0 && <div className="empty-state">No hay países habilitados.</div>}
          {enabledCountries.map((country) => (
            <article className="entity-card admin-country-card" key={country.id}>
              <div className="admin-country-heading">
                <span className="admin-country-flag">{countryFlag(country)}</span>
                <div>
                  <p className="entity-type">{country.iso2} · {country.iso3 ?? 'Sin ISO3'}</p>
                  <h2>{country.name}</h2>
                  <p className="meta">{country.official_name ?? 'Sin nombre oficial'}</p>
                </div>
              </div>
              <div className="role-list">
                <span className="role-pill">{country.status}</span>
                <span className="role-pill">{country.visibility}</span>
                <span className="role-pill">{publicStatusLabel(country, publicKeys)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
