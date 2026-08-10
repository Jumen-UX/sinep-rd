'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import AdminModuleHeader from '@/components/admin/AdminModuleHeader'
import AdminStatusNotice from '@/components/admin/AdminStatusNotice'
import { createClient } from '@/lib/supabase/client'
import {
  applyJurisdictionCreation,
  applyJurisdictionDependencyChange,
  applyJurisdictionRestoration,
  applyJurisdictionSuppression,
  correctJurisdiction,
  loadCurrentJurisdictionTree,
  loadRestorableJurisdictions,
  previewJurisdictionCreation,
  previewJurisdictionDependencyChange,
  previewJurisdictionRestoration,
  previewJurisdictionSuppression,
  type CurrentJurisdictionTreeRow,
  type RestorableJurisdictionRow,
} from '@/features/jurisdictions/services/jurisdiction-admin-service'
import {
  applyJurisdictionHistoricalEvent,
  previewJurisdictionHistoricalEvent,
} from '@/features/jurisdictions/services/jurisdiction-history-admin-service'
import styles from './JurisdictionOrganigramEditor.module.css'

type EditorMode = 'none' | 'edit' | 'move' | 'create' | 'suppress' | 'restore' | 'history'

type PreviewState = { valid: boolean; errors?: string[]; warnings?: string[]; summary: string } | null

const relationshipTypes = [
  ['contains', 'Contiene'],
  ['metropolitan_see', 'Sede metropolitana'],
  ['suffragan_of', 'Sufragánea'],
  ['directly_subject', 'Inmediatamente sujeta'],
  ['personal_jurisdiction', 'Jurisdicción personal'],
  ['specialized_jurisdiction', 'Jurisdicción especializada'],
  ['belongs_to', 'Pertenece a'],
] as const

const jurisdictionTypes = [
  ['ecclesiastical_province', 'Provincia eclesiástica'],
  ['archdiocese', 'Arquidiócesis'],
  ['diocese', 'Diócesis'],
  ['military_ordinariate', 'Ordinariato militar'],
  ['personal_ordinariate', 'Ordinariato personal'],
  ['territorial_prelature', 'Prelatura territorial'],
  ['apostolic_vicariate', 'Vicariato apostólico'],
  ['apostolic_prefecture', 'Prefectura apostólica'],
  ['apostolic_administration', 'Administración apostólica'],
  ['eparchy', 'Eparquía'],
  ['archeparchy', 'Arcieparquía'],
  ['exarchate', 'Exarcado'],
] as const

const eventTypes = [
  ['erection', 'Erección'],
  ['elevation', 'Elevación'],
  ['official_name_change', 'Cambio oficial de nombre'],
  ['dependency_change', 'Cambio de dependencia'],
  ['division', 'División'],
  ['union', 'Unión'],
  ['suppression', 'Supresión'],
  ['restoration', 'Restauración'],
  ['territorial_change', 'Modificación territorial'],
  ['other_documented_event', 'Otro acontecimiento documentado'],
] as const

function todayIso() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function value(form: FormData, name: string) {
  return String(form.get(name) ?? '').trim()
}

function emptyToNull(text: string) {
  const clean = text.trim()
  return clean || null
}

export default function JurisdictionExplorerPage() {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<CurrentJurisdictionTreeRow[]>([])
  const [restorable, setRestorable] = useState<RestorableJurisdictionRow[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [restoreId, setRestoreId] = useState('')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<EditorMode>('none')
  const [preview, setPreview] = useState<PreviewState>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selected = rows.find((row) => row.account_id === selectedId) ?? rows[0] ?? null
  const filtered = rows.filter((row) => {
    const needle = query.trim().toLocaleLowerCase('es')
    if (!needle) return true
    return [row.name, row.official_name, row.account_type_name, row.account_code, ...row.path_names]
      .filter(Boolean)
      .some((part) => String(part).toLocaleLowerCase('es').includes(needle))
  })

  async function refresh(preferredId?: string) {
    setLoading(true)
    setError(null)
    try {
      const [tree, historical] = await Promise.all([
        loadCurrentJurisdictionTree(supabase),
        loadRestorableJurisdictions(supabase),
      ])
      setRows(tree)
      setRestorable(historical)
      setSelectedId((current) => {
        const desired = preferredId ?? current
        return tree.some((row) => row.account_id === desired) ? desired : (tree[0]?.account_id ?? '')
      })
      setRestoreId((current) => historical.some((row) => row.account_id === current) ? current : (historical[0]?.account_id ?? ''))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el organigrama.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function openEditor(next: EditorMode) {
    setPreview(null)
    setError(null)
    setSuccess(null)
    setMode(next)
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try { await action() } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'No se pudo completar la operación.')
    } finally { setBusy(false) }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const form = new FormData(event.currentTarget)
    await run(async () => {
      const result = await correctJurisdiction(supabase, selected.account_id, {
        name: value(form, 'name'),
        official_name: emptyToNull(value(form, 'official_name')),
        latin_name: emptyToNull(value(form, 'latin_name')),
        cathedral_name: emptyToNull(value(form, 'cathedral_name')),
        description: emptyToNull(value(form, 'description')),
        territory_summary: emptyToNull(value(form, 'territory_summary')),
        notes: emptyToNull(value(form, 'notes')),
      }, { reason: emptyToNull(value(form, 'reason')), expectedUpdatedAt: selected.updated_at })
      setSuccess(result.status === 'noop' ? 'No había cambios que guardar.' : `Corrección guardada y auditada (${result.changed_fields.length} campo(s)).`)
      setMode('none')
      await refresh(selected.account_id)
    })
  }

  async function submitMove(event: FormEvent<HTMLFormElement>, apply: boolean) {
    event.preventDefault()
    if (!selected) return
    const form = new FormData(event.currentTarget)
    const input = {
      childAccountId: selected.account_id,
      newParentAccountId: value(form, 'parent'),
      relationshipType: value(form, 'relationship'),
      effectiveDate: value(form, 'date'),
      reason: value(form, 'reason'),
      sourceDocumentId: emptyToNull(value(form, 'source')),
    }
    await run(async () => {
      if (!apply) {
        const result = await previewJurisdictionDependencyChange(supabase, input)
        setPreview({ valid: result.valid, errors: result.errors, warnings: result.warnings, summary: `${selected.name}: ${result.current_dependency?.parent_name ?? 'sin dependencia'} → ${result.proposed_dependency.parent_name}` })
        return
      }
      await applyJurisdictionDependencyChange(supabase, input, selected.current_edge_id)
      setSuccess('Dependencia actualizada. La relación anterior quedó conservada en el historial y la operación fue auditada.')
      setMode('none'); setPreview(null); await refresh(selected.account_id)
    })
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>, apply: boolean) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const input = {
      entityTypeKey: value(form, 'type'), name: value(form, 'name'), officialName: emptyToNull(value(form, 'official_name')),
      latinName: emptyToNull(value(form, 'latin_name')), slug: value(form, 'slug'), parentAccountId: value(form, 'parent'),
      relationshipType: value(form, 'relationship'), effectiveDate: value(form, 'date'),
      visibility: value(form, 'visibility') as 'public' | 'internal' | 'private' | 'confidential',
      reason: value(form, 'reason'), sourceDocumentId: emptyToNull(value(form, 'source')),
    }
    await run(async () => {
      if (!apply) {
        const result = await previewJurisdictionCreation(supabase, input)
        setPreview({ valid: result.valid, errors: result.errors, summary: `Crear ${result.jurisdiction.entity_type_name ?? result.jurisdiction.entity_type_key}: ${result.jurisdiction.name}` })
        return
      }
      const result = await applyJurisdictionCreation(supabase, input)
      setSuccess('Jurisdicción creada y añadida al organigrama vigente con auditoría completa.')
      setMode('none'); setPreview(null); await refresh(result.account_id)
    })
  }

  async function submitSuppress(event: FormEvent<HTMLFormElement>, apply: boolean) {
    event.preventDefault()
    if (!selected) return
    const form = new FormData(event.currentTarget)
    const input = { accountId: selected.account_id, effectiveDate: value(form, 'date'), reason: value(form, 'reason'), sourceDocumentId: emptyToNull(value(form, 'source')) }
    await run(async () => {
      if (!apply) {
        const result = await previewJurisdictionSuppression(supabase, input)
        setPreview({ valid: result.valid, errors: result.errors, warnings: result.warnings, summary: `Retirar ${selected.name} del organigrama vigente. Dependencias hijas activas: ${result.active_children_count}.` })
        return
      }
      await applyJurisdictionSuppression(supabase, input, selected.current_edge_id)
      setSuccess('Jurisdicción retirada del organigrama vigente sin borrar su registro histórico.')
      setMode('none'); setPreview(null); await refresh()
    })
  }

  async function submitRestore(event: FormEvent<HTMLFormElement>, apply: boolean) {
    event.preventDefault()
    const historic = restorable.find((item) => item.account_id === restoreId)
    if (!historic) return
    const form = new FormData(event.currentTarget)
    const input = { accountId: historic.account_id, parentAccountId: value(form, 'parent'), relationshipType: value(form, 'relationship'), effectiveDate: value(form, 'date'), reason: value(form, 'reason'), sourceDocumentId: emptyToNull(value(form, 'source')) }
    await run(async () => {
      if (!apply) {
        const result = await previewJurisdictionRestoration(supabase, input)
        setPreview({ valid: result.valid, errors: result.errors, warnings: result.warnings, summary: `Restaurar ${historic.name} bajo ${result.proposed_dependency.parent_name}.` })
        return
      }
      const result = await applyJurisdictionRestoration(supabase, input)
      setSuccess('Jurisdicción restaurada y reincorporada al organigrama vigente.')
      setMode('none'); setPreview(null); await refresh(result.account_id)
    })
  }

  async function submitHistory(event: FormEvent<HTMLFormElement>, apply: boolean) {
    event.preventDefault()
    if (!selected) return
    const form = new FormData(event.currentTarget)
    const input = { eventTypeKey: value(form, 'event_type'), effectiveDate: value(form, 'date'), publicTitle: value(form, 'title'), publicSummary: value(form, 'summary'), sourceDocumentId: value(form, 'source'), structuralAction: 'none' as const, primaryAccountId: selected.account_id }
    await run(async () => {
      if (!apply) {
        const result = await previewJurisdictionHistoricalEvent(supabase, input)
        setPreview({ valid: result.valid, errors: result.errors, summary: `${result.event_type?.name ?? 'Acontecimiento'} · ${result.title}` })
        return
      }
      await applyJurisdictionHistoricalEvent(supabase, input)
      setSuccess('Acontecimiento documentado publicado en la cronología de la jurisdicción.')
      setMode('none'); setPreview(null)
    })
  }

  return (
    <main className={styles.page}>
      <AdminModuleHeader
        badge="JUR"
        eyebrow="Organización eclesiástica vigente"
        title="Jurisdicciones"
        heading="Organigrama jurisdiccional"
        description="Administra la estructura actual desde la Santa Sede. Las correcciones se guardan directamente con auditoría; los cambios estructurales se revisan antes de confirmar."
        tags={[`${rows.length} cuentas vigentes`, `${restorable.length} históricas restaurables`]}
      />

      {error && <AdminStatusNotice tone="error" title="No se pudo completar la operación" description={error} />}
      {success && <AdminStatusNotice tone="success" title="Cambio completado" description={success} />}

      <section className={styles.toolbar} aria-label="Herramientas del organigrama">
        <label className={styles.search}><span className="sr-only">Buscar jurisdicción</span><input placeholder="Buscar por nombre, tipo, código o ruta…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <button className={`${styles.action} ${styles.actionPrimary}`} onClick={() => openEditor('create')} type="button">＋ Nueva jurisdicción</button>
      </section>

      {restorable.length > 0 && <section className={styles.restoreBar}><label>Jurisdicciones fuera del organigrama<select value={restoreId} onChange={(event) => setRestoreId(event.target.value)}>{restorable.map((item) => <option key={item.account_id} value={item.account_id}>{item.name} · {item.account_type_name}</option>)}</select></label><button className={styles.action} onClick={() => openEditor('restore')} type="button">Restaurar seleccionada</button></section>}

      <section className={styles.layout}>
        <section className={styles.tree} aria-label="Organigrama jurisdiccional vigente">
          <header className={styles.treeHeader}><strong>Organigrama actual</strong><p>Solo relaciones vigentes. La historia no altera esta vista.</p></header>
          {loading ? <div className={styles.empty}>Cargando organigrama…</div> : filtered.length === 0 ? <div className={styles.empty}>No hay coincidencias.</div> : <div className={styles.treeList}>{filtered.map((row) => <button className={`${styles.row} ${selected?.account_id === row.account_id ? styles.rowActive : ''}`} key={row.account_id} onClick={() => { setSelectedId(row.account_id); setMode('none'); setPreview(null) }} style={{ paddingLeft: `${12 + Math.min(row.depth, 7) * 18}px` }} type="button"><span className={styles.rowTop}><strong>{row.name}</strong><span className={styles.badge}>{row.account_type_name}</span></span><span className={styles.path}>{row.path_names.join(' › ')}</span></button>)}</div>}
        </section>

        <aside className={styles.inspector} aria-label="Inspector de jurisdicción">
          <header className={styles.inspectorHeader}><strong>{selected?.name ?? 'Selecciona una jurisdicción'}</strong><p>{selected ? `${selected.account_type_name} · ${selected.account_code}` : 'Selecciona un nodo del organigrama.'}</p></header>
          {selected && <div className={styles.inspectorBody}>
            <div className={styles.metaGrid}>
              <div className={styles.meta}><small>Dependencia actual</small><strong>{selected.parent_name ?? 'Raíz del organigrama'}</strong></div>
              <div className={styles.meta}><small>Estado</small><strong>{selected.canonical_status}</strong></div>
              <div className={styles.meta}><small>Relación</small><strong>{selected.relationship_type ?? 'Raíz'}</strong></div>
              <div className={styles.meta}><small>Visibilidad</small><strong>{selected.visibility}</strong></div>
            </div>
            <div className={styles.actions}>
              <button className={styles.action} onClick={() => openEditor('edit')} type="button">Editar ficha</button>
              {selected.parent_account_id && <button className={styles.action} onClick={() => openEditor('move')} type="button">Cambiar dependencia</button>}
              <button className={styles.action} onClick={() => openEditor('create')} type="button">Añadir dependiente</button>
              <button className={styles.action} onClick={() => openEditor('history')} type="button">Registrar acontecimiento</button>
              {selected.parent_account_id && <button className={`${styles.action} ${styles.actionDanger}`} onClick={() => openEditor('suppress')} type="button">Suprimir</button>}
            </div>

            {mode === 'edit' && <section className={styles.editor}><form className={styles.form} onSubmit={submitEdit}><strong>Editar información</strong><div className={styles.formGrid}><label>Nombre<input name="name" defaultValue={selected.name} required /></label><label>Nombre oficial<input name="official_name" defaultValue={selected.official_name ?? ''} /></label><label>Nombre latino<input name="latin_name" defaultValue={selected.latin_name ?? ''} /></label><label>Catedral / sede<input name="cathedral_name" defaultValue={selected.cathedral_name ?? ''} /></label></div><label>Descripción<textarea name="description" defaultValue={selected.description ?? ''} /></label><label>Resumen territorial<textarea name="territory_summary" defaultValue={selected.territory_summary ?? ''} /></label><label>Notas internas<textarea name="notes" defaultValue={selected.notes ?? ''} /></label><label>Motivo de la corrección (opcional)<input name="reason" /></label><div className={styles.formActions}><button className={styles.action} onClick={() => setMode('none')} type="button">Cancelar</button><button className={`${styles.action} ${styles.actionPrimary}`} disabled={busy} type="submit">Guardar</button></div></form></section>}

            {mode === 'move' && <StructuralForm title="Cambiar dependencia" selected={selected} rows={rows} busy={busy} preview={preview} onCancel={() => setMode('none')} onSubmit={submitMove} />}
            {mode === 'create' && <CreationForm selected={selected} rows={rows} busy={busy} preview={preview} onCancel={() => setMode('none')} onSubmit={submitCreate} />}
            {mode === 'suppress' && <SuppressionForm selected={selected} busy={busy} preview={preview} onCancel={() => setMode('none')} onSubmit={submitSuppress} />}
            {mode === 'restore' && <RestoreForm rows={rows} historic={restorable.find((item) => item.account_id === restoreId) ?? null} busy={busy} preview={preview} onCancel={() => setMode('none')} onSubmit={submitRestore} />}
            {mode === 'history' && <HistoryForm selected={selected} busy={busy} preview={preview} onCancel={() => setMode('none')} onSubmit={submitHistory} />}
          </div>}
        </aside>
      </section>
    </main>
  )
}

function Preview({ state }: { state: PreviewState }) {
  if (!state) return null
  return <div className={styles.preview}><strong className={state.valid ? styles.success : styles.error}>{state.valid ? 'Listo para confirmar' : 'Requiere corrección'}</strong><p>{state.summary}</p>{state.errors?.length ? <ul className={styles.error}>{state.errors.map((item) => <li key={item}>{item}</li>)}</ul> : null}{state.warnings?.length ? <ul>{state.warnings.map((item) => <li key={item}>{item}</li>)}</ul> : null}</div>
}

function CommonStructuralFields({ rows, defaultParent }: { rows: CurrentJurisdictionTreeRow[]; defaultParent?: string | null }) {
  return <><label>Dependencia superior<select name="parent" defaultValue={defaultParent ?? rows[0]?.account_id} required>{rows.map((row) => <option key={row.account_id} value={row.account_id}>{'— '.repeat(Math.min(row.depth, 5))}{row.name}</option>)}</select></label><label>Tipo de relación<select name="relationship" defaultValue="directly_subject">{relationshipTypes.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Fecha efectiva<input name="date" type="date" defaultValue={todayIso()} required /></label><label>ID de documento fuente (si aplica)<input name="source" placeholder="UUID del documento" /></label><label>Motivo<input name="reason" required /></label></>
}

function StructuralForm({ title, selected, rows, busy, preview, onCancel, onSubmit }: { title: string; selected: CurrentJurisdictionTreeRow; rows: CurrentJurisdictionTreeRow[]; busy: boolean; preview: PreviewState; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>, apply: boolean) => Promise<void> }) {
  return <section className={styles.editor}><form className={styles.form} onSubmit={(event) => void onSubmit(event, Boolean(preview?.valid))}><strong>{title}</strong><CommonStructuralFields rows={rows.filter((row) => row.account_id !== selected.account_id)} defaultParent={selected.parent_account_id} /><Preview state={preview} /><div className={styles.formActions}><button className={styles.action} onClick={onCancel} type="button">Cancelar</button><button className={`${styles.action} ${styles.actionPrimary}`} disabled={busy} type="submit">{preview?.valid ? 'Confirmar cambio' : 'Revisar impacto'}</button></div></form></section>
}

function CreationForm({ selected, rows, busy, preview, onCancel, onSubmit }: { selected: CurrentJurisdictionTreeRow; rows: CurrentJurisdictionTreeRow[]; busy: boolean; preview: PreviewState; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>, apply: boolean) => Promise<void> }) {
  return <section className={styles.editor}><form className={styles.form} onSubmit={(event) => void onSubmit(event, Boolean(preview?.valid))}><strong>Nueva jurisdicción</strong><div className={styles.formGrid}><label>Tipo<select name="type">{jurisdictionTypes.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Nombre<input name="name" required /></label><label>Nombre oficial<input name="official_name" /></label><label>Nombre latino<input name="latin_name" /></label><label>Slug<input name="slug" placeholder="diocesis-de-ejemplo" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label><label>Visibilidad<select name="visibility" defaultValue="internal"><option value="internal">Interna</option><option value="public">Pública</option><option value="private">Privada</option><option value="confidential">Confidencial</option></select></label></div><CommonStructuralFields rows={rows} defaultParent={selected.account_id} /><Preview state={preview} /><div className={styles.formActions}><button className={styles.action} onClick={onCancel} type="button">Cancelar</button><button className={`${styles.action} ${styles.actionPrimary}`} disabled={busy} type="submit">{preview?.valid ? 'Crear jurisdicción' : 'Revisar creación'}</button></div></form></section>
}

function SuppressionForm({ selected, busy, preview, onCancel, onSubmit }: { selected: CurrentJurisdictionTreeRow; busy: boolean; preview: PreviewState; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>, apply: boolean) => Promise<void> }) {
  return <section className={styles.editor}><form className={styles.form} onSubmit={(event) => void onSubmit(event, Boolean(preview?.valid))}><strong>Suprimir {selected.name}</strong><p>La jurisdicción saldrá del organigrama vigente, pero nunca se eliminará de la base de datos.</p><label>Fecha efectiva<input name="date" type="date" defaultValue={todayIso()} required /></label><label>Documento fuente (opcional en cambio administrativo)<input name="source" placeholder="UUID del documento" /></label><label>Motivo<input name="reason" required /></label><Preview state={preview} /><div className={styles.formActions}><button className={styles.action} onClick={onCancel} type="button">Cancelar</button><button className={`${styles.action} ${styles.actionDanger}`} disabled={busy} type="submit">{preview?.valid ? 'Confirmar supresión' : 'Revisar impacto'}</button></div></form></section>
}

function RestoreForm({ rows, historic, busy, preview, onCancel, onSubmit }: { rows: CurrentJurisdictionTreeRow[]; historic: RestorableJurisdictionRow | null; busy: boolean; preview: PreviewState; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>, apply: boolean) => Promise<void> }) {
  if (!historic) return null
  return <section className={styles.editor}><form className={styles.form} onSubmit={(event) => void onSubmit(event, Boolean(preview?.valid))}><strong>Restaurar {historic.name}</strong><CommonStructuralFields rows={rows} /><Preview state={preview} /><div className={styles.formActions}><button className={styles.action} onClick={onCancel} type="button">Cancelar</button><button className={`${styles.action} ${styles.actionPrimary}`} disabled={busy} type="submit">{preview?.valid ? 'Confirmar restauración' : 'Revisar restauración'}</button></div></form></section>
}

function HistoryForm({ selected, busy, preview, onCancel, onSubmit }: { selected: CurrentJurisdictionTreeRow; busy: boolean; preview: PreviewState; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>, apply: boolean) => Promise<void> }) {
  return <section className={styles.editor}><form className={styles.form} onSubmit={(event) => void onSubmit(event, Boolean(preview?.valid))}><strong>Registrar acontecimiento de {selected.name}</strong><label>Tipo<select name="event_type">{eventTypes.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Fecha efectiva<input name="date" type="date" defaultValue={todayIso()} required /></label><label>Título público<input name="title" required /></label><label>Resumen público<textarea name="summary" required /></label><label>ID del documento fuente<input name="source" placeholder="UUID del documento" required /></label><Preview state={preview} /><div className={styles.formActions}><button className={styles.action} onClick={onCancel} type="button">Cancelar</button><button className={`${styles.action} ${styles.actionPrimary}`} disabled={busy} type="submit">{preview?.valid ? 'Publicar acontecimiento' : 'Revisar acontecimiento'}</button></div></form></section>
}
