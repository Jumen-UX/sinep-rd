'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type StructureKindKey = 'territorial' | 'pastoral' | 'administrative' | 'organic'

type Diocese = {
  id: string
  name: string
  slug: string
}

type StructureTemplate = {
  id: string
  diocese_id: string
  kind_key: StructureKindKey
  key: string
  name: string
  is_primary: boolean
  status: string
}

type StructureLevel = {
  id: string
  level_key: string
  name: string
  plural_name: string | null
  level_order: number
  parent_level_id: string | null
  scope: string
}

type OfficeConfiguration = {
  id: string
  key: string
  display_name: string
  organization_chart_id: string | null
}

type LevelOfficeConfiguration = {
  id: string
  level_id: string
  office_configuration_id: string
  sort_order: number | null
  status: string
}

const kindOptions: Array<{ key: StructureKindKey; label: string }> = [
  { key: 'territorial', label: 'Territorial' },
  { key: 'pastoral', label: 'Pastoral' },
  { key: 'administrative', label: 'Administrativa' },
  { key: 'organic', label: 'Orgánica' },
]

const pageStyles = `
  .level-office-grid { display: grid; gap: 16px; grid-template-columns: minmax(260px, 0.9fr) minmax(0, 1.1fr); }
  .level-office-toolbar { display: grid; gap: 12px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .level-office-list { display: grid; gap: 10px; }
  .level-office-row { align-items: center; border: 1px solid var(--border); border-radius: 14px; display: grid; gap: 10px; grid-template-columns: auto 1fr; padding: 12px; }
  .level-office-row strong { display: block; }
  .level-office-row span { color: var(--muted); font-size: 13px; }
  .level-office-summary { background: #fbf8f1; border: 1px solid var(--border); border-radius: 16px; display: grid; gap: 8px; padding: 14px; }
  @media (max-width: 900px) { .level-office-grid, .level-office-toolbar { grid-template-columns: 1fr; } }
`

function isDioceseLike(name: string) {
  return /di[oó]cesis|arquidi[oó]cesis|ordinariato|vicariato apost[oó]lico/i.test(name)
}

function levelLabel(level: StructureLevel) {
  return `Nivel ${level.level_order + 1} · ${level.name}`
}

export default function AdminCargosPorNivelPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [dioceses, setDioceses] = useState<Diocese[]>([])
  const [templates, setTemplates] = useState<StructureTemplate[]>([])
  const [levels, setLevels] = useState<StructureLevel[]>([])
  const [offices, setOffices] = useState<OfficeConfiguration[]>([])
  const [relations, setRelations] = useState<LevelOfficeConfiguration[]>([])
  const [selectedDioceseId, setSelectedDioceseId] = useState('')
  const [selectedKind, setSelectedKind] = useState<StructureKindKey>('territorial')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedLevelId, setSelectedLevelId] = useState('')
  const [selectedOfficeIds, setSelectedOfficeIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingStructure, setLoadingStructure] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedDiocese = dioceses.find((diocese) => diocese.id === selectedDioceseId) ?? null
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null
  const selectedLevel = levels.find((level) => level.id === selectedLevelId) ?? null
  const assignedRelations = relations.filter((relation) => relation.level_id === selectedLevelId && relation.status === 'active')
  const assignedCount = selectedOfficeIds.length

  useEffect(() => {
    async function loadBaseData() {
      setError(null)
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/admin/login')
        return
      }

      const [entityRes, officeRes] = await Promise.all([
        supabase.from('ecclesiastical_entities').select('id,name,slug').eq('status', 'active').order('name'),
        supabase.from('office_configurations').select('id,key,display_name,organization_chart_id').eq('status', 'active').order('display_name'),
      ])

      if (entityRes.error || officeRes.error) {
        setError(entityRes.error?.message ?? officeRes.error?.message ?? 'No se pudo cargar la base de datos.')
        setLoading(false)
        return
      }

      const loadedDioceses = ((entityRes.data ?? []) as Diocese[]).filter((entity) => isDioceseLike(entity.name))
      setDioceses(loadedDioceses)
      setOffices((officeRes.data ?? []) as OfficeConfiguration[])
      setSelectedDioceseId(loadedDioceses[0]?.id ?? '')
      setLoading(false)
    }

    loadBaseData()
  }, [router, supabase])

  useEffect(() => {
    async function loadTemplates() {
      if (!selectedDioceseId) {
        setTemplates([])
        setSelectedTemplateId('')
        return
      }

      setError(null)
      setLoadingStructure(true)
      const { data, error: templateError } = await supabase.rpc('get_structure_templates', {
        p_diocese_id: selectedDioceseId,
        p_kind_key: selectedKind,
        p_active_only: false,
      })

      if (templateError) {
        setError(templateError.message)
        setTemplates([])
        setSelectedTemplateId('')
        setLoadingStructure(false)
        return
      }

      const loadedTemplates = (data ?? []) as StructureTemplate[]
      const preferred = loadedTemplates.find((template) => template.is_primary && template.status === 'active') ?? loadedTemplates[0]
      setTemplates(loadedTemplates)
      setSelectedTemplateId(preferred?.id ?? '')
      setLoadingStructure(false)
    }

    loadTemplates()
  }, [selectedDioceseId, selectedKind, supabase])

  useEffect(() => {
    async function loadTemplateDetails() {
      if (!selectedTemplateId) {
        setLevels([])
        setRelations([])
        setSelectedLevelId('')
        return
      }

      setError(null)
      setLoadingStructure(true)
      const [levelRes, relationRes] = await Promise.all([
        supabase
          .from('structure_levels')
          .select('id,level_key,name,plural_name,level_order,parent_level_id,scope')
          .eq('template_id', selectedTemplateId)
          .order('level_order'),
        supabase
          .from('structure_level_office_configurations')
          .select('id,level_id,office_configuration_id,sort_order,status')
          .eq('status', 'active')
          .order('sort_order'),
      ])

      if (levelRes.error || relationRes.error) {
        setError(levelRes.error?.message ?? relationRes.error?.message ?? 'No se pudo cargar la configuración de cargos por nivel.')
        setLoadingStructure(false)
        return
      }

      const loadedLevels = (levelRes.data ?? []) as StructureLevel[]
      setLevels(loadedLevels)
      setRelations((relationRes.data ?? []) as LevelOfficeConfiguration[])
      setSelectedLevelId(loadedLevels[0]?.id ?? '')
      setLoadingStructure(false)
    }

    loadTemplateDetails()
  }, [selectedTemplateId, supabase])

  useEffect(() => {
    const nextIds = relations
      .filter((relation) => relation.level_id === selectedLevelId && relation.status === 'active')
      .map((relation) => relation.office_configuration_id)
    setSelectedOfficeIds(nextIds)
  }, [relations, selectedLevelId])

  function toggleOffice(officeId: string, checked: boolean) {
    setSelectedOfficeIds((current) => {
      if (checked) return Array.from(new Set([...current, officeId]))
      return current.filter((id) => id !== officeId)
    })
  }

  async function saveLevelOffices(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedLevelId) {
      setError('Selecciona un nivel estructural.')
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)

    const existingRelationIds = assignedRelations.map((relation) => relation.id)
    const rowsToInsert = selectedOfficeIds.map((officeId, index) => ({
      level_id: selectedLevelId,
      office_configuration_id: officeId,
      is_default: index === 0,
      sort_order: index + 1,
      status: 'active',
    }))

    try {
      if (existingRelationIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('structure_level_office_configurations')
          .delete()
          .in('id', existingRelationIds)

        if (deleteError) throw new Error(deleteError.message)
      }

      if (rowsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('structure_level_office_configurations')
          .insert(rowsToInsert)

        if (insertError) throw new Error(insertError.message)
      }

      const { data: refreshed, error: refreshError } = await supabase
        .from('structure_level_office_configurations')
        .select('id,level_id,office_configuration_id,sort_order,status')
        .eq('status', 'active')
        .order('sort_order')

      if (refreshError) throw new Error(refreshError.message)
      setRelations((refreshed ?? []) as LevelOfficeConfiguration[])
      setMessage('Cargos permitidos actualizados para el nivel seleccionado.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudieron guardar los cargos del nivel.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <main className="container"><div className="empty-state">Cargando configuración de cargos por nivel...</div></main>
  }

  return (
    <main className="container dashboard-page admin-config-page">
      <style>{pageStyles}</style>
      <div className="detail-backlink"><Link href="/admin">← Volver al panel administrativo</Link></div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Configuración estructural</p>
          <h1>Cargos permitidos por nivel</h1>
          <p className="lead">Define qué cargos pueden usarse en cada nivel de la estructura activa. Esto alimenta el filtro del formulario de asignaciones.</p>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="empty-state">{message}</div>}

      <section className="card dashboard-section">
        <div className="level-office-toolbar">
          <label>
            Diócesis
            <select value={selectedDioceseId} onChange={(event) => setSelectedDioceseId(event.target.value)}>
              <option value="">Seleccionar diócesis</option>
              {dioceses.map((diocese) => <option key={diocese.id} value={diocese.id}>{diocese.name}</option>)}
            </select>
          </label>

          <label>
            Tipo de catálogo
            <select value={selectedKind} onChange={(event) => setSelectedKind(event.target.value as StructureKindKey)}>
              {kindOptions.map((kind) => <option key={kind.key} value={kind.key}>{kind.label}</option>)}
            </select>
          </label>

          <label>
            Catálogo
            <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
              <option value="">Seleccionar catálogo</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="level-office-grid">
        <div className="card dashboard-section">
          <p className="eyebrow">Nivel estructural</p>
          <h2>{selectedDiocese?.name ?? 'Sin diócesis'}</h2>
          <p className="meta">{selectedTemplate?.name ?? 'Selecciona un catálogo para ver sus niveles.'}</p>

          {loadingStructure ? <div className="empty-state">Cargando estructura...</div> : (
            <div className="level-office-list">
              {levels.length === 0 && <div className="empty-state">Este catálogo todavía no tiene niveles configurados.</div>}
              {levels.map((level) => (
                <button
                  className={`metric-card metric-button ${selectedLevelId === level.id ? 'active-filter' : ''}`}
                  key={level.id}
                  onClick={() => setSelectedLevelId(level.id)}
                  type="button"
                >
                  <strong>{levelLabel(level)}</strong>
                  <span>{level.scope}{level.plural_name ? ` · ${level.plural_name}` : ''}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <form className="card dashboard-section" onSubmit={saveLevelOffices}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Cargos permitidos</p>
              <h2>{selectedLevel ? levelLabel(selectedLevel) : 'Selecciona un nivel'}</h2>
              <p className="meta">Selecciona uno o varios cargos. El primero guardado se marca como predeterminado para ese nivel.</p>
            </div>
          </div>

          <div className="level-office-summary">
            <strong>{assignedCount} cargos seleccionados</strong>
            <span>{selectedLevel ? 'Esta configuración se usa en Asignaciones de cargos al seleccionar una entidad de este nivel.' : 'Selecciona un nivel para activar la lista.'}</span>
          </div>

          <div className="level-office-list">
            {offices.map((office) => (
              <label className="level-office-row" key={office.id}>
                <input
                  checked={selectedOfficeIds.includes(office.id)}
                  disabled={!selectedLevelId || saving}
                  onChange={(event) => toggleOffice(office.id, event.target.checked)}
                  type="checkbox"
                />
                <span>
                  <strong>{office.display_name}</strong>
                  <span>{office.key}</span>
                </span>
              </label>
            ))}
          </div>

          <button className="button button-primary" disabled={!selectedLevelId || saving}>
            {saving ? 'Guardando...' : 'Guardar cargos del nivel'}
          </button>
        </form>
      </section>
    </main>
  )
}
