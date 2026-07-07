'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>

type EcclesiasticalEntity = {
  id: string
  name: string
  official_name: string | null
  slug: string
}

type EntityType = {
  id: string
  key: string
  name: string
}

type StructureKindKey = 'territorial' | 'pastoral' | 'administrative' | 'organic'

type StructureKind = {
  key: StructureKindKey
  name: string
  description: string | null
}

type StructureTemplate = {
  id: string
  diocese_id: string
  kind_key: StructureKindKey
  key: string
  name: string
  description: string | null
  is_primary: boolean
  is_active: boolean
  status: string
}

type StructureLevel = {
  id: string
  template_id: string
  level_key: string
  name: string
  plural_name: string | null
  description: string | null
  level_order: number
  parent_level_id: string | null
  linked_entity_type_id: string | null
  scope: string
  is_entry_point: boolean
  is_required: boolean
  allows_multiple_entities: boolean
  allows_new_nodes: boolean
}

type ChildLevelOption = {
  level_id: string
  level_key: string
  level_name: string
  plural_name: string | null
  level_order: number
  parent_level_id: string | null
  edge_id: string | null
  allows_multiple: boolean
  is_required: boolean
}

type StructureTreeNode = {
  node_id: string
  template_id: string
  level_id: string
  level_key: string
  level_name: string
  parent_node_id: string | null
  depth: number
  path_ids: string[]
  path_names: string[]
  name: string
  official_name: string | null
  slug: string
  code: string | null
  linked_ecclesiastical_entity_id: string | null
  linked_pastoral_entity_id: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  status: string
  visibility: string
  has_children: boolean
}

type RpcResult = {
  success?: boolean
  id?: string
  message?: string
}

const fallbackKinds: StructureKind[] = [
  { key: 'territorial', name: 'Territorial', description: 'Provincia, diócesis y divisiones propias: vicarías, zonas, parroquias, sectores y capillas.' },
  { key: 'pastoral', name: 'Pastoral', description: 'Áreas, comisiones, movimientos, comunidades y servicios.' },
  { key: 'administrative', name: 'Administrativa', description: 'Curia, oficinas, departamentos y dependencias internas.' },
  { key: 'organic', name: 'Orgánica', description: 'Organigramas, unidades y líneas de responsabilidad.' },
]

const fixedJurisdictionKeys = ['country', 'ecclesiastical_province', 'archdiocese', 'diocese', 'military_ordinariate']

const pageStyles = `
  .structure-catalog input,
  .structure-catalog select,
  .structure-catalog textarea {
    border: 1px solid var(--border);
    border-radius: 14px;
    font: inherit;
    padding: 12px 14px;
    width: 100%;
  }

  .structure-catalog textarea {
    min-height: 90px;
    resize: vertical;
  }

  .structure-catalog-hero {
    align-items: stretch;
    grid-template-columns: minmax(0, 1fr) minmax(260px, 0.36fr);
  }

  .structure-catalog-summary {
    background: #fbf8f1;
    border: 1px solid var(--border);
    border-radius: 18px;
    display: grid;
    gap: 8px;
    padding: 20px;
  }

  .structure-catalog-summary strong {
    font-size: 22px;
    line-height: 1.2;
  }

  .structure-catalog-summary span,
  .structure-catalog-summary small {
    color: var(--muted);
    font-size: 14px;
    line-height: 1.45;
  }

  .structure-toolbar {
    align-items: end;
    display: grid;
    gap: 14px;
    grid-template-columns: minmax(260px, 1fr) minmax(220px, 0.8fr) minmax(220px, 0.8fr);
  }

  .structure-toolbar label,
  .catalog-form label {
    color: var(--muted);
    display: grid;
    font-size: 14px;
    font-weight: 800;
    gap: 7px;
  }

  .catalog-layout {
    align-items: start;
    display: grid;
    gap: 18px;
    grid-template-columns: minmax(280px, 0.82fr) minmax(0, 1.18fr);
  }

  .catalog-column {
    display: grid;
    gap: 12px;
  }

  .catalog-node,
  .catalog-level {
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 16px;
    display: grid;
    gap: 8px;
    padding: 14px;
  }

  .catalog-level-header,
  .catalog-node-header {
    align-items: center;
    display: flex;
    gap: 10px;
    justify-content: space-between;
  }

  .catalog-badge {
    align-items: center;
    background: #fbf8f1;
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--primary);
    display: inline-flex;
    font-size: 12px;
    font-weight: 900;
    min-width: 76px;
    justify-content: center;
    padding: 7px 10px;
  }

  .catalog-fixed {
    background: #fbf8f1;
  }

  .catalog-level small,
  .catalog-node small {
    color: var(--muted);
    font-size: 12px;
    line-height: 1.4;
  }

  .catalog-level-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .catalog-mini-button {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--primary);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    padding: 7px 10px;
  }

  .catalog-form {
    display: grid;
    gap: 12px;
  }

  .catalog-form-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .catalog-tabs {
    display: grid;
    gap: 14px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .catalog-tabs .metric-card strong {
    font-size: 24px;
  }

  .active-filter {
    border-color: rgba(122, 31, 31, 0.68) !important;
    box-shadow: 0 16px 36px rgba(122, 31, 31, 0.12) !important;
  }

  @media (max-width: 980px) {
    .structure-catalog-hero,
    .structure-toolbar,
    .catalog-layout,
    .catalog-form-grid,
    .catalog-tabs {
      grid-template-columns: 1fr;
    }
  }
`

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

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function isFixedJurisdictionLevel(level: StructureLevel) {
  return fixedJurisdictionKeys.includes(level.level_key) || /pa[ií]s|provincia eclesi[aá]stica|arquidi[oó]cesis|di[oó]cesis|ordinariato/i.test(level.name)
}

function visibleLevelOrder(level: StructureLevel) {
  return isFixedJurisdictionLevel(level) ? 2 : level.level_order + 1
}

function dbOrderFromVisibleLevel(value: number) {
  return Math.max(1, value - 1)
}

function toBoolean(value: FormDataEntryValue | null) {
  return value === 'on' || value === 'true'
}

function defaultModelName(kind: StructureKindKey) {
  if (kind === 'territorial') return 'Catálogo territorial principal'
  if (kind === 'pastoral') return 'Catálogo pastoral principal'
  if (kind === 'administrative') return 'Catálogo administrativo principal'
  return 'Catálogo orgánico principal'
}

export default function AdminEstructuraPage() {
  const router = useRouter()
  const supabase = useMemo<SupabaseClient>(() => createClient(), [])

  const [entities, setEntities] = useState<EcclesiasticalEntity[]>([])
  const [dioceses, setDioceses] = useState<EcclesiasticalEntity[]>([])
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([])
  const [structureKinds, setStructureKinds] = useState<StructureKind[]>(fallbackKinds)
  const [activeKind, setActiveKind] = useState<StructureKindKey>('territorial')
  const [mode, setMode] = useState<'unit' | 'level'>('unit')
  const [editingLevelId, setEditingLevelId] = useState('')
  const [selectedDioceseId, setSelectedDioceseId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedParentNodeId, setSelectedParentNodeId] = useState('')
  const [templates, setTemplates] = useState<StructureTemplate[]>([])
  const [levels, setLevels] = useState<StructureLevel[]>([])
  const [treeNodes, setTreeNodes] = useState<StructureTreeNode[]>([])
  const [childLevelOptions, setChildLevelOptions] = useState<ChildLevelOption[]>([])
  const [loadingBase, setLoadingBase] = useState(true)
  const [loadingStructure, setLoadingStructure] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedDiocese = dioceses.find((diocese) => diocese.id === selectedDioceseId) ?? null
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null
  const sortedLevels = [...levels].sort((a, b) => visibleLevelOrder(a) - visibleLevelOrder(b))
  const rootJurisdictionLevel = sortedLevels.find((level) => fixedJurisdictionKeys.includes(level.level_key)) ?? sortedLevels.find(isFixedJurisdictionLevel) ?? null
  const customLevels = sortedLevels.filter((level) => !isFixedJurisdictionLevel(level))
  const editingLevel = customLevels.find((level) => level.id === editingLevelId) ?? null
  const selectedParentNode = treeNodes.find((node) => node.node_id === selectedParentNodeId) ?? null
  const selectedParentLevelId = selectedParentNode?.level_id ?? null
  const sortedNodes = [...treeNodes].sort((a, b) => a.path_names.join(' / ').localeCompare(b.path_names.join(' / '), 'es'))
  const rootNode = sortedNodes.find((node) => !node.parent_node_id) ?? null
  const selectedKind = structureKinds.find((kind) => kind.key === activeKind) ?? fallbackKinds.find((kind) => kind.key === activeKind)
  const nextVisibleLevel = customLevels.length > 0 ? Math.max(...customLevels.map(visibleLevelOrder)) + 1 : 3

  function levelName(id: string | null) {
    if (!id) return rootJurisdictionLevel ? 'Nivel 2 · Diócesis / Arquidiócesis' : 'Nivel base'
    const level = levels.find((item) => item.id === id)
    if (!level) return 'Nivel no encontrado'
    return `Nivel ${visibleLevelOrder(level)} · ${level.name}`
  }

  function childLevelLabel(option: ChildLevelOption) {
    return `Nivel ${option.level_order + 1} · ${option.level_name}`
  }

  async function loadBaseData() {
    setError(null)
    setLoadingBase(true)

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    const [entityRes, kindRes, entityTypeRes] = await Promise.all([
      supabase.from('ecclesiastical_entities').select('id,name,official_name,slug').eq('status', 'active').order('name'),
      supabase.from('structure_kinds').select('key,name,description').eq('status', 'active').order('sort_order'),
      supabase.from('entity_types').select('id,key,name').eq('status', 'active').order('default_level_order'),
    ])

    if (entityRes.error) setError(entityRes.error.message)
    if (kindRes.error) setError(kindRes.error.message)
    if (entityTypeRes.error) setError(entityTypeRes.error.message)

    const loadedEntities = (entityRes.data ?? []) as EcclesiasticalEntity[]
    const loadedDioceses = loadedEntities.filter((entity) => /di[oó]cesis|arquidi[oó]cesis|ordinariato|vicariato/i.test(entity.name))

    setEntities(loadedEntities)
    setDioceses(loadedDioceses)
    setStructureKinds(((kindRes.data ?? []) as StructureKind[]).length > 0 ? (kindRes.data as StructureKind[]) : fallbackKinds)
    setEntityTypes((entityTypeRes.data ?? []) as EntityType[])

    if (!selectedDioceseId && loadedDioceses[0]) setSelectedDioceseId(loadedDioceses[0].id)
    setLoadingBase(false)
  }

  async function loadTemplates(dioceseId: string, kindKey: StructureKindKey) {
    if (!dioceseId) return
    setError(null)
    setLoadingStructure(true)

    const { data, error: templateError } = await supabase.rpc('get_structure_templates', {
      p_diocese_id: dioceseId,
      p_kind_key: kindKey,
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
    setTemplates(loadedTemplates)
    const preferredTemplate = loadedTemplates.find((template) => template.id === selectedTemplateId) ?? loadedTemplates.find((template) => template.is_primary && template.status === 'active') ?? loadedTemplates[0]
    setSelectedTemplateId(preferredTemplate?.id ?? '')
    setLoadingStructure(false)
  }

  async function loadTemplateDetails(templateId: string) {
    if (!templateId) {
      setLevels([])
      setTreeNodes([])
      setChildLevelOptions([])
      return
    }

    setError(null)
    setLoadingStructure(true)

    const [levelRes, treeRes] = await Promise.all([
      supabase.from('structure_levels').select('id,template_id,level_key,name,plural_name,description,level_order,parent_level_id,linked_entity_type_id,scope,is_entry_point,is_required,allows_multiple_entities,allows_new_nodes').eq('template_id', templateId).order('level_order'),
      supabase.rpc('get_structure_tree', {
        p_template_id: templateId,
        p_root_node_id: null,
        p_as_of: todayIso(),
        p_include_inactive: false,
      }),
    ])

    if (levelRes.error) setError(levelRes.error.message)
    if (treeRes.error) setError(treeRes.error.message)

    const loadedNodes = (treeRes.data ?? []) as StructureTreeNode[]
    setLevels((levelRes.data ?? []) as StructureLevel[])
    setTreeNodes(loadedNodes)
    if (!selectedParentNodeId && loadedNodes.length > 0) setSelectedParentNodeId((loadedNodes.find((node) => !node.parent_node_id) ?? loadedNodes[0]).node_id)
    setLoadingStructure(false)
  }

  async function loadChildLevelOptions(templateId: string, parentLevelId: string | null) {
    if (!templateId) {
      setChildLevelOptions([])
      return
    }

    const { data, error: levelOptionError } = await supabase.rpc('get_structure_child_level_options', {
      p_template_id: templateId,
      p_parent_level_id: parentLevelId,
    })

    if (levelOptionError) {
      setError(levelOptionError.message)
      setChildLevelOptions([])
      return
    }

    setChildLevelOptions((data ?? []) as ChildLevelOption[])
  }

  useEffect(() => {
    loadBaseData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedDioceseId) loadTemplates(selectedDioceseId, activeKind)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDioceseId, activeKind])

  useEffect(() => {
    loadTemplateDetails(selectedTemplateId)
    setEditingLevelId('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId])

  useEffect(() => {
    loadChildLevelOptions(selectedTemplateId, selectedParentLevelId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId, selectedParentLevelId])

  async function createModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)

    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()

    if (!selectedDioceseId || !name) {
      setError('Selecciona una diócesis y escribe el nombre del catálogo.')
      setSaving(false)
      return
    }

    const { data, error: saveError } = await supabase.rpc('admin_save_structure_template', {
      payload: {
        diocese_id: selectedDioceseId,
        kind_key: activeKind,
        key: emptyToNull(form.get('key')) ?? `${activeKind}-${slugify(name)}`,
        name,
        description: 'Catálogo jerárquico editable por diócesis.',
        is_primary: true,
        is_active: true,
        status: 'active',
      },
    })

    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }

    const result = data as RpcResult | null
    const templateId = result?.id
    const dioceseType = entityTypes.find((type) => ['archdiocese', 'diocese', 'military_ordinariate'].includes(type.key))

    if (templateId) {
      await supabase.rpc('admin_save_structure_level', {
        payload: {
          template_id: templateId,
          level_key: 'diocese',
          name: 'Diócesis / Arquidiócesis',
          plural_name: 'Diócesis y arquidiócesis',
          level_order: 1,
          linked_entity_type_id: dioceseType?.id ?? null,
          scope: 'ecclesial',
          is_entry_point: true,
          is_required: true,
          allows_multiple_entities: true,
          allows_new_nodes: true,
        },
      })
      setSelectedTemplateId(templateId)
    }

    setMessage('Catálogo creado. La base fija queda como Provincia → Diócesis; ahora agrega niveles desde el 3.')
    event.currentTarget.reset()
    await loadTemplates(selectedDioceseId, activeKind)
    setSaving(false)
  }

  async function saveLevel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)

    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const displayOrder = Number(form.get('display_order') ?? 3)
    const parentValue = String(form.get('parent_level_id') ?? '__diocese__')
    const parentLevelId = parentValue === '__diocese__' ? rootJurisdictionLevel?.id ?? null : emptyToNull(parentValue)

    if (!selectedTemplateId || !name || !Number.isFinite(displayOrder) || displayOrder < 3) {
      setError('Completa el nivel. Los niveles personalizados comienzan desde el nivel 3.')
      setSaving(false)
      return
    }

    const { data, error: saveError } = await supabase.rpc('admin_save_structure_level', {
      payload: {
        id: emptyToNull(form.get('id')),
        template_id: selectedTemplateId,
        parent_level_id: parentLevelId,
        linked_entity_type_id: emptyToNull(form.get('linked_entity_type_id')),
        level_key: emptyToNull(form.get('level_key')) ?? slugify(name),
        name,
        plural_name: emptyToNull(form.get('plural_name')),
        description: emptyToNull(form.get('description')),
        level_order: dbOrderFromVisibleLevel(displayOrder),
        scope: String(form.get('scope') ?? 'ecclesial'),
        is_entry_point: toBoolean(form.get('is_entry_point')),
        is_required: toBoolean(form.get('is_required')),
        allows_multiple_entities: true,
        allows_new_nodes: true,
      },
    })

    if (saveError) setError(saveError.message)
    else {
      const result = data as RpcResult | null
      setMessage(result?.id === editingLevelId ? 'Nivel actualizado y movido correctamente.' : 'Nivel agregado al catálogo.')
      setEditingLevelId('')
      event.currentTarget.reset()
      await loadTemplateDetails(selectedTemplateId)
    }

    setSaving(false)
  }

  async function saveUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)

    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const levelId = String(form.get('level_id') ?? '')

    if (!selectedTemplateId || !name || !levelId) {
      setError('Selecciona el padre, el nivel permitido y el nombre de la unidad.')
      setSaving(false)
      return
    }

    const { data, error: saveError } = await supabase.rpc('admin_save_structure_node', {
      payload: {
        template_id: selectedTemplateId,
        level_id: levelId,
        parent_node_id: emptyToNull(form.get('parent_node_id')),
        name,
        official_name: emptyToNull(form.get('official_name')),
        slug: slugify(name),
        code: emptyToNull(form.get('code')),
        description: emptyToNull(form.get('description')),
        linked_ecclesiastical_entity_id: emptyToNull(form.get('linked_ecclesiastical_entity_id')),
        start_date: emptyToNull(form.get('start_date')) ?? todayIso(),
        status: 'active',
        visibility: 'public',
      },
    })

    if (saveError) setError(saveError.message)
    else {
      const result = data as RpcResult | null
      setMessage(`Unidad agregada${result?.id ? `: ${result.id}` : ''}.`)
      event.currentTarget.reset()
      setSelectedParentNodeId(rootNode?.node_id ?? '')
      await loadTemplateDetails(selectedTemplateId)
    }

    setSaving(false)
  }

  if (loadingBase) return <main className="container"><div className="empty-state">Cargando catálogo de estructura...</div></main>

  return (
    <main className="container dashboard-page admin-config-page structure-catalog">
      <style>{pageStyles}</style>
      <div className="detail-backlink"><Link href="/admin">← Volver al panel administrativo</Link></div>

      <section className="dashboard-hero card structure-catalog-hero">
        <div>
          <p className="eyebrow">Catálogo jerárquico</p>
          <h1>Estructura de la diócesis</h1>
          <p className="lead">
            La base es fija: nivel 1 provincia eclesiástica y nivel 2 diócesis o arquidiócesis. Desde el nivel 3 puedes crear, mover y ordenar los niveles propios de cada diócesis.
          </p>
        </div>
        <div className="structure-catalog-summary">
          <strong>{selectedDiocese?.name ?? 'Selecciona una diócesis'}</strong>
          <span>{selectedKind?.name ?? 'Territorial'} · {selectedTemplate?.name ?? 'sin catálogo activo'}</span>
          <small>{customLevels.length} niveles personalizados · {sortedNodes.length} unidades</small>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="empty-state">{message}</div>}

      <section className="card dashboard-section">
        <div className="structure-toolbar">
          <label>
            Diócesis
            <select value={selectedDioceseId} onChange={(event) => setSelectedDioceseId(event.target.value)}>
              <option value="">Seleccionar diócesis</option>
              {dioceses.map((diocese) => <option key={diocese.id} value={diocese.id}>{diocese.name}</option>)}
            </select>
          </label>
          <label>
            Catálogo
            <select value={activeKind} onChange={(event) => setActiveKind(event.target.value as StructureKindKey)}>
              {structureKinds.map((kind) => <option key={kind.key} value={kind.key}>{kind.name}</option>)}
            </select>
          </label>
          <label>
            Modelo activo
            <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
              <option value="">Crear o seleccionar</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}{template.is_primary ? ' · principal' : ''}</option>)}
            </select>
          </label>
        </div>

        {!selectedTemplate && (
          <form className="catalog-form" onSubmit={createModel}>
            <div className="catalog-form-grid">
              <label>Nombre del catálogo<input name="name" placeholder={defaultModelName(activeKind)} /></label>
              <label>Clave opcional<input name="key" placeholder={`${activeKind}-principal`} /></label>
            </div>
            <button className="button button-primary" disabled={saving || !selectedDioceseId} type="submit">Crear catálogo para esta diócesis</button>
          </form>
        )}
      </section>

      {selectedTemplate && (
        <section className="catalog-layout">
          <div className="card dashboard-section catalog-column">
            <div>
              <p className="eyebrow">Niveles del catálogo</p>
              <h2>Árbol de niveles</h2>
              <p className="meta">Usa “Editar / mover” para pasar una vicaría de nivel 2 a nivel 3, cambiar su padre o reordenarla.</p>
            </div>

            <div className="catalog-level catalog-fixed">
              <div className="catalog-level-header"><strong>Nivel 1 · Provincia eclesiástica</strong><span className="catalog-badge">Fijo</span></div>
              <small>Base común. No se edita desde aquí.</small>
            </div>
            <div className="catalog-level catalog-fixed">
              <div className="catalog-level-header"><strong>Nivel 2 · Diócesis / Arquidiócesis</strong><span className="catalog-badge">Fijo</span></div>
              <small>{selectedDiocese?.name ?? 'Diócesis seleccionada'}</small>
            </div>

            {customLevels.map((level) => (
              <div className="catalog-level" key={level.id}>
                <div className="catalog-level-header">
                  <strong>Nivel {visibleLevelOrder(level)} · {level.name}</strong>
                  <span className="catalog-badge">Editable</span>
                </div>
                <small>Padre: {levelName(level.parent_level_id)}</small>
                <div className="catalog-level-actions">
                  <button className="catalog-mini-button" onClick={() => { setEditingLevelId(level.id); setMode('level') }} type="button">Editar / mover</button>
                  <button className="catalog-mini-button" onClick={() => { setEditingLevelId(''); setMode('level') }} type="button">Agregar hija</button>
                </div>
              </div>
            ))}

            {customLevels.length === 0 && <p className="meta">No hay niveles personalizados. Agrega el nivel 3, por ejemplo Vicaría o Zona Pastoral.</p>}
          </div>

          <div className="card dashboard-section catalog-column">
            <div>
              <p className="eyebrow">Unidades del árbol</p>
              <h2>Provincia → Diócesis → unidades</h2>
              <p className="meta">Aquí se agregan las unidades reales: vicaría, zona, parroquia, capilla o institución. Los sacerdotes se asignan luego a estas unidades mediante nombramientos.</p>
            </div>

            {loadingStructure && <div className="empty-state">Actualizando árbol...</div>}

            <div className="catalog-node catalog-fixed">
              <div className="catalog-node-header"><strong>Nivel 1 · Provincia eclesiástica</strong><span className="catalog-badge">Base</span></div>
              <small>Se resolverá desde la provincia eclesiástica oficial de la diócesis.</small>
            </div>
            <div className="catalog-node catalog-fixed">
              <div className="catalog-node-header"><strong>Nivel 2 · {selectedDiocese?.name ?? 'Diócesis'}</strong><span className="catalog-badge">Base</span></div>
              <small>Raíz operativa del catálogo de esta diócesis.</small>
            </div>

            {sortedNodes.map((node) => !isFixedJurisdictionLevel({ id: node.level_id, template_id: node.template_id, level_key: node.level_key, name: node.level_name, plural_name: null, description: null, level_order: 1, parent_level_id: null, linked_entity_type_id: null, scope: 'ecclesial', is_entry_point: false, is_required: false, allows_multiple_entities: true, allows_new_nodes: true }) && (
              <div className="catalog-node" key={node.node_id} style={{ marginLeft: `${Math.min(node.depth, 5) * 18}px` }}>
                <div className="catalog-node-header"><strong>Nivel {node.depth + 2} · {node.name}</strong><span className="catalog-badge">{node.level_name}</span></div>
                <small>{node.parent_node_id ? `Depende de ${treeNodes.find((item) => item.node_id === node.parent_node_id)?.name ?? '—'}` : 'Depende de la diócesis'} · desde {formatDate(node.start_date)}</small>
              </div>
            ))}

            {sortedNodes.length === 0 && <p className="meta">Aún no hay unidades cargadas. Agrega la primera unidad debajo de la diócesis.</p>}
          </div>
        </section>
      )}

      {selectedTemplate && (
        <section className="card dashboard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Acciones rápidas</p>
              <h2>{mode === 'level' ? editingLevel ? 'Editar o mover nivel' : 'Agregar nivel personalizado' : 'Agregar unidad al árbol'}</h2>
              <p className="meta">La idea es seleccionar más y escribir menos: padre, nivel permitido y entidad vinculada.</p>
            </div>
          </div>

          <div className="catalog-tabs">
            <button className={`metric-card metric-button ${mode === 'unit' ? 'active-filter' : ''}`} onClick={() => setMode('unit')} type="button"><strong>Agregar unidad</strong><span>Vicaría, zona, parroquia, capilla, institución...</span></button>
            <button className={`metric-card metric-button ${mode === 'level' ? 'active-filter' : ''}`} onClick={() => { setMode('level'); setEditingLevelId('') }} type="button"><strong>Agregar / mover nivel</strong><span>Cambiar Vicaría a nivel 3, crear Sector como hija...</span></button>
          </div>

          {mode === 'level' && (
            <form className="catalog-form" key={editingLevel?.id ?? 'new-level'} onSubmit={saveLevel}>
              <input name="id" type="hidden" value={editingLevel?.id ?? ''} readOnly />
              <div className="catalog-form-grid">
                <label>Nombre del nivel<input name="name" defaultValue={editingLevel?.name ?? ''} placeholder="Ej. Vicaría" /></label>
                <label>Plural<input name="plural_name" defaultValue={editingLevel?.plural_name ?? ''} placeholder="Ej. Vicarías" /></label>
                <label>Nivel visible<input name="display_order" defaultValue={editingLevel ? visibleLevelOrder(editingLevel) : nextVisibleLevel} min="3" type="number" /></label>
                <label>Clave interna<input name="level_key" defaultValue={editingLevel?.level_key ?? ''} placeholder="Opcional" /></label>
                <label>
                  Padre
                  <select name="parent_level_id" defaultValue={editingLevel?.parent_level_id ?? '__diocese__'}>
                    <option value="__diocese__">Nivel 2 · Diócesis / Arquidiócesis</option>
                    {customLevels.filter((level) => level.id !== editingLevel?.id).map((level) => <option key={level.id} value={level.id}>Nivel {visibleLevelOrder(level)} · {level.name}</option>)}
                  </select>
                </label>
                <label>
                  Tipo vinculado
                  <select name="linked_entity_type_id" defaultValue={editingLevel?.linked_entity_type_id ?? ''}>
                    <option value="">Sin vínculo</option>
                    {entityTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </select>
                </label>
                <label>
                  Uso
                  <select name="scope" defaultValue={editingLevel?.scope ?? (activeKind === 'territorial' ? 'ecclesial' : activeKind)}>
                    <option value="ecclesial">Eclesial</option>
                    <option value="pastoral">Pastoral</option>
                    <option value="administrative">Administrativa</option>
                    <option value="organic">Orgánica</option>
                    <option value="mixed">Mixta</option>
                  </select>
                </label>
              </div>
              <textarea name="description" defaultValue={editingLevel?.description ?? ''} placeholder="Notas o criterio de uso" />
              <label className="role-pill"><input name="is_entry_point" defaultChecked={editingLevel?.is_entry_point ?? false} type="checkbox" /> Puede iniciar formulario</label>
              <label className="role-pill"><input name="is_required" defaultChecked={editingLevel?.is_required ?? false} type="checkbox" /> Nivel obligatorio</label>
              <button className="button button-primary" disabled={saving} type="submit">{saving ? 'Guardando...' : editingLevel ? 'Guardar movimiento' : 'Agregar nivel'}</button>
            </form>
          )}

          {mode === 'unit' && (
            <form className="catalog-form" onSubmit={saveUnit}>
              <div className="catalog-form-grid">
                <label>
                  Padre
                  <select name="parent_node_id" value={selectedParentNodeId} onChange={(event) => setSelectedParentNodeId(event.target.value)}>
                    <option value="">Nivel 2 · Diócesis / Arquidiócesis</option>
                    {sortedNodes.map((node) => <option key={node.node_id} value={node.node_id}>{'— '.repeat(node.depth)}{node.name} · {node.level_name}</option>)}
                  </select>
                </label>
                <label>
                  Nivel permitido
                  <select name="level_id" defaultValue="">
                    <option value="">Seleccionar nivel</option>
                    {childLevelOptions.map((option) => <option key={option.level_id} value={option.level_id}>{childLevelLabel(option)}</option>)}
                  </select>
                </label>
                <label>Nombre<input name="name" placeholder="Ej. Vicaría Norte" /></label>
                <label>Nombre oficial<input name="official_name" placeholder="Opcional" /></label>
                <label>Código<input name="code" placeholder="Opcional" /></label>
                <label>
                  Vincular entidad existente
                  <select name="linked_ecclesiastical_entity_id" defaultValue="">
                    <option value="">No vincular todavía</option>
                    {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
                  </select>
                </label>
                <label>Fecha de inicio<input name="start_date" type="date" /></label>
              </div>
              <textarea name="description" placeholder="Fuente o nota" />
              <button className="button button-primary" disabled={saving || childLevelOptions.length === 0} type="submit">{saving ? 'Guardando...' : 'Agregar unidad'}</button>
              {childLevelOptions.length === 0 && <p className="meta">No hay niveles permitidos para ese padre. Primero agrega el nivel hijo correspondiente.</p>}
            </form>
          )}
        </section>
      )}
    </main>
  )
}
