'use client'

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  createPersonChangeProposal,
  getAdminPersonDetail,
  getPersonCanonicalFormOptions,
  type AdminOrdinationRecord,
  type AdminPersonDetail,
  type CanonicalEntityOption,
  type OrdainerOption,
  type OrdinationDegree,
  type PersonChangeProposalInput,
} from '../services/person-admin-service'

type FormState = PersonChangeProposalInput & { description: string }

const degreeLabels: Record<OrdinationDegree, string> = {
  diaconate: 'Diaconado',
  presbyterate: 'Presbiterado',
  episcopate: 'Episcopado',
}

function personTypeLabel(value: string | null | undefined) {
  return ({
    bishop: 'Obispo',
    priest: 'Sacerdote',
    deacon: 'Diácono',
    religious: 'Religioso/a',
    layperson: 'Laico/a',
    seminarian: 'Seminarista',
  } as Record<string, string>)[value ?? ''] ?? 'Persona'
}

function currentOrdination(person: AdminPersonDetail, degree: OrdinationDegree) {
  return person.ordination_history.find((item) => item.degree === degree)
}

function ordinationForm(
  person: AdminPersonDetail,
  degree: OrdinationDegree,
): FormState['ordinations'][number] {
  const record: AdminOrdinationRecord | undefined = currentOrdination(person, degree)

  return {
    mode: 'keep',
    degree,
    ordination_date: record?.ordination_date ?? '',
    ordination_place: record?.ordination_place ?? '',
    principal_ordainer_person_id: record?.principal_ordainer_person_id ?? '',
    principal_ordainer_name: record?.principal_ordainer_name ?? '',
    assistant_ordainer_1_person_id: record?.assistant_ordainer_1_person_id ?? '',
    assistant_ordainer_1_name: record?.assistant_ordainer_1_name ?? '',
    assistant_ordainer_2_person_id: record?.assistant_ordainer_2_person_id ?? '',
    assistant_ordainer_2_name: record?.assistant_ordainer_2_name ?? '',
    source_name: record?.source_name ?? '',
    source_url: record?.source_url ?? '',
    source_checked_at: record?.source_checked_at ?? '',
    verification_status: record?.verification_status ?? 'pending_review',
    visibility: 'internal',
  }
}

function toFormState(person: AdminPersonDetail): FormState {
  const currentStatus = person.clerical_history.find(
    (item) => item.dimension_type === 'canonical_status' && item.is_current,
  )
  const currentIncardination = person.clerical_history.find(
    (item) => item.dimension_type === 'incardination' && item.is_current,
  )
  const currentRole = person.episcopal_roles[0]

  return {
    schema_version: 2,
    proposal_kind: 'canonical_person',
    identity: {
      display_name: person.display_name ?? '',
      status: person.status ?? 'active',
      birth_date: person.birth_date ?? '',
      birth_place: person.birth_place ?? '',
      death_date: person.death_date ?? '',
      biography_public: person.biography_public ?? '',
    },
    legacy_profile: {
      priest_type: person.priest_type ?? '',
      deacon_type: person.deacon_type ?? '',
    },
    ordinations: [
      ordinationForm(person, 'diaconate'),
      ordinationForm(person, 'presbyterate'),
      ordinationForm(person, 'episcopate'),
    ],
    canonical_status: {
      mode: 'keep',
      status_type: person.canonical_status ?? currentStatus?.dimension_key ?? 'active',
      start_date: currentStatus?.start_date ?? '',
      end_date: '',
      reason: currentStatus?.detail_text ?? '',
      source_name: '',
      source_url: '',
      source_checked_at: '',
      verification_status: 'pending_review',
      visibility: 'internal',
    },
    incardination: {
      mode: 'keep',
      incardination_entity_id: person.incardination_entity_id ?? currentIncardination?.related_entity_id ?? '',
      institute_name: person.incardination_institute_name ?? '',
      incardination_kind: person.incardination_kind ?? currentIncardination?.dimension_key ?? 'diocesan',
      acquisition_method: 'unknown',
      start_date: currentIncardination?.start_date ?? '',
      end_date: '',
      end_reason: 'cessation',
      source_name: '',
      source_url: '',
      source_checked_at: '',
      verification_status: 'pending_review',
      visibility: 'internal',
    },
    religious_life: {
      mode: 'keep',
      religious_life_type: person.religious_life_type ?? 'other',
      community_name: person.religious_community_name ?? person.religious_institute_name ?? '',
      province_name: person.religious_province_name ?? '',
      profession_date: person.religious_profession_date ?? '',
      canonical_status: person.religious_canonical_status ?? 'active',
    },
    episcopal_role: {
      mode: 'keep',
      role_type: currentRole?.role_type ?? 'titular',
      jurisdiction_entity_id: currentRole?.jurisdiction_entity_id ?? '',
      title_see_name: currentRole?.title_see_name ?? '',
      start_date: currentRole?.start_date ?? '',
      end_date: '',
      has_right_of_succession: currentRole?.has_right_of_succession ?? false,
      source_name: '',
      source_url: '',
      source_checked_at: '',
      verification_status: 'pending_review',
      visibility: 'public',
    },
    dignities: [{
      mode: 'keep',
      dignity_type: person.ecclesiastical_dignities[0]?.dignity_type ?? 'monsignor',
      title_text: person.ecclesiastical_dignities[0]?.title_text ?? '',
      start_date: person.ecclesiastical_dignities[0]?.start_date ?? '',
      end_date: '',
      source_name: '',
      source_url: '',
      source_checked_at: '',
      verification_status: 'pending_review',
      visibility: 'public',
    }],
    description: '',
  }
}

function validateForm(form: FormState) {
  if (!form.identity.display_name.trim()) return 'El nombre visible es obligatorio.'
  if (!form.description.trim()) return 'Debes indicar la justificación o fuente del cambio.'
  if (form.identity.status === 'deceased' && !form.identity.death_date) {
    return 'Para marcar a la persona como fallecida debes indicar la fecha de fallecimiento.'
  }
  if (form.canonical_status.mode === 'set' && !form.canonical_status.status_type) {
    return 'Selecciona el nuevo estado canónico.'
  }
  if (
    form.incardination.mode === 'set'
    && !form.incardination.incardination_entity_id
    && !form.incardination.institute_name.trim()
  ) {
    return 'La nueva incardinación requiere una entidad o un instituto.'
  }
  if (form.religious_life.mode === 'set' && !form.religious_life.religious_life_type) {
    return 'Selecciona el tipo de vida consagrada.'
  }
  if (form.episcopal_role.mode === 'set' && !form.episcopal_role.role_type) {
    return 'Selecciona la función episcopal.'
  }

  const dignity = form.dignities[0]
  if (dignity.mode !== 'keep' && !dignity.dignity_type) {
    return 'Selecciona la dignidad que deseas registrar o cerrar.'
  }

  return null
}

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="card admin-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p className="meta">{description}</p>
        </div>
      </div>
      <div className="auth-form access-form">{children}</div>
    </section>
  )
}

function EntitySelect({
  value,
  onChange,
  options,
  emptyLabel,
}: {
  value: string
  onChange: (value: string) => void
  options: CanonicalEntityOption[]
  emptyLabel: string
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{emptyLabel}</option>
      {options.map((entity) => (
        <option key={entity.id} value={entity.id}>
          {entity.name}{entity.entity_type_key ? ` · ${entity.entity_type_key}` : ''}
        </option>
      ))}
    </select>
  )
}

function OrdainerSelect({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: OrdainerOption[]
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">No vinculado / nombre externo</option>
      {options.map((person) => (
        <option key={person.id} value={person.id}>{person.display_name}</option>
      ))}
    </select>
  )
}

export default function EditPersonProposalPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [person, setPerson] = useState<AdminPersonDetail | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [entities, setEntities] = useState<CanonicalEntityOption[]>([])
  const [ordainers, setOrdainers] = useState<OrdainerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data, error: authError } = await supabase.auth.getUser()
      if (authError || !data.user) {
        router.replace('/admin/login')
        return
      }

      try {
        const [detail, options] = await Promise.all([
          getAdminPersonDetail(supabase, params.id),
          getPersonCanonicalFormOptions(supabase),
        ])
        if (!detail) throw new Error('No tienes acceso a esta persona o no existe.')
        if (!detail.can_update_proposal) {
          throw new Error('No tienes permiso para proponer cambios sobre esta persona.')
        }

        setPerson(detail)
        setForm(toFormState(detail))
        setEntities(options.entities)
        setOrdainers(options.ordainers)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la ficha.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [params.id, router])

  const effectiveType = useMemo(
    () => personTypeLabel(person?.effective_person_type ?? person?.person_type),
    [person],
  )

  function updateIdentity(field: keyof FormState['identity'], value: string) {
    setForm((current) => current
      ? { ...current, identity: { ...current.identity, [field]: value } as FormState['identity'] }
      : current)
  }

  function updateLegacy(field: keyof FormState['legacy_profile'], value: string) {
    setForm((current) => current
      ? { ...current, legacy_profile: { ...current.legacy_profile, [field]: value } as FormState['legacy_profile'] }
      : current)
  }

  function updateOrdination(
    index: number,
    field: keyof FormState['ordinations'][number],
    value: string,
  ) {
    setForm((current) => {
      if (!current) return current
      const ordinations = current.ordinations.map((item, itemIndex) => (
        itemIndex === index ? { ...item, [field]: value } as FormState['ordinations'][number] : item
      ))
      return { ...current, ordinations }
    })
  }

  function updateCanonicalStatus(
    field: keyof FormState['canonical_status'],
    value: string,
  ) {
    setForm((current) => current
      ? { ...current, canonical_status: { ...current.canonical_status, [field]: value } as FormState['canonical_status'] }
      : current)
  }

  function updateIncardination(
    field: keyof FormState['incardination'],
    value: string,
  ) {
    setForm((current) => current
      ? { ...current, incardination: { ...current.incardination, [field]: value } as FormState['incardination'] }
      : current)
  }

  function updateReligiousLife(
    field: keyof FormState['religious_life'],
    value: string,
  ) {
    setForm((current) => current
      ? { ...current, religious_life: { ...current.religious_life, [field]: value } as FormState['religious_life'] }
      : current)
  }

  function updateEpiscopalRole(
    field: keyof FormState['episcopal_role'],
    value: string | boolean,
  ) {
    setForm((current) => current
      ? { ...current, episcopal_role: { ...current.episcopal_role, [field]: value } as FormState['episcopal_role'] }
      : current)
  }

  function updateDignity(
    field: keyof FormState['dignities'][number],
    value: string,
  ) {
    setForm((current) => {
      if (!current) return current
      return { ...current, dignities: [{ ...current.dignities[0], [field]: value } as FormState['dignities'][number]] }
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) return

    const validationError = validateForm(form)
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      const { description, ...proposedData } = form
      const changeId = await createPersonChangeProposal(
        createClient(),
        params.id,
        proposedData,
        description,
      )
      setNotice(
        changeId
          ? `Propuesta canónica enviada. Solicitud: ${changeId}`
          : 'Propuesta canónica enviada correctamente.',
      )
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo enviar la propuesta.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <main className="container"><div className="empty-state">Cargando formulario canónico...</div></main>
  }

  if (error && !form) {
    return (
      <main className="container dashboard-page">
        <div className="detail-backlink"><Link href="/admin/personas">← Volver a personas</Link></div>
        <div className="error-box">{error}</div>
      </main>
    )
  }

  if (!form || !person) return null

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink">
        <Link href={`/admin/personas/${params.id}`}>← Volver a la ficha</Link>
      </div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Propuesta canónica de cambio</p>
          <h1>{person.display_name ?? 'Persona sin nombre'}</h1>
          <p className="lead">
            {effectiveType} · una sola identidad con historiales sacramentales,
            canónicos y ministeriales independientes.
          </p>
        </div>
      </section>

      <div className="info-box">
        El grado del Orden se deriva de las ordenaciones registradas. Este formulario no
        modifica manualmente el tipo de persona ni convierte cargos o dignidades en grados sacramentales.
      </div>

      {error && <div className="error-box">{error}</div>}
      {notice && <div className="success-box">{notice}</div>}

      <form onSubmit={handleSubmit}>
        <Section eyebrow="Identidad" title="Datos personales" description="Estos datos pertenecen a la persona y no determinan su grado del Orden.">
          <label>Nombre visible<input required value={form.identity.display_name} onChange={(event) => updateIdentity('display_name', event.target.value)} /></label>
          <label>Estado vital o administrativo<select value={form.identity.status} onChange={(event) => updateIdentity('status', event.target.value)}><option value="active">Activo/a</option><option value="retired">Retirado/a</option><option value="emeritus">Emérito/a</option><option value="transferred">Trasladado/a</option><option value="inactive">Inactivo/a</option><option value="suspended">Suspendido/a</option><option value="deceased">Fallecido/a</option><option value="unknown">No identificado</option></select></label>
          <label>Fecha de nacimiento<input type="date" value={form.identity.birth_date} onChange={(event) => updateIdentity('birth_date', event.target.value)} /></label>
          <label>Lugar de nacimiento<input value={form.identity.birth_place} onChange={(event) => updateIdentity('birth_place', event.target.value)} /></label>
          <label>Fecha de fallecimiento<input type="date" value={form.identity.death_date} onChange={(event) => updateIdentity('death_date', event.target.value)} /></label>
          <label>Biografía pública<textarea rows={5} value={form.identity.biography_public} onChange={(event) => updateIdentity('biography_public', event.target.value)} /></label>
        </Section>

        <Section eyebrow="Sacramento" title="Grados del Orden" description="Registrar o corregir diaconado, presbiterado y episcopado sin crear otra persona.">
          {form.ordinations.map((ordination, index) => (
            <div className="card admin-section" key={ordination.degree}>
              <div className="section-heading"><div><h3>{degreeLabels[ordination.degree]}</h3><p className="meta">{currentOrdination(person, ordination.degree) ? 'Existe un registro vigente.' : 'Todavía no existe un registro para este grado.'}</p></div></div>
              <label>Acción<select value={ordination.mode} onChange={(event) => updateOrdination(index, 'mode', event.target.value)}><option value="keep">Conservar sin cambios</option><option value="set">Registrar o actualizar</option></select></label>
              {ordination.mode === 'set' && <>
                <label>Fecha<input type="date" value={ordination.ordination_date} onChange={(event) => updateOrdination(index, 'ordination_date', event.target.value)} /></label>
                <label>Lugar<input value={ordination.ordination_place} onChange={(event) => updateOrdination(index, 'ordination_place', event.target.value)} /></label>
                <label>Ordenante principal registrado<OrdainerSelect value={ordination.principal_ordainer_person_id} onChange={(value) => updateOrdination(index, 'principal_ordainer_person_id', value)} options={ordainers} /></label>
                <label>Nombre externo del ordenante principal<input value={ordination.principal_ordainer_name} onChange={(event) => updateOrdination(index, 'principal_ordainer_name', event.target.value)} /></label>
                <label>Primer ordenante asistente<OrdainerSelect value={ordination.assistant_ordainer_1_person_id} onChange={(value) => updateOrdination(index, 'assistant_ordainer_1_person_id', value)} options={ordainers} /></label>
                <label>Nombre externo del primer asistente<input value={ordination.assistant_ordainer_1_name} onChange={(event) => updateOrdination(index, 'assistant_ordainer_1_name', event.target.value)} /></label>
                <label>Segundo ordenante asistente<OrdainerSelect value={ordination.assistant_ordainer_2_person_id} onChange={(value) => updateOrdination(index, 'assistant_ordainer_2_person_id', value)} options={ordainers} /></label>
                <label>Nombre externo del segundo asistente<input value={ordination.assistant_ordainer_2_name} onChange={(event) => updateOrdination(index, 'assistant_ordainer_2_name', event.target.value)} /></label>
                <label>Fuente<input value={ordination.source_name} onChange={(event) => updateOrdination(index, 'source_name', event.target.value)} /></label>
                <label>Enlace de la fuente<input type="url" value={ordination.source_url} onChange={(event) => updateOrdination(index, 'source_url', event.target.value)} /></label>
                <label>Fecha de consulta<input type="date" value={ordination.source_checked_at} onChange={(event) => updateOrdination(index, 'source_checked_at', event.target.value)} /></label>
                <label>Verificación<select value={ordination.verification_status} onChange={(event) => updateOrdination(index, 'verification_status', event.target.value)}><option value="pending_review">Pendiente de revisión</option><option value="verified">Verificado</option><option value="disputed">En disputa</option><option value="rejected">Rechazado</option></select></label>
              </>}
            </div>
          ))}
          <label>Tipo de diácono<select value={form.legacy_profile.deacon_type} onChange={(event) => updateLegacy('deacon_type', event.target.value)}><option value="">No aplica / no identificado</option><option value="permanent">Permanente</option><option value="transitional">Transitorio</option><option value="external">Externo</option></select></label>
          <label>Vinculación presbiteral<select value={form.legacy_profile.priest_type} onChange={(event) => updateLegacy('priest_type', event.target.value)}><option value="">No aplica / no identificada</option><option value="diocesan">Diocesano</option><option value="religious">Religioso</option></select></label>
        </Section>

        <Section eyebrow="Situación canónica" title="Estado clerical vigente" description="Una nueva vigencia cierra la anterior; cerrar no elimina el historial.">
          <label>Acción<select value={form.canonical_status.mode} onChange={(event) => updateCanonicalStatus('mode', event.target.value)}><option value="keep">Conservar sin cambios</option><option value="set">Registrar nuevo estado vigente</option><option value="close">Cerrar el estado vigente sin reemplazo</option></select></label>
          {form.canonical_status.mode !== 'keep' && <>
            {form.canonical_status.mode === 'set' && <><label>Nuevo estado<select value={form.canonical_status.status_type} onChange={(event) => updateCanonicalStatus('status_type', event.target.value)}><option value="active">Activo</option><option value="retired">Retirado</option><option value="emeritus">Emérito</option><option value="suspended">Suspendido</option><option value="restricted">Restringido</option><option value="inactive">Inactivo</option><option value="deceased">Fallecido</option><option value="lost_clerical_state">Pérdida del estado clerical</option><option value="unknown">No identificado</option></select></label><label>Inicio de vigencia<input type="date" value={form.canonical_status.start_date} onChange={(event) => updateCanonicalStatus('start_date', event.target.value)} /></label></>}
            {form.canonical_status.mode === 'close' && <label>Fecha de cierre<input type="date" value={form.canonical_status.end_date} onChange={(event) => updateCanonicalStatus('end_date', event.target.value)} /></label>}
            <label>Motivo<textarea rows={3} value={form.canonical_status.reason} onChange={(event) => updateCanonicalStatus('reason', event.target.value)} /></label>
            <label>Fuente<input value={form.canonical_status.source_name} onChange={(event) => updateCanonicalStatus('source_name', event.target.value)} /></label>
            <label>Enlace de la fuente<input type="url" value={form.canonical_status.source_url} onChange={(event) => updateCanonicalStatus('source_url', event.target.value)} /></label>
          </>}
        </Section>

        <Section eyebrow="Pertenencia clerical" title="Incardinación" description="La nueva incardinación cierra la vigente, pero un servicio temporal no debe registrarse aquí.">
          <label>Acción<select value={form.incardination.mode} onChange={(event) => updateIncardination('mode', event.target.value)}><option value="keep">Conservar sin cambios</option><option value="set">Registrar nueva incardinación</option><option value="close">Cerrar la incardinación vigente</option></select></label>
          {form.incardination.mode === 'set' && <>
            <label>Tipo<select value={form.incardination.incardination_kind} onChange={(event) => updateIncardination('incardination_kind', event.target.value)}><option value="diocesan">Iglesia particular / diócesis</option><option value="religious_institute">Instituto religioso</option><option value="society_apostolic_life">Sociedad de vida apostólica</option><option value="personal_prelature">Prelatura personal</option><option value="military_ordinariate">Ordinariato militar</option><option value="other">Otro</option><option value="unknown">No identificado</option></select></label>
            <label>Entidad eclesiástica<EntitySelect value={form.incardination.incardination_entity_id} onChange={(value) => updateIncardination('incardination_entity_id', value)} options={entities} emptyLabel="Selecciona una entidad o usa el instituto" /></label>
            <label>Instituto o entidad no catalogada<input value={form.incardination.institute_name} onChange={(event) => updateIncardination('institute_name', event.target.value)} /></label>
            <label>Método de adquisición<select value={form.incardination.acquisition_method} onChange={(event) => updateIncardination('acquisition_method', event.target.value)}><option value="ordination">Ordenación</option><option value="incardination">Decreto de incardinación</option><option value="transfer">Traslado</option><option value="profession">Profesión</option><option value="reception">Recepción</option><option value="unknown">No identificado</option></select></label>
            <label>Inicio<input type="date" value={form.incardination.start_date} onChange={(event) => updateIncardination('start_date', event.target.value)} /></label>
            <label>Fuente<input value={form.incardination.source_name} onChange={(event) => updateIncardination('source_name', event.target.value)} /></label>
            <label>Enlace de la fuente<input type="url" value={form.incardination.source_url} onChange={(event) => updateIncardination('source_url', event.target.value)} /></label>
          </>}
          {form.incardination.mode === 'close' && <><label>Fecha de cierre<input type="date" value={form.incardination.end_date} onChange={(event) => updateIncardination('end_date', event.target.value)} /></label><label>Motivo<select value={form.incardination.end_reason} onChange={(event) => updateIncardination('end_reason', event.target.value)}><option value="excardination">Excardinación</option><option value="transfer">Traslado</option><option value="death">Fallecimiento</option><option value="lost_clerical_state">Pérdida del estado clerical</option><option value="cessation">Cese</option><option value="unknown">No identificado</option></select></label></>}
        </Section>

        <Section eyebrow="Dimensión transversal" title="Vida consagrada" description="Puede coexistir con el diaconado, presbiterado o episcopado.">
          <label>Acción<select value={form.religious_life.mode} onChange={(event) => updateReligiousLife('mode', event.target.value)}><option value="keep">Conservar sin cambios</option><option value="set">Registrar o actualizar</option></select></label>
          {form.religious_life.mode === 'set' && <><label>Tipo<select value={form.religious_life.religious_life_type} onChange={(event) => updateReligiousLife('religious_life_type', event.target.value)}><option value="brother">Hermano religioso</option><option value="sister">Hermana religiosa</option><option value="consecrated_lay">Laico/a consagrado/a</option><option value="other">Otro</option></select></label><label>Instituto o comunidad<input value={form.religious_life.community_name} onChange={(event) => updateReligiousLife('community_name', event.target.value)} /></label><label>Provincia religiosa<input value={form.religious_life.province_name} onChange={(event) => updateReligiousLife('province_name', event.target.value)} /></label><label>Fecha de profesión<input type="date" value={form.religious_life.profession_date} onChange={(event) => updateReligiousLife('profession_date', event.target.value)} /></label><label>Estado<select value={form.religious_life.canonical_status} onChange={(event) => updateReligiousLife('canonical_status', event.target.value)}><option value="active">Activo</option><option value="retired">Retirado</option><option value="transferred">Trasladado</option><option value="deceased">Fallecido</option><option value="unknown">No identificado</option></select></label></>}
        </Section>

        <Section eyebrow="Episcopado" title="Función episcopal" description="La función respecto de una sede o jurisdicción no constituye otro grado del Orden.">
          <label>Acción<select value={form.episcopal_role.mode} onChange={(event) => updateEpiscopalRole('mode', event.target.value)}><option value="keep">Conservar sin cambios</option><option value="set">Registrar nueva función</option><option value="close_all">Cerrar todas las funciones vigentes</option></select></label>
          {form.episcopal_role.mode === 'set' && <><label>Función<select value={form.episcopal_role.role_type} onChange={(event) => updateEpiscopalRole('role_type', event.target.value)}><option value="diocesan">Obispo diocesano</option><option value="auxiliary">Obispo auxiliar</option><option value="coadjutor">Obispo coadjutor</option><option value="titular">Obispo titular</option><option value="emeritus">Obispo emérito</option><option value="apostolic_administrator">Administrador apostólico</option><option value="apostolic_vicar">Vicario apostólico</option><option value="apostolic_prefect">Prefecto apostólico</option><option value="other">Otra</option></select></label><label>Jurisdicción<EntitySelect value={form.episcopal_role.jurisdiction_entity_id} onChange={(value) => updateEpiscopalRole('jurisdiction_entity_id', value)} options={entities} emptyLabel="Sin jurisdicción vinculada" /></label><label>Sede titular<input value={form.episcopal_role.title_see_name} onChange={(event) => updateEpiscopalRole('title_see_name', event.target.value)} /></label><label>Inicio<input type="date" value={form.episcopal_role.start_date} onChange={(event) => updateEpiscopalRole('start_date', event.target.value)} /></label><label><input type="checkbox" checked={form.episcopal_role.has_right_of_succession} onChange={(event) => updateEpiscopalRole('has_right_of_succession', event.target.checked)} />Derecho de sucesión</label><label>Fuente<input value={form.episcopal_role.source_name} onChange={(event) => updateEpiscopalRole('source_name', event.target.value)} /></label><label>Enlace de la fuente<input type="url" value={form.episcopal_role.source_url} onChange={(event) => updateEpiscopalRole('source_url', event.target.value)} /></label></>}
          {form.episcopal_role.mode === 'close_all' && <label>Fecha de cierre<input type="date" value={form.episcopal_role.end_date} onChange={(event) => updateEpiscopalRole('end_date', event.target.value)} /></label>}
        </Section>

        <Section eyebrow="Títulos" title="Dignidades eclesiásticas" description="Arzobispo, metropolitano, cardenal o monseñor no son nuevos grados sacramentales.">
          <p className="meta">Vigentes: {person.ecclesiastical_dignities.length ? person.ecclesiastical_dignities.map((item) => item.title_text ?? item.dignity_type).join(', ') : 'ninguna registrada'}</p>
          <label>Acción<select value={form.dignities[0].mode} onChange={(event) => updateDignity('mode', event.target.value)}><option value="keep">No proponer cambios</option><option value="set">Registrar o actualizar una dignidad</option><option value="close">Cerrar una dignidad vigente</option></select></label>
          {form.dignities[0].mode !== 'keep' && <><label>Dignidad<select value={form.dignities[0].dignity_type} onChange={(event) => updateDignity('dignity_type', event.target.value)}><option value="archbishop">Arzobispo</option><option value="metropolitan">Metropolitano</option><option value="cardinal">Cardenal</option><option value="monsignor">Monseñor</option><option value="patriarch">Patriarca</option><option value="major_archbishop">Arzobispo mayor</option><option value="other">Otra</option></select></label>{form.dignities[0].mode === 'set' && <><label>Título visible<input value={form.dignities[0].title_text} onChange={(event) => updateDignity('title_text', event.target.value)} /></label><label>Inicio<input type="date" value={form.dignities[0].start_date} onChange={(event) => updateDignity('start_date', event.target.value)} /></label><label>Fuente<input value={form.dignities[0].source_name} onChange={(event) => updateDignity('source_name', event.target.value)} /></label><label>Enlace de la fuente<input type="url" value={form.dignities[0].source_url} onChange={(event) => updateDignity('source_url', event.target.value)} /></label></>}{form.dignities[0].mode === 'close' && <label>Fecha de cierre<input type="date" value={form.dignities[0].end_date} onChange={(event) => updateDignity('end_date', event.target.value)} /></label>}</>}
        </Section>

        <section className="card admin-section">
          <label>Justificación y fuente general de la propuesta<textarea required rows={5} value={form.description} onChange={(event) => setForm((current) => current ? { ...current, description: event.target.value } : current)} placeholder="Indica el documento, decreto, directorio o razón administrativa que respalda los cambios." /></label>
          <div className="admin-actions"><button className="button button-primary" disabled={saving} type="submit">{saving ? 'Enviando...' : 'Enviar propuesta canónica'}</button><Link className="button button-secondary" href={`/admin/personas/${params.id}`}>Cancelar</Link></div>
        </section>
      </form>
    </main>
  )
}
