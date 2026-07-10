'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  StructureLevelEditor,
  StructureNodeDetailPanel,
  StructureNodeEditor,
  StructurePresetGrid,
  StructureSummary,
  StructureTreeList,
  allowedKindKeys,
  defaultCatalogNames,
  loadStructureNodeDetail,
  saveStructureLevel,
  saveStructureNode,
  saveStructureTemplate,
  structurePresets,
  useStructureConfigurator,
} from '@/features/structures'
import { StructureLevelOfficeEditor } from '../components/StructureLevelOfficeEditor'
import { loadStructureLevelOfficeOptions, saveStructureLevelOffices } from '../services/structure-office-service'
import type { StructureKindKey, StructureLevel, StructureNodeDetail, StructurePreset } from '../types'

const client = createClient()
const today = () => new Date().toISOString().slice(0, 10)
const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim()
const nullable = (form: FormData, key: string) => text(form, key) || null
const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export default function StructureConfiguratorPage() {
  const model = useStructureConfigurator({ client })
  const [saving, setSaving] = useState(false)
  const [editingLevel, setEditingLevel] = useState<StructureLevel | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [detail, setDetail] = useState<StructureNodeDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [officeLevelId, setOfficeLevelId] = useState('')
  const [officeOptions, setOfficeOptions] = useState<{ configured: any[]; available: any[] }>({ configured: [], available: [] })

  const selectedKind = useMemo(() => model.kinds.find((kind) => kind.key === model.activeKind) ?? null, [model.activeKind, model.kinds])

  useEffect(() => {
    if (model.selectedTemplateId) void model.loadAllowedChildren(null)
  }, [model.selectedTemplateId])

  useEffect(() => {
    if (!selectedNodeId) {
      setDetail(null)
      return
    }
    let active = true
    setDetailLoading(true)
    void loadStructureNodeDetail(client, selectedNodeId)
      .then((result) => { if (active) setDetail(result) })
      .catch((error) => { if (active) model.setError(error instanceof Error ? error.message : 'No se pudo cargar la ficha.') })
      .finally(() => { if (active) setDetailLoading(false) })
    return () => { active = false }
  }, [selectedNodeId])

  useEffect(() => {
    if (!officeLevelId) return
    void loadStructureLevelOfficeOptions(client, officeLevelId)
      .then(setOfficeOptions)
      .catch((error) => model.setError(error instanceof Error ? error.message : 'No se pudieron cargar los cargos.'))
  }, [officeLevelId])

  async function run(action: () => Promise<void>, fallback: string) {
    setSaving(true)
    model.setError(null)
    try { await action() }
    catch (error) { model.setError(error instanceof Error ? error.message : fallback) }
    finally { setSaving(false) }
  }

  function selectParent(nodeId: string) {
    model.setSelectedParentNodeId(nodeId)
    const parent = model.nodes.find((node) => node.node_id === nodeId)
    void model.loadAllowedChildren(parent?.level_id ?? null)
  }

  function submitTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void run(async () => {
      const name = text(form, 'name') || defaultCatalogNames[model.activeKind]
      const result = await saveStructureTemplate(client, {
        diocese_id: model.selectedDioceseId,
        kind_key: model.activeKind,
        key: text(form, 'key') || slugify(name),
        name,
        description: nullable(form, 'description'),
        is_primary: form.get('is_primary') === 'on',
        is_active: true,
        status: 'active',
      })
      await model.refreshTemplates()
      if (result.id) model.setSelectedTemplateId(result.id)
      event.currentTarget.reset()
    }, 'No se pudo guardar el catálogo.')
  }

  function submitLevel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void run(async () => {
      const name = text(form, 'name')
      await saveStructureLevel(client, {
        id: nullable(form, 'id'),
        template_id: model.selectedTemplateId,
        parent_level_id: nullable(form, 'parent_level_id'),
        linked_entity_type_id: nullable(form, 'linked_entity_type_id'),
        level_key: text(form, 'level_key') || slugify(name),
        name,
        plural_name: nullable(form, 'plural_name'),
        description: nullable(form, 'description'),
        level_order: Math.max(0, Number(text(form, 'display_order') || '1') - 1),
        scope: text(form, 'scope') || 'ecclesial',
        is_entry_point: form.get('is_entry_point') === 'on',
        is_required: form.get('is_required') === 'on',
        allows_multiple_entities: true,
        allows_new_nodes: true,
      })
      setEditingLevel(null)
      await model.refreshDetails()
    }, 'No se pudo guardar el nivel.')
  }

  function submitNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void run(async () => {
      const name = text(form, 'name')
      const result = await saveStructureNode(client, {
        template_id: model.selectedTemplateId,
        level_id: text(form, 'level_id'),
        parent_node_id: nullable(form, 'parent_node_id'),
        name,
        official_name: nullable(form, 'official_name'),
        slug: slugify(name),
        code: nullable(form, 'code'),
        description: nullable(form, 'description'),
        linked_ecclesiastical_entity_id: nullable(form, 'linked_ecclesiastical_entity_id'),
        start_date: nullable(form, 'start_date') || today(),
        status: 'active',
        visibility: 'public',
      })
      await model.refreshDetails()
      if (result.id) setSelectedNodeId(result.id)
      event.currentTarget.reset()
    }, 'No se pudo guardar la unidad.')
  }

  function applyPreset(preset: StructurePreset) {
    void run(async () => {
      let parentId: string | null = null
      for (const [index, level] of preset.levels.entries()) {
        const entityType = model.entityTypes.find((item) => level.entityTypeKeys?.includes(item.key))
        const result = await saveStructureLevel(client, {
          template_id: model.selectedTemplateId,
          parent_level_id: parentId,
          linked_entity_type_id: entityType?.id ?? null,
          level_key: level.levelKey,
          name: level.name,
          plural_name: level.pluralName,
          level_order: index + 2,
          scope: level.scope ?? 'ecclesial',
          is_entry_point: index === 0,
          is_required: true,
          allows_multiple_entities: true,
          allows_new_nodes: true,
        })
        parentId = result.id ?? parentId
      }
      await model.refreshDetails()
    }, 'No se pudo aplicar la plantilla.')
  }

  function saveOffices(ids: string[], defaultId: string | null) {
    void run(async () => {
      await saveStructureLevelOffices(client, officeLevelId, ids, defaultId)
      setOfficeOptions(await loadStructureLevelOfficeOptions(client, officeLevelId))
      if (selectedNodeId) setDetail(await loadStructureNodeDetail(client, selectedNodeId))
    }, 'No se pudieron guardar los cargos.')
  }

  if (model.loadingBase) return <main className="admin-page"><div className="card">Cargando configurador...</div></main>

  return (
    <main className="admin-page structure-catalog">
      <section className="admin-page-header">
        <div><p className="eyebrow">Administración</p><h1>Configurador de estructuras</h1><p>Define jerarquías territoriales, pastorales y administrativas, con cargos, vigencia y fuentes.</p></div>
        <Link className="button button-secondary" href="/admin">Volver al portal</Link>
      </section>

      {model.error && <div className="error-box">{model.error}</div>}

      <section className="card structure-toolbar">
        <label>Diócesis<select value={model.selectedDioceseId} onChange={(event) => model.changeDiocese(event.target.value)}><option value="">Seleccionar</option>{model.dioceses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Tipo<select value={model.activeKind} onChange={(event) => model.changeKind(event.target.value as StructureKindKey)}>{allowedKindKeys.map((key) => <option key={key} value={key}>{model.kinds.find((kind) => kind.key === key)?.name ?? key}</option>)}</select></label>
        <label>Catálogo<select value={model.selectedTemplateId} onChange={(event) => model.setSelectedTemplateId(event.target.value)}><option value="">Seleccionar</option>{model.templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </section>

      <StructureSummary diocese={model.selectedDiocese} kind={selectedKind} template={model.selectedTemplate} customLevelCount={model.levels.length} nodeCount={model.nodes.length} />

      {!model.selectedTemplateId && model.selectedDioceseId && <section className="card"><h2>Crear catálogo</h2><form className="catalog-form" onSubmit={submitTemplate}><input name="name" placeholder={defaultCatalogNames[model.activeKind]} required /><input name="key" placeholder="clave-interna" /><textarea name="description" placeholder="Descripción" /><label><input name="is_primary" type="checkbox" /> Catálogo principal</label><button className="button button-primary" disabled={saving}>Crear catálogo</button></form></section>}

      {model.selectedTemplateId && <>
        <section className="card"><div className="section-heading"><div><p className="eyebrow">Plantillas rápidas</p><h2>Configurar niveles</h2></div></div><StructurePresetGrid presets={structurePresets} disabled={saving} onApply={applyPreset} /></section>

        <section className="catalog-layout">
          <div className="catalog-column">
            <section className="card"><div className="section-heading"><div><p className="eyebrow">Jerarquía</p><h2>Árbol estructural</h2></div></div><StructureTreeList nodes={model.nodes} selectedNodeId={selectedNodeId} onSelect={(node) => { setSelectedNodeId(node.node_id); selectParent(node.node_id) }} /></section>
            <section className="card"><h2>Agregar unidad</h2><StructureNodeEditor allowedLevels={model.childLevelOptions} entities={model.entities} parentNodes={model.nodes} selectedParentNodeId={model.selectedParentNodeId} saving={saving} onParentChange={selectParent} onSubmit={submitNode} /></section>
          </div>
          <StructureNodeDetailPanel detail={detail} loading={detailLoading} onClose={() => setSelectedNodeId(null)} />
        </section>

        <section className="catalog-layout">
          <section className="card"><div className="section-heading"><div><p className="eyebrow">Niveles</p><h2>Definición jerárquica</h2></div></div>{model.levels.map((level) => <article className="catalog-level" key={level.id}><div className="catalog-level-header"><div><strong>{level.name}</strong><small>Nivel {level.level_order + 1} · {level.scope}</small></div><div className="catalog-level-actions"><button type="button" className="catalog-mini-button" onClick={() => setEditingLevel(level)}>Editar</button><button type="button" className="catalog-mini-button" onClick={() => setOfficeLevelId(level.id)}>Cargos</button></div></div></article>)}</section>
          <section className="card"><h2>{editingLevel ? 'Editar nivel' : 'Agregar nivel'}</h2><StructureLevelEditor editingLevel={editingLevel} entityTypes={model.entityTypes} parentLevels={model.levels} saving={saving} onCancel={() => setEditingLevel(null)} onSubmit={submitLevel} /></section>
        </section>

        {officeLevelId && <section className="card"><StructureLevelOfficeEditor level={model.levels.find((level) => level.id === officeLevelId) ?? null} configured={officeOptions.configured} available={officeOptions.available} saving={saving} onClose={() => setOfficeLevelId('')} onSave={saveOffices} /></section>}
      </>}
    </main>
  )
}
