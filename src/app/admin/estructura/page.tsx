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

type BuilderMode = 'level' | 'node'

const fallbackKinds: StructureKind[] = [
  { key: 'territorial', name: 'Territorial', description: 'Cómo se divide la diócesis: vicarías, zonas, parroquias, sectores y capillas.' },
  { key: 'pastoral', name: 'Pastoral', description: 'Cómo se organiza la acción pastoral: áreas, movimientos, comunidades y servicios.' },
  { key: 'administrative', name: 'Administrativa', description: 'Cómo se ordena la curia: oficinas, departamentos y dependencias internas.' },
  { key: 'organic', name: 'Orgánica', description: 'Cómo se visualizan organigramas, unidades y líneas de responsabilidad.' },
]

const kindHelp: Record<StructureKindKey, string> = {
  territorial: 'Úsala para la estructura que ayuda a ubicar parroquias, capillas, sectores y zonas dentro de una diócesis.',
  pastoral: 'Úsala para áreas, comisiones, movimientos, comunidades o equipos que no son necesariamente territoriales.',
  administrative: 'Úsala para la curia, oficinas, departamentos y otras dependencias internas.',
  organic: 'Úsala cuando quieras representar organigramas, responsables y líneas de coordinación.',
}

const structurePageStyles = `
  .structure-config-page input,
  .structure-config-page select,
  .structure-config-page textarea {
    border: 1px solid var(--border);
    border-radius: 14px;
    font: inherit;
    padding: 12px 14px;
    width: 100%;
  }

  .structure-config-page textarea {
    min-height: 90px;
    resize: vertical;
  }

  .structure-hero {
    align-items: stretch;
    grid-template-columns: minmax(0, 1fr) minmax(260px, 0.42fr);
  }

  .structure-hero-panel {
    background: #fbf8f1;
    border: 1px solid var(--border);
    border-radius: 18px;
    display: grid;
    gap: 8px;
    padding: 20px;
  }

  .structure-hero-panel strong {
    font-size: 22px;
    line-height: 1.2;
  }

  .structure-hero-panel span,
  .structure-hero-panel small {
    color: var(--muted);
    font-size: 14px;
    line-height: 1.45;
  }

  .structure-steps {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .structure-step-card {
    display: grid;
    gap: 16px;
    grid-template-columns: auto minmax(0, 1fr);
  }

  .structure-step-number {
    align-items: center;
    background: var(--primary);
    border-radius: 999px;
    color: white;
    display: inline-flex;
    font-weight: 800;
    height: 36px;
    justify-content: center;
    width: 36px;
  }

  .structure-kind-grid {
    display: grid;
    gap: 10px;
    margin-top: 14px;
  }

  .structure-kind-card {
    appearance: none;
    cursor: pointer;
    font: inherit;
    min-height: auto;
  }

  .active-filter {
    border-color: rgba(122, 31, 31, 0.68) !important;
    box-shadow: 0 16px 36px rgba(122, 31, 31, 0.12) !important;
  }

  .structure-inline-form {
    display: grid;
    gap: 10px;
    grid-template-columns: minmax(0, 1fr) minmax(0, 0.8fr) auto;
    margin-top: 14px;
  }

  .structure-map-layout {
    display: grid;
    gap: 18px;
    grid-template-columns: minmax(240px, 0.78fr) minmax(0, 1.22fr);
  }

  .structure-level-list,
  .structure-tree-list {
    background: #fbf8f1;
    border: 1px solid var(--border);
    border-radius: 18px;
    display: grid;
    gap: 10px;
    padding: 18px;
  }

  .structure-level-list h3,
  .structure-tree-list h3 {
    margin: 0 0 4px;
  }

  .structure-level-row,
  .structure-node-row {
    align-items: center;
    background: white;
    border: 1px solid var(--border);
    border-radius: 14px;
    display: flex;
    gap: 12px;
    justify-content: space-between;
    padding: 12px;
  }

  .structure-level-row span {
    align-items: center;
    background: #f7f3ea;
    border: 1px solid var(--border);
    border-radius: 999px;
    display: inline-flex;
    flex: 0 0 auto;
    font-weight: 800;
    height: 34px;
    justify-content: center;
    width: 34px;
  }

  .structure-level-row div,
  .structure-node-row div {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .structure-level-row small,
  .structure-node-row small,
  .structure-node-row span {
    color: var(--muted);
    font-size: 12px;
    line-height: 1.35;
  }

  .structure-action-tabs {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .structure-action-tabs .metric-card strong {
    font-size: 24px;
  }

  .structure-main-form label {
    color: var(--muted);
    display: grid;
    font-size: 14px;
    font-weight: 800;
    gap: 7px;
  }

  .structure-main-form .role-pill {
    align-items: center;
    display: inline-flex;
    gap: 8px;
    justify-content: flex-start;
    width: fit-content;
  }

  .structure-main-form .role-pill input {
    width: auto;
  }

  @media (max-width: 980px) {
    .structure-hero,
    .structure-steps,
    .structure-map-layout,
    .structure-action-tabs,
    .structure-inline-form {
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

function toBoolean(value: FormDataEntryValue | null) {
  return value === 'on' || value === 'true'
}

function buildDefaultModelName(kind: StructureKindKey) {
  if (kind === 'territorial') return 'Modelo territorial principal'
  if (kind === 'pastoral') return 'Modelo pastoral principal'
  if (kind === 'administrative') return 'Modelo administrativo principal'
  return 'Modelo orgánico principal'
}

export default function AdminEstructuraPage() {
  const router = useRouter()
  const supabase = useMemo<SupabaseClient>(() => createClient(), [])

  const [entities, setEntities] = useState<EcclesiasticalEntity[]>([])
  const [dioceses, setDioceses] = useState<EcclesiasticalEntity[]>([])
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([])
  const [structureKinds, setStructureKinds] = useState<StructureKind[]>(fallbackKinds)
  const [activeKind, setActiveKind] = useState<StructureKindKey>('territorial')
  const [builderMode, setBuilderMode] = useState<BuilderMode>('node')
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
  const selectedParentNode = treeNodes.find((node) => node.node_id === selectedParentNodeId) ?? null
  const selectedParentLevelId = selectedParentNode?.level_id ?? null
  const sortedLevels = [...levels].sort((a, b) => a.level_order - b.level_order)
  const sortedNodes = [...treeNodes].sort((a, b) => a.path_names.join(' / ').localeCompare(b.path_names.join(' / '), 'es'))
  const rootNodes = sortedNodes.filter((node) => !node.parent_node_id)
  const nextLevelOrder = sortedLevels.length > 0 ? Math.max(...sortedLevels.map((level) => level.level_order)) + 1 : 1
  const selectedKind = structureKinds.find((kind) => kind.key === activeKind) ?? fallbackKinds.find((kind) => kind.key === activeKind)

  async function loadBaseData() {
    setError(null)
    setLoadingBase(true)

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    const [entityRes, kindRes, entityTypeRes] = await Promise.all([
      supabase
        .from('ecclesiastical_entities')
        .select('id,name,official_name,slug')
        .eq('status', 'active')
        .order('name'),
      supabase
        .from('structure_kinds')
        .select('key,name,description')
        .eq('status', 'active')
        .order('sort_order'),
      supabase
        .from('entity_types')
        .select('id,key,name')
        .eq('status', 'active')
        .order('default_level_order'),
    ])

    if (entityRes.error) setError(entityRes.error.message)
    if (kindRes.error) setError(kindRes.error.message)
    if (entityTypeRes.error) setError(entityTypeRes.error.message)

    const loadedEntities = (entityRes.data ?? []) as EcclesiasticalEntity[]
    const loadedDioceses = loadedEntities.filter((entity) =>
      /di[oó]cesis|arquidi[oó]cesis|ordinariato|vicariato/i.test(entity.name),
    )

    setEntities(loadedEntities)
    setDioceses(loadedDioceses)
    setStructureKinds(((kindRes.data ?? []) as StructureKind[]).length > 0 ? (kindRes.data as StructureKind[]) : fallbackKinds)
    setEntityTypes((entityTypeRes.data ?? []) as EntityType[])

    if (!selectedDioceseId && loadedDioceses[0]) {
      setSelectedDioceseId(loadedDioceses[0].id)
    }

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

    const preferredTemplate =
      loadedTemplates.find((template) => template.id === selectedTemplateId) ??
      loadedTemplates.find((template) => template.is_primary && template.status === 'active') ??
      loadedTemplates[0]

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
      supabase
        .from('structure_levels')
        .select('id,template_id,level_key,name,plural_name,description,level_order,parent_level_id,linked_entity_type_id,scope,is_entry_point,is_required,allows_multiple_entities,allows_new_nodes')
        .eq('template_id', templateId)
        .order('level_order'),
      supabase.rpc('get_structure_tree', {
        p_template_id: templateId,
        p_root_node_id: null,
        p_as_of: todayIso(),
        p_include_inactive: false,
      }),
    ])

    if (levelRes.error) setError(levelRes.error.message)
    if (treeRes.error) setError(treeRes.error.message)

    setLevels((levelRes.data ?? []) as StructureLevel[])
    setTreeNodes((treeRes.data ?? []) as StructureTreeNode[])
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
    if (selectedDioceseId) {
      loadTemplates(selectedDioceseId, activeKind)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDioceseId, activeKind])

  useEffect(() => {
    loadTemplateDetails(selectedTemplateId)
    setSelectedParentNodeId('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId])

  useEffect(() => {
    loadChildLevelOptions(selectedTemplateId, selectedParentLevelId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId, selectedParentLevelId])

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)

    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()

    if (!selectedDioceseId) {
      setError('Selecciona una diócesis o jurisdicción.')
      setSaving(false)
      return
    }

    if (!name) {
      setError('Escribe el nombre del modelo.')
      setSaving(false)
      return
    }

    const payload = {
      diocese_id: selectedDioceseId,
      kind_key: activeKind,
      key: emptyToNull(form.get('key')) ?? `${activeKind}-${slugify(name)}`,
      name,
      description: emptyToNull(form.get('description')),
      is_primary: true,
      is_active: true,
      status: 'active',
    }

    const { data, error: saveError } = await supabase.rpc('admin_save_structure_template', { payload })

    if (saveError) {
      setError(saveError.message)
    } else {
      const result = data as RpcResult | null
      setMessage('Modelo de organización guardado correctamente.')
      event.currentTarget.reset()
      await loadTemplates(selectedDioceseId, activeKind)
      if (result?.id) setSelectedTemplateId(result.id)
    }

    setSaving(false)
  }

  async function saveLevel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)

    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const levelOrder = Number(form.get('level_order') ?? 0)

    if (!selectedTemplateId) {
      setError('Primero crea o selecciona un modelo de organización.')
      setSaving(false)
      return
    }

    if (!name || !Number.isFinite(levelOrder) || levelOrder <= 0) {
      setError('Completa el nombre y el orden del nivel.')
      setSaving(false)
      return
    }

    const payload = {
      template_id: selectedTemplateId,
      parent_level_id: emptyToNull(form.get('parent_level_id')),
      linked_entity_type_id: emptyToNull(form.get('linked_entity_type_id')),
      level_key: emptyToNull(form.get('level_key')) ?? slugify(name),
      name,
      plural_name: emptyToNull(form.get('plural_name')),
      description: emptyToNull(form.get('description')),
      level_order: levelOrder,
      scope: String(form.get('scope') ?? 'mixed'),
      is_entry_point: toBoolean(form.get('is_entry_point')),
      is_required: toBoolean(form.get('is_required')),
      allows_multiple_entities: true,
      allows_new_nodes: true,
    }

    const { data, error: saveError } = await supabase.rpc('admin_save_structure_level', { payload })

    if (saveError) {
      setError(saveError.message)
    } else {
      const result = data as RpcResult | null
      setMessage(`Nivel guardado${result?.id ? `: ${result.id}` : ''}.`)
      event.currentTarget.reset()
      await loadTemplateDetails(selectedTemplateId)
    }

    setSaving(false)
  }

  async function saveNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)

    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const levelId = String(form.get('level_id') ?? '')

    if (!selectedTemplateId) {
      setError('Primero crea o selecciona un modelo de organización.')
      setSaving(false)
      return
    }

    if (!name || !levelId) {
      setError('Selecciona el nivel y escribe el nombre de la unidad.')
      setSaving(false)
      return
    }

    const payload = {
      template_id: selectedTemplateId,
      level_id: levelId,
      parent_node_id: emptyToNull(form.get('parent_node_id')),
      name,
      official_name: emptyToNull(form.get('official_name')),
      slug: emptyToNull(form.get('slug')) ?? slugify(name),
      code: emptyToNull(form.get('code')),
      description: emptyToNull(form.get('description')),
      linked_ecclesiastical_entity_id: emptyToNull(form.get('linked_ecclesiastical_entity_id')),
      start_date: emptyToNull(form.get('start_date')) ?? todayIso(),
      status: 'active',
      visibility: String(form.get('visibility') ?? 'public'),
    }

    const { data, error: saveError } = await supabase.rpc('admin_save_structure_node', { payload })

    if (saveError) {
      setError(saveError.message)
    } else {
      const result = data as RpcResult | null
      setMessage(`Unidad agregada${result?.id ? `: ${result.id}` : ''}.`)
      event.currentTarget.reset()
      setSelectedParentNodeId('')
      await loadTemplateDetails(selectedTemplateId)
    }

    setSaving(false)
  }

  if (loadingBase) {
    return <main className="container"><div className="empty-state">Cargando configuración de estructuras...</div></main>
  }

  return (
    <main className="container dashboard-page admin-config-page structure-config-page">
      <style>{structurePageStyles}</style>
      <div className="detail-backlink">
        <Link href="/admin">← Volver al panel administrativo</Link>
      </div>

      <section className="dashboard-hero card structure-hero">
        <div>
          <p className="eyebrow">Configuración por diócesis</p>
          <h1>Cómo se organiza esta diócesis</h1>
          <p className="lead">
            Aquí no se impone una jerarquía fija. Primero eliges la diócesis, luego defines qué tipo de organización usa
            y finalmente construyes su mapa real: vicarías, zonas, parroquias, sectores, capillas u otros niveles.
          </p>
        </div>
        <div className="structure-hero-panel">
          <strong>{selectedDiocese?.name ?? 'Sin diócesis seleccionada'}</strong>
          <span>{selectedKind?.name ?? 'Estructura'} · {selectedTemplate?.name ?? 'sin modelo activo'}</span>
          <small>{sortedLevels.length} niveles · {sortedNodes.length} unidades cargadas</small>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="empty-state">{message}</div>}

      <section className="structure-steps">
        <article className="card structure-step-card">
          <span className="structure-step-number">1</span>
          <div>
            <p className="eyebrow">Diócesis</p>
            <h2>Elige dónde vas a trabajar</h2>
            <p className="meta">Cada diócesis puede tener su propio modelo, sin afectar a las demás.</p>
            <select value={selectedDioceseId} onChange={(event) => setSelectedDioceseId(event.target.value)}>
              <option value="">Seleccionar diócesis</option>
              {dioceses.map((diocese) => (
                <option key={diocese.id} value={diocese.id}>{diocese.name}</option>
              ))}
            </select>
          </div>
        </article>

        <article className="card structure-step-card">
          <span className="structure-step-number">2</span>
          <div>
            <p className="eyebrow">Tipo de organización</p>
            <h2>Qué quieres configurar</h2>
            <p className="meta">{kindHelp[activeKind]}</p>
            <div className="structure-kind-grid">
              {structureKinds.map((kind) => (
                <button
                  className={`quick-link-card structure-kind-card ${activeKind === kind.key ? 'active-filter' : ''}`}
                  key={kind.key}
                  onClick={() => setActiveKind(kind.key)}
                  type="button"
                >
                  <strong>{kind.name}</strong>
                  <span>{kind.description ?? 'Modelo configurable'}</span>
                </button>
              ))}
            </div>
          </div>
        </article>

        <article className="card structure-step-card">
          <span className="structure-step-number">3</span>
          <div>
            <p className="eyebrow">Modelo activo</p>
            <h2>Selecciona o crea el modelo</h2>
            <p className="meta">El modelo define qué niveles se permiten y cómo se enlazan.</p>
            {templates.length > 0 ? (
              <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}{template.is_primary ? ' · principal' : ''}</option>
                ))}
              </select>
            ) : (
              <p className="meta">No hay modelo para esta combinación. Crea uno debajo.</p>
            )}
            <form className="structure-inline-form" onSubmit={saveTemplate}>
              <input name="name" placeholder={buildDefaultModelName(activeKind)} />
              <input name="key" placeholder="Clave opcional" />
              <button className="button button-primary" disabled={saving || !selectedDioceseId} type="submit">
                {saving ? 'Guardando...' : 'Crear modelo'}
              </button>
            </form>
          </div>
        </article>
      </section>

      {selectedTemplate && (
        <section className="card dashboard-section structure-map-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Mapa actual</p>
              <h2>{selectedTemplate.name}</h2>
              <p className="meta">Esta es la jerarquía que usarán los formularios y filtros del sistema.</p>
            </div>
            <div className="role-list">
              <span className="role-pill">{sortedLevels.length} niveles</span>
              <span className="role-pill">{sortedNodes.length} unidades</span>
              <span className="role-pill">{rootNodes.length} raíces</span>
            </div>
          </div>

          {loadingStructure && <div className="empty-state">Actualizando mapa...</div>}

          <div className="structure-map-layout">
            <div className="structure-level-list">
              <h3>Niveles permitidos</h3>
              {sortedLevels.length === 0 && <p className="meta">Todavía no hay niveles. Agrega el primer nivel, por ejemplo “Diócesis”.</p>}
              {sortedLevels.map((level) => (
                <div className="structure-level-row" key={level.id}>
                  <span>{level.level_order}</span>
                  <div>
                    <strong>{level.name}</strong>
                    <small>Depende de: {levels.find((item) => item.id === level.parent_level_id)?.name ?? 'raíz'}</small>
                  </div>
                </div>
              ))}
            </div>

            <div className="structure-tree-list">
              <h3>Unidades cargadas</h3>
              {sortedNodes.length === 0 && <p className="meta">Todavía no hay unidades. Agrega la raíz o vincula la diócesis actual.</p>}
              {sortedNodes.map((node) => (
                <div className="structure-node-row" key={node.node_id} style={{ marginLeft: `${Math.min(node.depth, 5) * 18}px` }}>
                  <div>
                    <strong>{node.name}</strong>
                    <small>{node.level_name} · {node.parent_node_id ? `depende de ${treeNodes.find((item) => item.node_id === node.parent_node_id)?.name ?? '—'}` : 'raíz'}</small>
                  </div>
                  <span>{formatDate(node.start_date)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {selectedTemplate && (
        <section className="card dashboard-section structure-builder-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Acciones</p>
              <h2>Qué necesitas agregar</h2>
              <p className="meta">Primero se definen niveles. Luego se agregan unidades reales dentro del mapa.</p>
            </div>
          </div>

          <div className="structure-action-tabs">
            <button className={`metric-card metric-button ${builderMode === 'node' ? 'active-filter' : ''}`} onClick={() => setBuilderMode('node')} type="button">
              <strong>Agregar unidad</strong>
              <span>Vicaría Norte, Zona A, Parroquia San José, Sector 1...</span>
            </button>
            <button className={`metric-card metric-button ${builderMode === 'level' ? 'active-filter' : ''}`} onClick={() => setBuilderMode('level')} type="button">
              <strong>Agregar nivel</strong>
              <span>Sector, Vicaría, Zona Pastoral, Capilla, Comunidad...</span>
            </button>
          </div>

          {builderMode === 'level' && (
            <form className="admin-form admin-config-form structure-main-form" onSubmit={saveLevel}>
              <label>Nombre del nivel<input name="name" placeholder="Ej. Sector" /></label>
              <label>Plural<input name="plural_name" placeholder="Ej. Sectores" /></label>
              <label>Clave interna<input name="level_key" placeholder="Opcional: sector" /></label>
              <label>Orden<input name="level_order" min="1" placeholder={`${nextLevelOrder}`} type="number" /></label>
              <label>
                Depende de
                <select name="parent_level_id" defaultValue="">
                  <option value="">Sin padre / nivel raíz</option>
                  {sortedLevels.map((level) => (
                    <option key={level.id} value={level.id}>{level.level_order}. {level.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Tipo de entidad vinculado
                <select name="linked_entity_type_id" defaultValue="">
                  <option value="">Sin vínculo</option>
                  {entityTypes.map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Uso principal
                <select name="scope" defaultValue={activeKind === 'territorial' ? 'ecclesial' : activeKind}>
                  <option value="ecclesial">Eclesial</option>
                  <option value="pastoral">Pastoral</option>
                  <option value="administrative">Administrativa</option>
                  <option value="organic">Orgánica</option>
                  <option value="mixed">Mixta</option>
                </select>
              </label>
              <textarea name="description" placeholder="Descripción del nivel o criterio de uso" />
              <label className="role-pill"><input name="is_entry_point" type="checkbox" /> Puede iniciar un formulario</label>
              <label className="role-pill"><input name="is_required" type="checkbox" /> Nivel obligatorio</label>
              <button className="button button-primary" disabled={saving} type="submit">
                {saving ? 'Guardando...' : 'Guardar nivel'}
              </button>
            </form>
          )}

          {builderMode === 'node' && (
            <form className="admin-form admin-config-form structure-main-form" onSubmit={saveNode}>
              <label>
                Depende de
                <select
                  name="parent_node_id"
                  value={selectedParentNodeId}
                  onChange={(event) => setSelectedParentNodeId(event.target.value)}
                >
                  <option value="">Sin padre / raíz</option>
                  {sortedNodes.map((node) => (
                    <option key={node.node_id} value={node.node_id}>{'— '.repeat(node.depth)}{node.name} · {node.level_name}</option>
                  ))}
                </select>
              </label>
              <label>
                Nivel permitido
                <select name="level_id" defaultValue="">
                  <option value="">Seleccionar nivel</option>
                  {childLevelOptions.map((option) => (
                    <option key={option.level_id} value={option.level_id}>{option.level_order}. {option.level_name}</option>
                  ))}
                </select>
              </label>
              <label>Nombre de la unidad<input name="name" placeholder="Ej. Vicaría Norte" /></label>
              <label>Nombre oficial<input name="official_name" placeholder="Opcional" /></label>
              <label>Código<input name="code" placeholder="Opcional" /></label>
              <label>
                Vincular con entidad existente
                <select name="linked_ecclesiastical_entity_id" defaultValue="">
                  <option value="">No vincular todavía</option>
                  {entities.map((entity) => (
                    <option key={entity.id} value={entity.id}>{entity.name}</option>
                  ))}
                </select>
              </label>
              <label>Fecha de inicio<input name="start_date" type="date" /></label>
              <label>
                Visibilidad
                <select name="visibility" defaultValue="public">
                  <option value="public">Público</option>
                  <option value="authenticated">Solo usuarios autenticados</option>
                  <option value="restricted">Restringido</option>
                  <option value="private">Privado</option>
                </select>
              </label>
              <textarea name="description" placeholder="Fuente, nota o explicación" />
              <button className="button button-primary" disabled={saving || childLevelOptions.length === 0} type="submit">
                {saving ? 'Guardando...' : 'Agregar unidad'}
              </button>
              {childLevelOptions.length === 0 && (
                <p className="meta">No hay niveles permitidos para el padre seleccionado. Agrega primero el nivel correspondiente.</p>
              )}
            </form>
          )}
        </section>
      )}
    </main>
  )
}
