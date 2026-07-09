'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type EntityPath = {
  direct_entity_id: string
  direct_entity_name: string
  direct_entity_type_name: string | null
  hierarchy_path: string | null
}

type OfficeConfig = {
  id: string
  display_name: string
}

type SaveResponse = {
  slug?: string
  internal_reference_code?: string
  error?: string
}

const PHOTO_BUCKET = 'person-photos'

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

function buildDisplayName(form: FormData) {
  return [form.get('first_name'), form.get('middle_name'), form.get('last_name'), form.get('second_last_name')]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

function fileExtension(file: File) {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

export default function NuevoLaicoPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [savedSlug, setSavedSlug] = useState<string | null>(null)
  const [savedInternalCode, setSavedInternalCode] = useState<string | null>(null)
  const [entities, setEntities] = useState<EntityPath[]>([])
  const [officeConfigs, setOfficeConfigs] = useState<OfficeConfig[]>([])
  const [quickEntityId, setQuickEntityId] = useState('')
  const [assignmentVisibility, setAssignmentVisibility] = useState<'internal' | 'public' | 'private'>('internal')

  const quickEntity = entities.find((item) => item.direct_entity_id === quickEntityId)

  useEffect(() => {
    async function loadData() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/admin/login')
        return
      }

      const [entityRes, officeRes] = await Promise.all([
        supabase
          .from('public_entity_hierarchy_paths')
          .select('direct_entity_id,direct_entity_name,direct_entity_type_name,hierarchy_path')
          .order('direct_entity_name'),
        supabase
          .from('office_configurations')
          .select('id,display_name')
          .eq('status', 'active')
          .order('display_name'),
      ])

      if (entityRes.error || officeRes.error) {
        setError(entityRes.error?.message ?? officeRes.error?.message ?? 'No se pudieron cargar los catálogos.')
      } else {
        setEntities((entityRes.data ?? []) as EntityPath[])
        setOfficeConfigs((officeRes.data ?? []) as OfficeConfig[])
      }
      setLoading(false)
    }

    loadData()
  }, [router, supabase])

  async function uploadPhoto(file: File, slug: string) {
    if (!file || file.size === 0) return { photo_url: null, photo_path: null }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('La foto debe estar en formato JPG, PNG o WEBP.')
    if (file.size > 5 * 1024 * 1024) throw new Error('La foto no debe pasar de 5 MB.')

    const path = `laicos/${slug || 'laico'}-${Date.now()}.${fileExtension(file)}`
    const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false })
    if (uploadError) throw new Error(`No se pudo subir la foto: ${uploadError.message}`)

    const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path)
    return { photo_url: data.publicUrl, photo_path: path }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    setSavedSlug(null)
    setSavedInternalCode(null)

    const form = new FormData(event.currentTarget)
    const firstName = String(form.get('first_name') ?? '').trim()
    const lastName = String(form.get('last_name') ?? '').trim()
    const displayName = buildDisplayName(form)
    const slug = slugify(displayName)

    if (!firstName || !lastName || !displayName || !slug) {
      setError('Primer nombre y primer apellido son obligatorios.')
      setSaving(false)
      return
    }

    try {
      const photoFile = form.get('photo_file') instanceof File ? form.get('photo_file') as File : null
      const uploadedPhoto = photoFile ? await uploadPhoto(photoFile, slug) : { photo_url: null, photo_path: null }
      const payload = {
        first_name: firstName,
        middle_name: emptyToNull(form.get('middle_name')),
        last_name: lastName,
        second_last_name: emptyToNull(form.get('second_last_name')),
        display_name: displayName,
        slug,
        gender: emptyToNull(form.get('gender')),
        birth_date: emptyToNull(form.get('birth_date')),
        birth_place: emptyToNull(form.get('birth_place')),
        photo_url: uploadedPhoto.photo_url,
        photo_path: uploadedPhoto.photo_path,
        biography_public: emptyToNull(form.get('biography_public')),
        notes_internal: emptyToNull(form.get('notes_internal')),
        validation_type: emptyToNull(form.get('validation_type')),
        validation_value: emptyToNull(form.get('validation_value')),
        validation_country: emptyToNull(form.get('validation_country')),
        primary_phone: emptyToNull(form.get('primary_phone')),
        secondary_phone: emptyToNull(form.get('secondary_phone')),
        contact_email: emptyToNull(form.get('contact_email')),
        father_name: emptyToNull(form.get('father_name')),
        mother_name: emptyToNull(form.get('mother_name')),
        family_notes: emptyToNull(form.get('family_notes')),
        biography_notes: emptyToNull(form.get('biography_notes')),
        quick_office_configuration_id: emptyToNull(form.get('quick_office_configuration_id')),
        quick_title_override: emptyToNull(form.get('quick_title_override')),
        quick_entity_id: emptyToNull(form.get('quick_entity_id')),
        quick_start_date: emptyToNull(form.get('quick_start_date')),
        quick_notes_public: emptyToNull(form.get('quick_notes_public')),
        assignment_visibility: assignmentVisibility,
        not_identified_fields: form.getAll('not_identified_fields').map(String),
      }

      const response = await fetch('/api/admin/laico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json() as SaveResponse
      if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar el laico.')

      setSavedSlug(data.slug ?? payload.slug)
      setSavedInternalCode(data.internal_reference_code ?? null)
      setMessage('Laico/a creado correctamente.')
      event.currentTarget.reset()
      setQuickEntityId('')
      setAssignmentVisibility('internal')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el laico.')
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
          <p className="eyebrow">Persona laica</p>
          <h1>Registrar laico/a</h1>
          <p className="lead">Registra una persona laica con código interno LAICO, contacto privado, datos familiares y servicio pastoral o administrativo si aplica.</p>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && (
        <div className="empty-state">
          <strong>{message}</strong>
          {savedInternalCode && <span>Código interno administrativo: {savedInternalCode}</span>}
          {savedSlug && <Link href={`/personas/${savedSlug}`}>Ver ficha pública</Link>}
        </div>
      )}

      <form className="admin-form admin-config-form card dashboard-section" onSubmit={handleSubmit}>
        <section>
          <p className="eyebrow">Datos obligatorios</p>
          <h2>Identificación básica</h2>
          <input name="first_name" placeholder="Primer nombre" required />
          <input name="middle_name" placeholder="Segundo nombre, si aplica" />
          <input name="last_name" placeholder="Primer apellido" required />
          <input name="second_last_name" placeholder="Segundo apellido, si aplica" />
          <select name="gender" defaultValue="">
            <option value="">Género no indicado</option>
            <option value="male">Masculino</option>
            <option value="female">Femenino</option>
            <option value="unknown">No identificado</option>
          </select>
          <p className="meta">El sistema formará automáticamente el nombre público y asignará un código LAICO.</p>
        </section>

        <section>
          <p className="eyebrow">Validación privada</p>
          <h2>Documentos y contactos internos</h2>
          <select name="validation_type" defaultValue="">
            <option value="">Sin documento por ahora</option>
            <option value="cedula">Cédula</option>
            <option value="passport">Pasaporte</option>
            <option value="other">Otro documento</option>
          </select>
          <input name="validation_value" placeholder="Número del documento para validación interna" />
          <input name="validation_country" placeholder="País del documento" defaultValue="República Dominicana" />
          <input name="primary_phone" placeholder="Teléfono principal" />
          <input name="secondary_phone" placeholder="Teléfono alterno" />
          <input name="contact_email" type="email" placeholder="Correo de contacto" />
          <p className="meta">Estos datos son privados y no aparecen en la ficha pública.</p>
        </section>

        <section>
          <p className="eyebrow">Datos personales</p>
          <h2>Nacimiento, familia y foto</h2>
          <label>Fecha de nacimiento<input name="birth_date" type="date" /></label>
          <input name="birth_place" placeholder="Lugar de nacimiento" />
          <input name="father_name" placeholder="Nombre del padre" />
          <input name="mother_name" placeholder="Nombre de la madre" />
          <textarea name="family_notes" placeholder="Notas familiares relevantes para la biografía" />
          <textarea name="biography_notes" placeholder="Apuntes internos para preparar la biografía" />
          <textarea name="biography_public" placeholder="Biografía breve para mostrar en la ficha pública" />
          <input name="photo_file" type="file" accept="image/jpeg,image/png,image/webp" />
        </section>

        <section>
          <p className="eyebrow">Servicio o responsabilidad</p>
          <h2>Cargo o servicio actual opcional</h2>
          <p className="meta">Úsalo si la persona tiene una responsabilidad pastoral, administrativa, educativa, litúrgica o de coordinación.</p>
          <select name="quick_office_configuration_id" defaultValue="">
            <option value="">Sin cargo actual por ahora</option>
            {officeConfigs.map((office) => <option key={office.id} value={office.id}>{office.display_name}</option>)}
          </select>
          <input name="quick_title_override" placeholder="Título para mostrar" />
          <select name="quick_entity_id" value={quickEntityId} onChange={(event) => setQuickEntityId(event.target.value)}>
            <option value="">Selecciona entidad del servicio</option>
            {entities.map((entity) => <option key={entity.direct_entity_id} value={entity.direct_entity_id}>{entity.direct_entity_name} · {entity.direct_entity_type_name ?? 'Entidad'}</option>)}
          </select>
          <div className="empty-state"><strong>Entidad</strong><span>{quickEntity?.hierarchy_path ?? quickEntity?.direct_entity_name ?? 'Selecciona parroquia, capilla, curia o entidad donde sirve.'}</span></div>
          <label>Fecha de inicio<input name="quick_start_date" type="date" /></label>
          <select value={assignmentVisibility} onChange={(event) => setAssignmentVisibility(event.target.value as 'internal' | 'public' | 'private')}>
            <option value="internal">Interno: visible solo en administración</option>
            <option value="public">Público: visible en directorios</option>
            <option value="private">Privado: visible solo para control interno</option>
          </select>
          <textarea name="quick_notes_public" placeholder="Notas visibles del cargo si se publica" />
        </section>

        <section>
          <p className="eyebrow">Completitud</p>
          <h2>Datos buscados y no encontrados</h2>
          <div className="card compact-section">
            <label className="role-pill"><input type="checkbox" name="not_identified_fields" value="gender" /> Género</label>
            <label className="role-pill"><input type="checkbox" name="not_identified_fields" value="birth_date" /> Fecha de nacimiento</label>
            <label className="role-pill"><input type="checkbox" name="not_identified_fields" value="birth_place" /> Lugar de nacimiento</label>
            <label className="role-pill"><input type="checkbox" name="not_identified_fields" value="biography_public" /> Biografía pública</label>
          </div>
          <textarea name="notes_internal" placeholder="Notas internas de carga o verificación" />
        </section>

        <button className="button button-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar laico/a'}</button>
      </form>
    </main>
  )
}
