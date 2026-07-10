'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { EntityHierarchyEntity } from '@/components/admin/EntityHierarchyPicker'
import {
  loadAllowedOfficeIds,
  loadLayPersonCatalogs,
  removeLayPersonPhoto,
  saveLayPerson,
  uploadLayPersonPhoto,
  type OfficeConfig,
  type UploadedLayPersonPhoto,
} from '../services/lay-person-admin-service'

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

export default function LayPersonWizardPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [savedSlug, setSavedSlug] = useState<string | null>(null)
  const [savedInternalCode, setSavedInternalCode] = useState<string | null>(null)
  const [entities, setEntities] = useState<EntityHierarchyEntity[]>([])
  const [officeConfigs, setOfficeConfigs] = useState<OfficeConfig[]>([])
  const [allowedOfficeIds, setAllowedOfficeIds] = useState<string[]>([])
  const [officeFilterMessage, setOfficeFilterMessage] = useState('Selecciona la entidad del servicio para ver sus cargos permitidos.')
  const [quickEntityId, setQuickEntityId] = useState('')
  const [quickOfficeConfigId, setQuickOfficeConfigId] = useState('')
  const [assignmentVisibility, setAssignmentVisibility] = useState<'internal' | 'public' | 'private'>('internal')

  const quickEntity = entities.find((item) => item.direct_entity_id === quickEntityId)
  const filteredOfficeConfigs = quickEntityId
    ? officeConfigs.filter((office) => allowedOfficeIds.includes(office.id))
    : []

  useEffect(() => {
    async function loadData() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/admin/login')
        return
      }

      try {
        const catalogs = await loadLayPersonCatalogs(supabase)
        setEntities(catalogs.entities)
        setOfficeConfigs(catalogs.offices)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los catálogos.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router, supabase])

  useEffect(() => {
    async function loadOffices() {
      setAllowedOfficeIds([])
      if (!quickEntityId) {
        setOfficeFilterMessage('Selecciona la entidad del servicio para ver sus cargos permitidos.')
        return
      }

      try {
        const ids = await loadAllowedOfficeIds(supabase, quickEntityId)
        setAllowedOfficeIds(ids)
        setOfficeFilterMessage(
          ids.length > 0
            ? 'Cargos filtrados por el nivel estructural seleccionado.'
            : 'Este nivel no tiene cargos configurados. Configúralos en Administración → Estructura antes de asignar uno.',
        )
      } catch (officeError) {
        setOfficeFilterMessage(officeError instanceof Error ? officeError.message : 'No se pudieron cargar los cargos permitidos.')
      }
    }

    loadOffices()
  }, [quickEntityId, supabase])

  useEffect(() => {
    if (quickOfficeConfigId && !filteredOfficeConfigs.some((office) => office.id === quickOfficeConfigId)) {
      setQuickOfficeConfigId('')
    }
  }, [filteredOfficeConfigs, quickOfficeConfigId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setSaving(true)
    setError(null)
    setMessage(null)
    setSavedSlug(null)
    setSavedInternalCode(null)

    const form = new FormData(formElement)
    const firstName = String(form.get('first_name') ?? '').trim()
    const lastName = String(form.get('last_name') ?? '').trim()
    const displayName = buildDisplayName(form)
    const slug = slugify(displayName)

    if (!firstName || !lastName || !displayName || !slug) {
      setError('Primer nombre y primer apellido son obligatorios.')
      setSaving(false)
      return
    }

    let uploadedPhoto: UploadedLayPersonPhoto | null = null

    try {
      const photoFile = form.get('photo_file') instanceof File ? form.get('photo_file') as File : null
      uploadedPhoto = photoFile ? await uploadLayPersonPhoto(supabase, photoFile, slug) : { photo_url: null, photo_path: null }

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
        quick_office_configuration_id: quickOfficeConfigId || null,
        quick_title_override: emptyToNull(form.get('quick_title_override')),
        quick_entity_id: emptyToNull(form.get('quick_entity_id')),
        quick_start_date: emptyToNull(form.get('quick_start_date')),
        quick_notes_public: emptyToNull(form.get('quick_notes_public')),
        assignment_visibility: assignmentVisibility,
        not_identified_fields: form.getAll('not_identified_fields').map(String),
      }

      const data = await saveLayPerson(payload)
      setSavedSlug(data.slug ?? payload.slug)
      setSavedInternalCode(data.internal_reference_code ?? null)
      setMessage('Persona laica creada correctamente.')
      formElement.reset()
      setQuickEntityId('')
      setQuickOfficeConfigId('')
      setAssignmentVisibility('internal')
    } catch (saveError) {
      await removeLayPersonPhoto(supabase, uploadedPhoto?.photo_path)
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la persona laica.')
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
          <p className="eyebrow">Persona</p>
          <h1>Registrar persona laica</h1>
          <p className="lead">La condición laical se deriva de que la persona no tiene ninguna ordenación registrada. Si posteriormente recibe el diaconado, se conservará esta misma ficha y se añadirá el evento sacramental.</p>
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
          <p className="meta">El sistema formará automáticamente el nombre público. La identidad de la persona no cambiará si luego registra una ordenación.</p>
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
          <select name="quick_entity_id" value={quickEntityId} onChange={(event) => setQuickEntityId(event.target.value)}>
            <option value="">Selecciona entidad del servicio</option>
            {entities.map((entity) => <option key={entity.direct_entity_id} value={entity.direct_entity_id}>{entity.direct_entity_name} · {entity.direct_entity_type_name ?? 'Entidad'}</option>)}
          </select>
          <div className="empty-state"><strong>Entidad</strong><span>{quickEntity?.hierarchy_path ?? quickEntity?.direct_entity_name ?? 'Selecciona parroquia, capilla, curia o entidad donde sirve.'}</span></div>
          <select name="quick_office_configuration_id" value={quickOfficeConfigId} onChange={(event) => setQuickOfficeConfigId(event.target.value)} disabled={!quickEntityId || filteredOfficeConfigs.length === 0}>
            <option value="">Sin cargo actual por ahora</option>
            {filteredOfficeConfigs.map((office) => <option key={office.id} value={office.id}>{office.display_name}</option>)}
          </select>
          <p className="meta">{officeFilterMessage}</p>
          <input name="quick_title_override" placeholder="Título para mostrar" />
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

        <button className="button button-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar persona laica'}</button>
      </form>
    </main>
  )
}
