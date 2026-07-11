'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import StructureHierarchySelector from '@/components/StructureHierarchySelector'
import { reviewPotentialDuplicates } from '@/lib/admin/duplicateReview'
import { createClient } from '@/lib/supabase/client'

type EntityTypeRelation = { key: string; name: string }

type ParentOption = {
  id: string
  name: string
  slug: string
  country: string | null
  country_iso2: string | null
  entity_types: EntityTypeRelation[] | EntityTypeRelation | null
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

type AdminCountriesResponse = {
  enabled_countries: EnabledCountry[]
  public_countries: unknown[]
  error?: string
}

type MissingField = {
  key: string
  label: string
}

const steps = ['Identidad', 'Dependencia', 'Contacto', 'Completitud', 'Revisión']
const optionalFields: MissingField[] = [
  { key: 'official_name', label: 'Nombre oficial' },
  { key: 'address', label: 'Dirección' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'email', label: 'Correo' },
  { key: 'website', label: 'Sitio web' },
  { key: 'erected_at', label: 'Fecha de erección/creación' },
  { key: 'territory_summary', label: 'Territorio o sector pastoral' },
]

function emptyToNull(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text.length > 0 ? text : null
}

function getEntityType(parent: ParentOption) {
  if (!parent.entity_types) return null
  return Array.isArray(parent.entity_types) ? parent.entity_types[0] ?? null : parent.entity_types
}

function countryLabel(country: EnabledCountry) {
  return `${country.flag_emoji ?? '▦'} ${country.name} · ${country.iso2}${country.iso3 ? `/${country.iso3}` : ''}`
}

function parentAllowed(parent: ParentOption, countryIso2?: string | null) {
  const parentType = getEntityType(parent)
  const allowedTypes = ['archdiocese', 'diocese', 'military_ordinariate', 'vicariate', 'deanery', 'pastoral_region', 'pastoral_zone']
  const matchesType = !!parentType && allowedTypes.includes(parentType.key)
  const matchesCountry = !countryIso2 || !parent.country_iso2 || parent.country_iso2 === countryIso2
  return matchesType && matchesCountry
}

export default function NuevaParroquiaPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [step, setStep] = useState(0)
  const [parents, setParents] = useState<ParentOption[]>([])
  const [countries, setCountries] = useState<EnabledCountry[]>([])
  const [selectedCountryIso2, setSelectedCountryIso2] = useState('DO')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedParentId, setSelectedParentId] = useState('')
  const [savedSlug, setSavedSlug] = useState<string | null>(null)

  const selectedCountry = countries.find((country) => country.iso2 === selectedCountryIso2) ?? countries[0] ?? null
  const filteredParents = parents.filter((parent) => parentAllowed(parent, selectedCountry?.iso2))
  const selectedParent = filteredParents.find((item) => item.id === selectedParentId)

  async function loadData() {
    setError(null)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    const [parentRes, countriesRes] = await Promise.all([
      supabase
        .from('ecclesiastical_entities')
        .select('id,name,slug,country,country_iso2,entity_types(key,name)')
        .eq('status', 'active')
        .order('name'),
      fetch('/api/admin/paises'),
    ])

    if (parentRes.error) {
      setError(parentRes.error.message ?? 'No se pudieron cargar los catálogos.')
    } else {
      setParents((parentRes.data ?? []) as unknown as ParentOption[])
    }

    if (!countriesRes.ok) {
      const data = await countriesRes.json().catch(() => null) as { error?: string } | null
      setError(data?.error ?? 'No se pudieron cargar los países habilitados.')
    } else {
      const data = await countriesRes.json() as AdminCountriesResponse
      const loaded = data.enabled_countries ?? []
      setCountries(loaded)
      if (loaded.length > 0 && !loaded.some((country) => country.iso2 === selectedCountryIso2)) {
        setSelectedCountryIso2(loaded[0].iso2)
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedParentId && !filteredParents.some((parent) => parent.id === selectedParentId)) {
      setSelectedParentId('')
    }
  }, [filteredParents, selectedParentId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    setSavedSlug(null)

    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const fallbackParentId = emptyToNull(form.get('parent_entity_id'))
    const structureLinkedEntityId = emptyToNull(form.get('structure_linked_entity_id'))

    if (!name) {
      setError('El nombre de la parroquia es obligatorio.')
      setSaving(false)
      return
    }

    if (!selectedCountry) {
      setError('Debes seleccionar un país habilitado. Si no aparece, habilítalo primero en Admin → Países ISO.')
      setSaving(false)
      return
    }

    const payload = {
      entity_type_key: 'parish',
      name,
      official_name: emptyToNull(form.get('official_name')),
      description: emptyToNull(form.get('description')),
      country_iso2: selectedCountry.iso2,
      country: selectedCountry.name,
      province: emptyToNull(form.get('province')),
      municipality: emptyToNull(form.get('municipality')),
      sector: emptyToNull(form.get('sector')),
      address: emptyToNull(form.get('address')),
      email: emptyToNull(form.get('email')),
      phone: emptyToNull(form.get('phone')),
      website: emptyToNull(form.get('website')),
      erected_at: emptyToNull(form.get('erected_at')),
      territory_summary: emptyToNull(form.get('territory_summary')),
      source_name: emptyToNull(form.get('source_name')),
      source_url: emptyToNull(form.get('source_url')),
      source_checked_at: emptyToNull(form.get('source_checked_at')),
      parent_entity_id: fallbackParentId ?? structureLinkedEntityId,
      structure_diocese_id: emptyToNull(form.get('structure_diocese_id')),
      structure_template_id: emptyToNull(form.get('structure_template_id')),
      structure_parent_node_id: emptyToNull(form.get('structure_parent_node_id')),
      structure_parent_level_id: emptyToNull(form.get('structure_parent_level_id')),
      structure_parent_level_key: emptyToNull(form.get('structure_parent_level_key')),
      structure_parent_path: emptyToNull(form.get('structure_parent_path')),
      not_identified_fields: form.getAll('not_identified_fields').map(String),
    }

    try {
      const duplicateMatchCount = await reviewPotentialDuplicates('entity', {
        ...payload,
        scope_entity_id: payload.parent_entity_id,
      })
      const response = await fetch('/api/admin/entidad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, duplicate_review_confirmed: duplicateMatchCount > 0, duplicate_match_count: duplicateMatchCount }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudo guardar la parroquia.')
      }

      setSavedSlug(data.slug ?? null)
      setMessage('Parroquia creada correctamente. El sistema asignó la URL automáticamente.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la parroquia.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className="container"><div className="empty-state">Cargando asistente...</div></main>

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink"><Link href="/admin/nuevo">← Volver a agregar nueva ficha</Link></div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Asistente paso a paso</p>
          <h1>Nueva parroquia</h1>
          <p className="lead">Crea una parroquia, enlázala a su dependencia territorial y marca desde el inicio los datos no identificados. El país y la URL se gestionan desde catálogos del sistema.</p>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="empty-state">{message} {savedSlug && <Link href={`/entidades/${savedSlug}`}>Ver ficha pública</Link>}</div>}

      <div className="dashboard-grid dashboard-summary">
        {steps.map((label, index) => (
          <button key={label} className={`metric-card metric-button ${step === index ? 'active-filter' : ''}`} type="button" onClick={() => setStep(index)}>
            <strong>{index + 1}</strong><span>{label}</span>
          </button>
        ))}
      </div>

      <form className="admin-form admin-config-form card dashboard-section" onSubmit={handleSubmit}>
        {step === 0 && (
          <section>
            <p className="eyebrow">Paso 1</p>
            <h2>Identidad básica</h2>
            <label>
              País habilitado
              <select value={selectedCountryIso2} onChange={(event) => setSelectedCountryIso2(event.target.value)} required>
                {countries.length === 0 && <option value="">No hay países habilitados</option>}
                {countries.map((country) => <option key={country.iso2} value={country.iso2}>{countryLabel(country)}</option>)}
              </select>
            </label>
            {countries.length === 0 && <p className="meta">Primero habilita un país en <Link href="/admin/paises">Admin → Países ISO</Link>.</p>}
            {selectedCountry && <div className="empty-state"><strong>{countryLabel(selectedCountry)}</strong><span>La parroquia quedará vinculada a {selectedCountry.name} mediante ISO2.</span></div>}
            <input name="name" placeholder="Nombre: Parroquia San José" required />
            <input name="official_name" placeholder="Nombre oficial completo" />
            <div className="empty-state"><strong>URL automática</strong><span>El sistema generará internamente la dirección pública a partir del nombre y evitará duplicados.</span></div>
            <textarea name="description" placeholder="Descripción pública breve" />
          </section>
        )}

        {step === 1 && (
          <section>
            <p className="eyebrow">Paso 2</p>
            <h2>Dependencia territorial</h2>
            <StructureHierarchySelector
              countryIso2={selectedCountry?.iso2 ?? null}
              helperText="Selecciona primero la diócesis y luego la vicaría, zona pastoral o unidad donde quedará ubicada la parroquia. Si el árbol todavía no está configurado, usa el selector de respaldo."
              kind="territorial"
              label="Ubicación en la estructura de la diócesis"
              namePrefix="structure"
            />
            <div className="legacy-parent-selector">
              <label>Selector de respaldo por ficha pública
                <select name="parent_entity_id" value={selectedParentId} onChange={(event) => setSelectedParentId(event.target.value)}>
                  <option value="">Sin dependencia pública directa</option>
                  {filteredParents.map((parent) => {
                    const parentType = getEntityType(parent)
                    return <option key={parent.id} value={parent.id}>{parent.name} · {parentType?.name ?? 'Entidad'}</option>
                  })}
                </select>
              </label>
              <div className="empty-state">
                <strong>Ruta pública seleccionada</strong>
                <span>{selectedParent ? `${selectedParent.name} · ${getEntityType(selectedParent)?.name ?? 'Entidad'}` : 'Selecciona una entidad pública solo si necesitas un padre directo adicional.'}</span>
              </div>
            </div>
            <textarea name="territory_summary" placeholder="Territorio, sectores o comunidades que atiende" />
          </section>
        )}

        {step === 2 && (
          <section>
            <p className="eyebrow">Paso 3</p>
            <h2>Contacto y ubicación</h2>
            <div className="empty-state"><strong>País</strong><span>{selectedCountry?.name ?? 'Sin país seleccionado'}</span></div>
            <input name="province" placeholder="Provincia civil" />
            <input name="municipality" placeholder="Municipio" />
            <input name="sector" placeholder="Sector o comunidad" />
            <input name="address" placeholder="Dirección" />
            <input name="phone" placeholder="Teléfono" />
            <input name="email" placeholder="Correo" />
            <input name="website" placeholder="Sitio web" />
          </section>
        )}

        {step === 3 && (
          <section>
            <p className="eyebrow">Paso 4</p>
            <h2>Datos históricos y faltantes</h2>
            <label>Fecha de erección o creación<input name="erected_at" type="date" /></label>
            <input name="source_name" placeholder="Fuente" />
            <input name="source_url" placeholder="URL de fuente" />
            <label>Fecha de revisión de fuente<input name="source_checked_at" type="date" /></label>
            <div className="card compact-section">
              <h3>Marcar como no identificado</h3>
              <p className="meta">Marca los datos que se buscaron y no se pudieron identificar. No generarán alertas de completitud.</p>
              {optionalFields.map((field) => (
                <label key={field.key} className="role-pill">
                  <input type="checkbox" name="not_identified_fields" value={field.key} /> {field.label}
                </label>
              ))}
            </div>
          </section>
        )}

        {step === 4 && (
          <section>
            <p className="eyebrow">Paso 5</p>
            <h2>Revisión y guardado</h2>
            <p className="lead">Guarda la parroquia. Luego podrás completar responsables, pastorales parroquiales, fotos, horarios y documentos desde los próximos asistentes.</p>
          </section>
        )}

        <div className="admin-form-grid">
          <button className="button button-secondary" type="button" onClick={() => setStep(Math.max(0, step - 1))}>Anterior</button>
          {step < steps.length - 1 ? (
            <button className="button button-secondary" type="button" onClick={() => setStep(Math.min(steps.length - 1, step + 1))}>Siguiente</button>
          ) : (
            <button className="button button-primary" disabled={saving || !selectedCountry}>{saving ? 'Guardando...' : 'Crear parroquia'}</button>
          )}
        </div>
      </form>
    </main>
  )
}
