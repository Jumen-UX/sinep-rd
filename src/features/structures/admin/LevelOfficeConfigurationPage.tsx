'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  hasLevelOfficeAdminSession,
  loadLevelOfficeBaseData,
  loadLevelOfficeTemplateData,
  loadStructureTemplates,
  saveLevelOfficeConfiguration,
  type Diocese,
  type LevelOfficeConfiguration,
  type OfficeConfiguration,
  type StructureKindKey,
  type StructureLevel,
  type StructureTemplate,
} from '../services/level-office-admin-service'

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
  .level-office-summary { background: var(--surface-subtle, #fbf8f1); border: 1px solid var(--border); border-radius: 16px; display: grid; gap: 8px; padding: 14px; }
  @media (max-width: 900px) { .level-office-grid, .level-office-toolbar { grid-template-columns: 1fr; } }
`

function levelLabel(level: StructureLevel) {
  return `Nivel ${level.level_order + 1} · ${level.name}`
}

export default function LevelOfficeConfigurationPage() {
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

  useEffect(() => {
    async function loadBaseData() {
      setError(null)
      try {
        const authenticated = await hasLevelOfficeAdminSession(supabase)
        if (!authenticated) {
          router.push('/admin/login')
          return
        }

        const baseData = await loadLevelOfficeBaseData(supabase)
        setDioceses(baseData.dioceses)
        setOffices(baseData.offices)
        setSelectedDioceseId(baseData.dioceses[0]?.id ?? '')
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la configuración estructural.')
      } finally {
        setLoading(false)
      }
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
      try {
        const loadedTemplates = await loadStructureTemplates(supabase, selectedDioceseId, selectedKind)
        const preferred = loadedTemplates.find((template) => template.is_primary && template.status === 'active') ?? loadedTemplates[0]
        setTemplates(loadedTemplates)
        setSelectedTemplateId(preferred?.id ?? '')
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los catálogos estructurales.')
        setTemplates([])
        setSelectedTemplateId('')
      } finally {
        setLoadingStructure(false)
      }
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
      try {
        const data = await loadLevelOfficeTemplateData(supabase, selectedTemplateId)
        setLevels(data.levels)
        setRelations(data.relations)
        setSelectedLevelId(data.levels[0]?.id ?? '')
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la configuración de cargos por nivel.')
      } finally {
        setLoadingStructure(false)
      }
    }

    loadTemplateDetails()
  }, [selectedTemplateId, supabase])

  useEffect(() => {
    setSelectedOfficeIds(
      relations
        .filter((relation) => relation.level_id === selectedLevelId && relation.status === 'active')
        .map((relation) => relation.office_configuration_id),
    )
  }, [relations, selectedLevelId])

  function toggleOffice(officeId: string, checked: boolean) {
    setSelectedOfficeIds((current) => checked ? Array.from(new Set([...current, officeId])) : current.filter((id) => id !== officeId))
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

    try {
      const refreshed = await saveLevelOfficeConfiguration(
        supabase,
        selectedLevelId,
        selectedOfficeIds,
        assignedRelations.map((relation) => relation.id),
      )
      setRelations(refreshed)
      setMessage('Cargos permitidos actualizados para el nivel seleccionado.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudieron guardar los cargos del nivel.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className="container"><div className="empty-state">Cargando configuración de cargos por nivel...</div></main>

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
            <strong>{selectedOfficeIds.length} cargos seleccionados</strong>
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
