'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type EntityPath = {
  direct_entity_id: string
  direct_entity_name: string
  direct_entity_slug: string
  direct_entity_type_name: string | null
  hierarchy_path: string | null
}

type MissingField = { key: string; label: string }
type JurisdictionType = {
  key: string
  label: string
  description: string
}

const steps = ['Tipo', 'Dependencia', 'Gobierno', 'Estadísticas', 'Fuente', 'Revisión']
const jurisdictionTypes: JurisdictionType[] = [
  { key: 'ecclesiastical_province', label: 'Provincia eclesiástica', description: 'Agrupa una sede metropolitana y sus diócesis sufragáneas.' },
  { key: 'archdiocese', label: 'Arquidiócesis', description: 'Sede metropolitana o arquidiocesana.' },
  { key: 'diocese', label: 'Diócesis', description: 'Iglesia particular territorial.' },
  { key: 'military_ordinariate', label: 'Ordinariato militar', description: 'Jurisdicción personal o especial de ámbito nacional.' },
  { key: 'vicariate', label: 'Vicaría', description: 'División interna de una diócesis o arquidiócesis.' },
  { key: 'deanery', label: 'Decanato', description: 'Agrupación pastoral intermedia.' },
  { key: 'pastoral_region', label: 'Región pastoral', description: 'Región interna para coordinación pastoral.' },
  { key: 'pastoral_zone', label: 'Zona pastoral', description: 'Zona interna para organización territorial.' },
]

const optionalFields: MissingField[] = [
  { key: 'official_name', label: 'Nombre oficial' },
  { key: 'latin_name', label: 'Nombre latino' },
  { key: 'cathedral_name', label: 'Catedral o sede' },
  { key: 'current_ordinary_name', label: 'Ordinario actual' },
  { key: 'current_ordinary_title', label: 'Título del ordinario' },
  { key: 'territory_summary', label: 'Territorio' },
  { key: 'area_km2', label: 'Área' },
  { key: 'statistics_year', label: 'Año estadístico' },
  { key: 'population_total', label: 'Población' },
  { key: 'catholics_total', label: 'Católicos' },
  { key: 'catholics_percent', label: 'Porcentaje católico' },
  { key: 'parishes_count', label: 'Parroquias' },
  { key: 'source_name', label: 'Fuente' },
  { key: 'erected_at', label: 'Fecha de erección' },
]

function emptyToNull(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text.length > 0 ? text : null
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parentHelp(typeKey: string) {
  if (typeKey === 'ecclesiastical_province') return 'Selecciona el país al que pertenece.'
  if (typeKey === 'archdiocese') return 'Selecciona la provincia eclesiástica; se creará relación metropolitan_see.'
  if (typeKey === 'diocese') return 'Selecciona la provincia eclesiástica; se creará relación suffragan_see.'
  if (typeKey === 'military_ordinariate') return 'Selecciona el país; se creará relación national_jurisdiction.'
  return 'Selecciona la diócesis, arquidiócesis o división superior correspondiente.'
}

export default function NuevaJurisdiccionPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [step, setStep] = useState(0)
  const [parents, setParents] = useState<EntityPath[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [typeKey, setTypeKey] = useState('diocese')
  const [selectedParentId, setSelectedParentId] = useState('')
  const [savedSlug, setSavedSlug] = useState<string | null>(null)

  const selectedParent = parents.find((item) => item.direct_entity_id === selectedParentId)
  const selectedType = jurisdictionTypes.find((item) => item.key === typeKey)

  async function loadData() {
    setError(null)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    const parentRes = await supabase
      .from('public_entity_hierarchy_paths')
      .select('direct_entity_id,direct_entity_name,direct_entity_slug,direct_entity_type_name,hierarchy_path')
      .order('direct_entity_name')

    if (parentRes.error) {
      setError(parentRes.error.message ?? 'No se pudieron cargar las entidades superiores.')
    } else {
      setParents((parentRes.data ?? []) as EntityPath[])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    setSavedSlug(null)

    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const slugInput = String(form.get('slug') ?? '').trim()

    if (!name) {
      setError('El nombre de la jurisdicción es obligatorio.')
      setSaving(false)
      return
    }

    const payload = {
      entity_type_key: typeKey,
      name,
      official_name: emptyToNull(form.get('official_name')),
      slug: slugInput || slugify(name),
      description: emptyToNull(form.get('description')),
      country: emptyToNull(form.get('country')) ?? 'República Dominicana',
      province: emptyToNull(form.get('province')),
      municipality: emptyToNull(form.get('municipality')),
      sector: emptyToNull(form.get('sector')),
      address: emptyToNull(form.get('address')),
      email: emptyToNull(form.get('email')),
      phone: emptyToNull(form.get('phone')),
      website: emptyToNull(form.get('website')),
      latin_name: emptyToNull(form.get('latin_name')),
      cathedral_name: emptyToNull(form.get('cathedral_name')),
      current_ordinary_name: emptyToNull(form.get('current_ordinary_name')),
      current_ordinary_title: emptyToNull(form.get('current_ordinary_title')),
      territory_summary: emptyToNull(form.get('territory_summary')),
      area_km2: emptyToNull(form.get('area_km2')),
      statistics_year: emptyToNull(form.get('statistics_year')),
      population_total: emptyToNull(form.get('population_total')),
      catholics_total: emptyToNull(form.get('catholics_total')),
      catholics_percent: emptyToNull(form.get('catholics_percent')),
      parishes_count: emptyToNull(form.get('parishes_count')),
      source_name: emptyToNull(form.get('source_name')),
      source_url: emptyToNull(form.get('source_url')),
      source_checked_at: emptyToNull(form.get('source_checked_at')),
      erected_at: emptyToNull(form.get('erected_at')),
      parent_entity_id: emptyToNull(form.get('parent_entity_id')),
      not_identified_fields: form.getAll('not_identified_fields').map(String),
    }

    try {
      const response = await fetch('/api/admin/jurisdiccion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudo guardar la jurisdicción.')
      }

      setSavedSlug(data.slug ?? payload.slug)
      setMessage('Jurisdicción creada correctamente.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la jurisdicción.')
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
          <h1>Nueva jurisdicción</h1>
          <p className="lead">Crea una provincia eclesiástica, arquidiócesis, diócesis, ordinariato o división territorial interna con relación jerárquica y estadísticas iniciales.</p>
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
            <h2>Tipo e identidad</h2>
            <select name="entity_type_key" value={typeKey} onChange={(event) => setTypeKey(event.target.value)}>
              {jurisdictionTypes.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
            <div className="empty-state"><strong>{selectedType?.label}</strong><span>{selectedType?.description}</span></div>
            <input name="name" placeholder="Nombre: Diócesis de..." required />
            <input name="official_name" placeholder="Nombre oficial completo" />
            <input name="latin_name" placeholder="Nombre latino, si aplica" />
            <input name="slug" placeholder="Slug opcional" />
            <textarea name="description" placeholder="Descripción pública breve" />
          </section>
        )}

        {step === 1 && (
          <section>
            <p className="eyebrow">Paso 2</p>
            <h2>Dependencia jerárquica</h2>
            <select name="parent_entity_id" value={selectedParentId} onChange={(event) => setSelectedParentId(event.target.value)}>
              <option value="">Sin dependencia por ahora</option>
              {parents.map((parent) => <option key={parent.direct_entity_id} value={parent.direct_entity_id}>{parent.direct_entity_name} · {parent.direct_entity_type_name ?? 'Entidad'}</option>)}
            </select>
            <div className="empty-state">
              <strong>Regla sugerida</strong>
              <span>{parentHelp(typeKey)}</span>
            </div>
            <div className="empty-state">
              <strong>Ruta seleccionada</strong>
              <span>{selectedParent?.hierarchy_path ?? selectedParent?.direct_entity_name ?? 'Selecciona una entidad superior si corresponde.'}</span>
            </div>
            <textarea name="territory_summary" placeholder="Territorio, límites o zona pastoral que cubre" />
          </section>
        )}

        {step === 2 && (
          <section>
            <p className="eyebrow">Paso 3</p>
            <h2>Gobierno, sede y contacto</h2>
            <input name="current_ordinary_name" placeholder="Ordinario actual" />
            <input name="current_ordinary_title" placeholder="Título: Obispo, Arzobispo, Ordinario militar" />
            <input name="cathedral_name" placeholder="Catedral, sede o iglesia principal" />
            <label>Fecha de erección o creación<input name="erected_at" type="date" /></label>
            <input name="country" placeholder="País" defaultValue="República Dominicana" />
            <input name="province" placeholder="Provincia civil" />
            <input name="municipality" placeholder="Municipio" />
            <input name="sector" placeholder="Sector o ciudad sede" />
            <input name="address" placeholder="Dirección" />
            <input name="phone" placeholder="Teléfono" />
            <input name="email" placeholder="Correo" />
            <input name="website" placeholder="Sitio web" />
          </section>
        )}

        {step === 3 && (
          <section>
            <p className="eyebrow">Paso 4</p>
            <h2>Estadísticas iniciales</h2>
            <input name="statistics_year" placeholder="Año estadístico" type="number" min="1800" max="2100" />
            <input name="area_km2" placeholder="Área km²" type="number" step="0.01" />
            <input name="population_total" placeholder="Población total" type="number" min="0" />
            <input name="catholics_total" placeholder="Católicos" type="number" min="0" />
            <input name="catholics_percent" placeholder="% católicos" type="number" min="0" max="100" step="0.01" />
            <input name="parishes_count" placeholder="Cantidad de parroquias" type="number" min="0" />
          </section>
        )}

        {step === 4 && (
          <section>
            <p className="eyebrow">Paso 5</p>
            <h2>Fuente y datos faltantes</h2>
            <input name="source_name" placeholder="Fuente" />
            <input name="source_url" placeholder="URL de fuente" />
            <label>Fecha de revisión de fuente<input name="source_checked_at" type="date" /></label>
            <div className="card compact-section">
              <h3>Marcar como no identificado</h3>
              <p className="meta">Marca datos que se buscaron y no se pudieron identificar. No generarán alertas de completitud.</p>
              {optionalFields.map((field) => (
                <label key={field.key} className="role-pill">
                  <input type="checkbox" name="not_identified_fields" value={field.key} /> {field.label}
                </label>
              ))}
            </div>
          </section>
        )}

        {step === 5 && (
          <section>
            <p className="eyebrow">Paso 6</p>
            <h2>Revisión y guardado</h2>
            <p className="lead">Guarda la jurisdicción. El sistema creará la ficha pública y, si seleccionaste una dependencia, registrará la relación jerárquica correspondiente.</p>
          </section>
        )}

        <div className="admin-form-grid">
          <button className="button button-secondary" type="button" onClick={() => setStep(Math.max(0, step - 1))}>Anterior</button>
          {step < steps.length - 1 ? (
            <button className="button button-secondary" type="button" onClick={() => setStep(Math.min(steps.length - 1, step + 1))}>Siguiente</button>
          ) : (
            <button className="button button-primary" disabled={saving}>{saving ? 'Guardando...' : 'Crear jurisdicción'}</button>
          )}
        </div>
      </form>
    </main>
  )
}
