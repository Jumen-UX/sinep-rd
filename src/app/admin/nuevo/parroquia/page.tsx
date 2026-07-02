'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type EntityType = { id: string; key: string; name: string }
type EntityPath = {
  direct_entity_id: string
  direct_entity_name: string
  direct_entity_slug: string
  direct_entity_type_name: string | null
  hierarchy_path: string | null
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

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function NuevaParroquiaPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [step, setStep] = useState(0)
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([])
  const [parents, setParents] = useState<EntityPath[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedParentId, setSelectedParentId] = useState('')
  const [savedSlug, setSavedSlug] = useState<string | null>(null)

  const parishType = entityTypes.find((item) => item.key === 'parish')
  const selectedParent = parents.find((item) => item.direct_entity_id === selectedParentId)

  async function loadData() {
    setError(null)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    const [typeRes, parentRes] = await Promise.all([
      supabase.from('entity_types').select('id,key,name').in('key', ['archdiocese', 'diocese', 'military_ordinariate', 'vicariate', 'pastoral_zone', 'deanery', 'pastoral_region', 'parish']).order('sort_order'),
      supabase.from('public_entity_hierarchy_paths').select('direct_entity_id,direct_entity_name,direct_entity_slug,direct_entity_type_name,hierarchy_path').order('direct_entity_name'),
    ])

    if (typeRes.error || parentRes.error) {
      setError(typeRes.error?.message ?? parentRes.error?.message ?? 'No se pudieron cargar los catálogos.')
    } else {
      setEntityTypes((typeRes.data ?? []) as EntityType[])
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
    const parentId = emptyToNull(form.get('parent_entity_id'))
    const notIdentifiedFields = form.getAll('not_identified_fields').map(String)

    if (!name) {
      setError('El nombre de la parroquia es obligatorio.')
      setSaving(false)
      return
    }

    if (!parishType) {
      setError('No se encontró el tipo de entidad Parroquia en la base de datos.')
      setSaving(false)
      return
    }

    const slug = slugInput || slugify(name)
    const { data: userData } = await supabase.auth.getUser()

    const { data: saved, error: insertError } = await supabase
      .from('ecclesiastical_entities')
      .insert({
        entity_type_id: parishType.id,
        name,
        official_name: emptyToNull(form.get('official_name')),
        slug,
        description: emptyToNull(form.get('description')),
        country: 'República Dominicana',
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
        status: 'active',
        visibility: 'public',
        created_by: userData.user?.id ?? null,
      })
      .select('id,slug')
      .single()

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    if (parentId && saved?.id) {
      const relRes = await supabase.from('entity_relationships').insert({
        parent_entity_id: parentId,
        child_entity_id: saved.id,
        relationship_type: 'territorial',
        is_current: true,
        status: 'active',
        notes: 'Relación creada desde asistente de nueva parroquia.',
        created_by: userData.user?.id ?? null,
      })
      if (relRes.error) {
        setError(relRes.error.message)
        setSaving(false)
        return
      }
    }

    if (saved?.id && notIdentifiedFields.length > 0) {
      const rows = notIdentifiedFields.map((field) => ({
        record_table: 'ecclesiastical_entities',
        record_id: saved.id,
        field_name: field,
        status: 'unknown',
        notes: 'Marcado como no identificado desde el asistente de nueva parroquia.',
        created_by: userData.user?.id ?? null,
      }))
      const statusRes = await supabase.from('data_field_statuses').upsert(rows, { onConflict: 'record_table,record_id,field_name' })
      if (statusRes.error) {
        setError(statusRes.error.message)
        setSaving(false)
        return
      }
    }

    setSavedSlug(saved?.slug ?? slug)
    setMessage('Parroquia creada correctamente.')
    setSaving(false)
  }

  if (loading) return <main className="container"><div className="empty-state">Cargando asistente...</div></main>

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink"><Link href="/admin/nuevo">← Volver a agregar nueva ficha</Link></div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Asistente paso a paso</p>
          <h1>Nueva parroquia</h1>
          <p className="lead">Crea una parroquia, enlázala a su dependencia territorial y marca desde el inicio los datos no identificados para evitar alertas innecesarias.</p>
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
            <input name="name" placeholder="Nombre: Parroquia San José" required />
            <input name="official_name" placeholder="Nombre oficial completo" />
            <input name="slug" placeholder="Slug opcional: parroquia-san-jose" />
            <textarea name="description" placeholder="Descripción pública breve" />
          </section>
        )}

        {step === 1 && (
          <section>
            <p className="eyebrow">Paso 2</p>
            <h2>Dependencia territorial</h2>
            <select name="parent_entity_id" value={selectedParentId} onChange={(event) => setSelectedParentId(event.target.value)}>
              <option value="">Sin dependencia por ahora</option>
              {parents.map((parent) => <option key={parent.direct_entity_id} value={parent.direct_entity_id}>{parent.direct_entity_name} · {parent.direct_entity_type_name ?? 'Entidad'}</option>)}
            </select>
            <div className="empty-state">
              <strong>Ruta seleccionada</strong>
              <span>{selectedParent?.hierarchy_path ?? selectedParent?.direct_entity_name ?? 'Selecciona diócesis, vicaría territorial o zona si aplica.'}</span>
            </div>
            <textarea name="territory_summary" placeholder="Territorio, sectores o comunidades que atiende" />
          </section>
        )}

        {step === 2 && (
          <section>
            <p className="eyebrow">Paso 3</p>
            <h2>Contacto y ubicación</h2>
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
            <button className="button button-primary" disabled={saving}>{saving ? 'Guardando...' : 'Crear parroquia'}</button>
          )}
        </div>
      </form>
    </main>
  )
}
