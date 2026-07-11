'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type OfficeRow = {
  id: string
  key: string
  display_name: string
  description: string | null
  requires_clergy: boolean
  allowed_person_types: string[]
  required_ordination_degree: string
  allowed_clerical_statuses: string[]
  allowed_episcopal_role_types: string[]
  holder_cardinality: string
  max_current_holders: number | null
  office_scopes: { name: string } | { name: string }[] | null
  office_categories: { name: string } | { name: string }[] | null
}

type ChangeRequest = {
  id: string
  title: string
  description: string | null
  proposed_data: Record<string, unknown>
  status: string
}

type ImpactItem = {
  assignment_id: string
  person_id: string
  person_name: string
  entity_name: string
  reason_code: string
  message: string
}

type ImpactPreview = {
  current_assignments: number
  incompatible_assignments: number
  items: ImpactItem[]
}

const personTypes = [['bishop','Obispo'],['priest','Sacerdote'],['deacon','Diácono'],['religious','Vida consagrada'],['layperson','Laico/a']] as const
const statuses = [['active','Activo'],['retired','Retirado'],['emeritus','Emérito'],['suspended','Suspendido'],['restricted','Con restricciones'],['inactive','Inactivo'],['deceased','Fallecido'],['lost_clerical_state','Pérdida del estado clerical'],['unknown','No identificado']] as const
const episcopalRoles = [['diocesan','Diocesano'],['auxiliary','Auxiliar'],['coadjutor','Coadjutor'],['titular','Titular'],['emeritus','Emérito'],['apostolic_administrator','Administrador apostólico'],['apostolic_vicar','Vicario apostólico'],['apostolic_prefect','Prefecto apostólico'],['other','Otro']] as const
const categories = [['ecclesiastical','Eclesial'],['pastoral','Pastoral'],['administrative','Administrativo']] as const
const scopes = [['parish','Parroquial'],['pastoral_zone','Zona pastoral'],['diocesan','Diocesano'],['national','Nacional'],['institutional','Institucional']] as const
const degrees = [['none','Ninguno'],['diaconate','Diaconado'],['presbyterate','Presbiterado'],['episcopate','Episcopado']] as const

function selected(form: FormData, prefix: string, options: readonly (readonly [string,string])[]) {
  return options.map(([value]) => value).filter((value) => form.get(`${prefix}_${value}`) === 'on')
}

function relationName(value: { name: string } | { name: string }[] | null) {
  if (!value) return '—'
  return Array.isArray(value) ? value[0]?.name ?? '—' : value.name
}

function labelFor(options: readonly (readonly [string,string])[], value: string) {
  return options.find(([key]) => key === value)?.[1] ?? value
}

function rulesPayload(form: FormData, degree: string, cardinality: string) {
  return {
    display_name: String(form.get('display_name') ?? '').trim(),
    description: String(form.get('description') ?? '').trim() || null,
    required_ordination_degree: degree,
    allowed_person_types: selected(form,'person_type',personTypes),
    allowed_clerical_statuses: selected(form,'status',statuses),
    allowed_episcopal_role_types: selected(form,'episcopal_role',episcopalRoles),
    holder_cardinality: cardinality,
    max_current_holders: cardinality === 'multiple' ? String(form.get('max_current_holders') ?? '').trim() || null : 1,
    requires_clergy: degree !== 'none' || form.get('requires_clergy') === 'on',
  }
}

export default function OfficeConfigurationPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [offices, setOffices] = useState<OfficeRow[]>([])
  const [requests, setRequests] = useState<ChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [degree, setDegree] = useState('none')
  const [cardinality, setCardinality] = useState('single')
  const [editOffice, setEditOffice] = useState<OfficeRow | null>(null)
  const [editDegree, setEditDegree] = useState('none')
  const [editCardinality, setEditCardinality] = useState('single')
  const [impact, setImpact] = useState<ImpactPreview | null>(null)

  async function loadData() {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return router.push('/admin/login')

    const [officeRes, requestRes] = await Promise.all([
      supabase.from('office_configurations')
        .select('id,key,display_name,description,requires_clergy,allowed_person_types,required_ordination_degree,allowed_clerical_statuses,allowed_episcopal_role_types,holder_cardinality,max_current_holders,office_scopes(name),office_categories(name)')
        .eq('status','active').order('display_name'),
      supabase.from('change_requests')
        .select('id,title,description,proposed_data,status')
        .eq('target_table','office_configurations')
        .in('status',['pending_review','needs_changes'])
        .order('submitted_at',{ ascending:false, nullsFirst:false }),
    ])

    if (officeRes.error || requestRes.error) {
      setError(officeRes.error?.message ?? requestRes.error?.message ?? 'No se pudieron cargar los cargos.')
    }
    setOffices((officeRes.data ?? []) as unknown as OfficeRow[])
    setRequests((requestRes.data ?? []) as ChangeRequest[])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const intent = submitter?.value ?? 'suggest'
    const payload = {
      ...rulesPayload(form,degree,cardinality),
      key: String(form.get('key') ?? '').trim() || undefined,
      base_role_name: String(form.get('base_role_name') ?? '').trim() || undefined,
      category_key: String(form.get('category_key') ?? 'pastoral'),
      scope_key: String(form.get('scope_key') ?? 'diocesan'),
      reason: String(form.get('reason') ?? '').trim() || undefined,
      source_name: String(form.get('source_name') ?? '').trim() || undefined,
      source_url: String(form.get('source_url') ?? '').trim() || undefined,
      is_elective: form.get('is_elective') === 'on',
      is_renewable: true,
      continues_until_replaced: true,
      priority: 'normal',
      scope_type: 'other',
    }

    if (!payload.display_name) return setError('Debes indicar el nombre visible del cargo.')
    setSaving(true); setError(null); setMessage(null)
    try {
      const endpoint = intent === 'admin_create' ? '/api/admin/cargos' : '/api/admin/cargos/sugerir'
      const response = await fetch(endpoint,{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudo procesar el cargo.')
      setMessage(intent === 'admin_create' ? 'Cargo oficial guardado correctamente.' : 'Sugerencia enviada para revisión.')
      formElement.reset(); setDegree('none'); setCardinality('single'); await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo procesar el cargo.')
    } finally { setSaving(false) }
  }

  function beginEdit(office: OfficeRow) {
    setEditOffice(office)
    setEditDegree(office.required_ordination_degree)
    setEditCardinality(office.holder_cardinality)
    setImpact(null); setError(null); setMessage(null)
  }

  async function processEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editOffice) return

    const form = new FormData(event.currentTarget)
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const action: 'preview' | 'update' = submitter?.value === 'preview' ? 'preview' : 'update'
    const payload = {
      ...rulesPayload(form,editDegree,editCardinality),
      confirm_incompatible_assignments: form.get('confirm_incompatible_assignments') === 'on',
    }

    setSaving(true); setError(null); setMessage(null)
    try {
      const response = await fetch('/api/admin/cargos/editar',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ action, office_configuration_id:editOffice.id, payload }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudo evaluar el cambio.')

      if (action === 'preview') {
        setImpact(data as ImpactPreview)
        setMessage('Vista previa calculada. No se modificó ningún nombramiento.')
      } else {
        setImpact((data.impact ?? null) as ImpactPreview | null)
        setMessage('Reglas del cargo actualizadas. Los nombramientos incompatibles permanecen abiertos para revisión.')
        await loadData()
      }
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : 'No se pudo procesar la edición.')
    } finally { setSaving(false) }
  }

  async function review(id: string, decision: 'approved'|'rejected'|'needs_changes') {
    setSaving(true); setError(null)
    try {
      const response = await fetch('/api/admin/solicitudes-cambio',{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ change_request_id:id, decision }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'No se pudo revisar la solicitud.')
      setMessage(decision === 'approved' ? 'Solicitud aprobada y aplicada.' : 'Solicitud actualizada.'); await loadData()
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'No se pudo revisar la solicitud.')
    } finally { setSaving(false) }
  }

  if (loading) return <main className="container"><div className="empty-state">Cargando cargos...</div></main>

  return <main className="container dashboard-page admin-config-page">
    <div className="detail-backlink"><Link href="/admin">← Volver al panel administrativo</Link></div>
    <section className="dashboard-hero card"><div><p className="eyebrow">Configuración canónica</p><h1>Cargos y oficios</h1><p className="lead">Define quién puede ocupar cada cargo, edita sus reglas y revisa el impacto sobre nombramientos vigentes antes de guardar.</p></div></section>
    {error && <div className="error-box">{error}</div>}{message && <div className="empty-state">{message}</div>}

    {editOffice && <section className="card dashboard-section">
      <div className="section-heading"><div><p className="eyebrow">Editar cargo existente</p><h2>{editOffice.display_name}</h2><span className="meta">{editOffice.key}</span></div><button className="button button-secondary" type="button" onClick={() => { setEditOffice(null); setImpact(null) }}>Cerrar edición</button></div>
      <form key={editOffice.id} className="admin-form admin-config-form" onSubmit={processEdit}>
        <input name="display_name" defaultValue={editOffice.display_name} required />
        <textarea name="description" defaultValue={editOffice.description ?? ''} placeholder="Descripción del cargo" />
        <section className="card compact-section"><p className="eyebrow">Elegibilidad sacramental</p><h3>Grado mínimo del Orden</h3><select value={editDegree} onChange={(event) => { setEditDegree(event.target.value); setImpact(null) }}>{degrees.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select><div className="role-list">{personTypes.map(([v,l]) => <label className="role-pill" key={v}><input name={`person_type_${v}`} type="checkbox" defaultChecked={editOffice.allowed_person_types.includes(v)} onChange={() => setImpact(null)} /> {l}</label>)}</div><label className="role-pill"><input name="requires_clergy" type="checkbox" defaultChecked={editOffice.requires_clergy} onChange={() => setImpact(null)} /> Requiere clero</label></section>
        <section className="card compact-section"><p className="eyebrow">Situación canónica</p><h3>Estados admitidos</h3><div className="role-list">{statuses.map(([v,l]) => <label className="role-pill" key={v}><input name={`status_${v}`} type="checkbox" defaultChecked={editOffice.allowed_clerical_statuses.includes(v)} onChange={() => setImpact(null)} /> {l}</label>)}</div></section>
        <section className="card compact-section"><p className="eyebrow">Ministerio episcopal</p><h3>Funciones admitidas</h3><div className="role-list">{episcopalRoles.map(([v,l]) => <label className="role-pill" key={v}><input name={`episcopal_role_${v}`} type="checkbox" defaultChecked={editOffice.allowed_episcopal_role_types.includes(v)} onChange={() => setImpact(null)} /> {l}</label>)}</div></section>
        <section className="card compact-section"><p className="eyebrow">Cardinalidad</p><h3>Titulares vigentes</h3><select value={editCardinality} onChange={(event) => { setEditCardinality(event.target.value); setImpact(null) }}><option value="single">Titular único</option><option value="multiple">Varios titulares</option></select>{editCardinality === 'multiple' && <input name="max_current_holders" type="number" min="2" defaultValue={editOffice.max_current_holders ?? ''} placeholder="Máximo opcional" onChange={() => setImpact(null)} />}</section>
        <div className="actions"><button className="button button-secondary" type="submit" name="edit_action" value="preview" disabled={saving}>Previsualizar impacto</button><button className="button button-primary" type="submit" name="edit_action" value="update" disabled={saving}>Guardar cambios</button></div>
        {impact && <div className={impact.incompatible_assignments > 0 ? 'error-box' : 'empty-state'}><strong>{impact.incompatible_assignments > 0 ? `${impact.incompatible_assignments} nombramientos incompatibles` : 'Sin incompatibilidades'}</strong><span>{impact.current_assignments} nombramientos vigentes evaluados.</span>{impact.items.map((item) => <div key={item.assignment_id}><strong>{item.person_name}</strong><span>{item.entity_name} · {item.message}</span></div>)}{impact.incompatible_assignments > 0 && <label className="role-pill"><input name="confirm_incompatible_assignments" type="checkbox" /> Confirmo que las reglas cambiarán aunque estos nombramientos queden pendientes de revisión.</label>}</div>}
      </form>
    </section>}

    <section className="card dashboard-section"><div className="section-heading"><div><p className="eyebrow">Nuevo cargo</p><h2>Identidad y ámbito</h2></div></div>
      <form className="admin-form admin-config-form" onSubmit={submit}>
        <input name="display_name" placeholder="Nombre visible, ej. Párroco" required /><input name="key" placeholder="Clave opcional" /><input name="base_role_name" placeholder="Cargo base" />
        <select name="category_key" defaultValue="pastoral">{categories.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select><select name="scope_key" defaultValue="diocesan">{scopes.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select><textarea name="description" placeholder="Descripción del cargo" />
        <section className="card compact-section"><p className="eyebrow">Elegibilidad sacramental</p><h3>Grado mínimo del Orden</h3><select value={degree} onChange={(event) => setDegree(event.target.value)}>{degrees.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select><div className="role-list">{personTypes.map(([v,l]) => <label className="role-pill" key={v}><input name={`person_type_${v}`} type="checkbox" defaultChecked={degree === 'none' || v === 'priest'} /> {l}</label>)}</div><label className="role-pill"><input name="requires_clergy" type="checkbox" defaultChecked={degree !== 'none'} /> Requiere clero</label></section>
        <section className="card compact-section"><p className="eyebrow">Situación canónica</p><h3>Estados admitidos</h3><div className="role-list">{statuses.map(([v,l]) => <label className="role-pill" key={v}><input name={`status_${v}`} type="checkbox" defaultChecked={['active','retired','emeritus','unknown'].includes(v)} /> {l}</label>)}</div></section>
        <section className="card compact-section"><p className="eyebrow">Ministerio episcopal</p><h3>Funciones requeridas o admitidas</h3><div className="role-list">{episcopalRoles.map(([v,l]) => <label className="role-pill" key={v}><input name={`episcopal_role_${v}`} type="checkbox" /> {l}</label>)}</div></section>
        <section className="card compact-section"><p className="eyebrow">Cardinalidad</p><h3>Titulares vigentes</h3><select value={cardinality} onChange={(event) => setCardinality(event.target.value)}><option value="single">Titular único</option><option value="multiple">Varios titulares</option></select>{cardinality === 'multiple' && <input name="max_current_holders" type="number" min="2" placeholder="Máximo opcional" />}</section>
        <textarea name="reason" placeholder="Justificación o motivo administrativo" /><input name="source_name" placeholder="Fuente o documento" /><input name="source_url" placeholder="URL de fuente" /><label className="role-pill"><input name="is_elective" type="checkbox" /> Es electivo</label><div className="actions"><button className="button button-primary" name="intent" value="admin_create" disabled={saving}>Crear cargo oficial</button><button className="button button-secondary" name="intent" value="suggest" disabled={saving}>Sugerir para revisión</button></div>
      </form>
    </section>

    <section className="card dashboard-section"><div className="section-heading"><div><p className="eyebrow">Solicitudes</p><h2>Sugerencias pendientes</h2></div><span className="meta">{requests.length} pendientes</span></div><div className="timeline-list">{requests.length === 0 && <p className="meta">No hay sugerencias pendientes.</p>}{requests.map((request) => <div className="timeline-item" key={request.id}><strong>{request.title}</strong><span>{request.description ?? 'Sin justificación registrada'}</span><small>Cargo: {String(request.proposed_data.display_name ?? 'No indicado')} · Grado: {String(request.proposed_data.required_ordination_degree ?? 'none')}</small><div className="actions"><button className="button button-primary" onClick={() => review(request.id,'approved')} disabled={saving}>Aprobar</button><button className="button button-secondary" onClick={() => review(request.id,'needs_changes')} disabled={saving}>Pedir cambios</button><button className="button button-secondary" onClick={() => review(request.id,'rejected')} disabled={saving}>Rechazar</button></div></div>)}</div></section>

    <section className="card dashboard-section"><div className="section-heading"><div><p className="eyebrow">Catálogo oficial</p><h2>Cargos activos</h2></div><span className="meta">{offices.length} cargos</span></div><div className="table-wrap"><table><thead><tr><th>Cargo</th><th>Ámbito</th><th>Grado mínimo</th><th>Estados</th><th>Cardinalidad</th><th>Acción</th></tr></thead><tbody>{offices.map((office) => <tr key={office.id}><td data-label="Cargo"><strong>{office.display_name}</strong><br/><small className="meta">{office.key}</small></td><td data-label="Ámbito">{relationName(office.office_categories)} · {relationName(office.office_scopes)}</td><td data-label="Grado mínimo">{labelFor(degrees,office.required_ordination_degree)}</td><td data-label="Estados">{office.allowed_clerical_statuses?.map((value) => labelFor(statuses,value)).join(', ') || 'No aplica'}</td><td data-label="Cardinalidad">{office.holder_cardinality === 'single' ? 'Titular único' : `Múltiple${office.max_current_holders ? ` · máximo ${office.max_current_holders}` : ''}`}</td><td data-label="Acción"><button className="button button-secondary" type="button" onClick={() => beginEdit(office)}>Editar reglas</button></td></tr>)}</tbody></table></div></section>
  </main>
}
