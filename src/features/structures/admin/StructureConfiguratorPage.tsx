'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>
type StructureKindKey = 'territorial' | 'pastoral' | 'administrative' | 'organic'

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

type StructurePresetLevel = {
  levelKey: string
  name: string
  pluralName: string
  scope?: string
  entityTypeKeys?: string[]
}

type StructurePreset = {
  key: string
  title: string
  description: string
  levels: StructurePresetLevel[]
}

type RpcResult = {
  success?: boolean
  id?: string
  message?: string
}

const fixedJurisdictionKeys = ['country', 'ecclesiastical_province', 'archdiocese', 'diocese', 'military_ordinariate']
const allowedKindKeys: StructureKindKey[] = ['territorial', 'pastoral', 'administrative', 'organic']

const fallbackKinds: StructureKind[] = [
  { key: 'territorial', name: 'Territorial', description: 'Provincia, diócesis, vicarías, zonas, parroquias, sectores y capillas.' },
  { key: 'pastoral', name: 'Pastoral', description: 'Áreas, comisiones, movimientos, comunidades y servicios.' },
  { key: 'administrative', name: 'Administrativa', description: 'Curia, oficinas, departamentos y dependencias internas.' },
  { key: 'organic', name: 'Orgánica', description: 'Organigramas, unidades y líneas de responsabilidad.' },
]

const structurePresets: StructurePreset[] = [
  {
    key: 'zona-parroquia',
    title: 'Zona pastoral → Parroquia',
    description: 'Para diócesis que organizan directamente sus parroquias por zonas pastorales.',
    levels: [
      { levelKey: 'zona-pastoral', name: 'Zona Pastoral', pluralName: 'Zonas Pastorales', scope: 'pastoral' },
      { levelKey: 'parroquia', name: 'Parroquia', pluralName: 'Parroquias', scope: 'ecclesial', entityTypeKeys: ['parish'] },
    ],
  },
  {
    key: 'vicaria-zona-parroquia',
    title: 'Vicaría → Zona → Parroquia',
    description: 'Para arquidiócesis o diócesis con vicarías como nivel intermedio superior.',
    levels: [
      { levelKey: 'vicaria', name: 'Vicaría', pluralName: 'Vicarías', scope: 'pastoral' },
      { levelKey: 'zona-pastoral', name: 'Zona Pastoral', pluralName: 'Zonas Pastorales', scope: 'pastoral' },
      { levelKey: 'parroquia', name: 'Parroquia', pluralName: 'Parroquias', scope: 'ecclesial', entityTypeKeys: ['parish'] },
    ],
  },
  {
    key: 'vicaria-zona-parroquia-sector',
    title: 'Vicaría → Zona → Parroquia → Sector',
    description: 'Para estructuras con sectores bajo parroquias o unidades territoriales menores.',
    levels: [
      { levelKey: 'vicaria', name: 'Vicaría', pluralName: 'Vicarías', scope: 'pastoral' },
      { levelKey: 'zona-pastoral', name: 'Zona Pastoral', pluralName: 'Zonas Pastorales', scope: 'pastoral' },
      { levelKey: 'parroquia', name: 'Parroquia', pluralName: 'Parroquias', scope: 'ecclesial', entityTypeKeys: ['parish'] },
      { levelKey: 'sector', name: 'Sector', pluralName: 'Sectores', scope: 'pastoral' },
    ],
  },
  {
    key: 'area-comision-equipo',
    title: 'Área pastoral → Comisión → Equipo',
    description: 'Para organizar unidades funcionales no territoriales, pastorales o administrativas.',
    levels: [
      { levelKey: 'area-pastoral', name: 'Área Pastoral', pluralName: 'Áreas Pastorales', scope: 'pastoral' },
      { levelKey: 'comision', name: 'Comisión', pluralName: 'Comisiones', scope: 'pastoral' },
      { levelKey: 'equipo', name: 'Equipo', pluralName: 'Equipos', scope: 'pastoral' },
    ],
  },
]

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

  .structure-catalog textarea { min-height: 90px; resize: vertical; }

  .structure-catalog-hero {
    align-items: stretch;
    grid-template-columns: minmax(0, 1fr) minmax(260px, 0.36fr);
  }

  .structure-catalog-summary,
  .catalog-fixed { background: #fbf8f1; }

  .structure-catalog-summary {
    border: 1px solid var(--border);
    border-radius: 18px;
    display: grid;
    gap: 8px;
    padding: 20px;
  }

  .structure-catalog-summary strong { font-size: 22px; line-height: 1.2; }

  .structure-catalog-summary span,
  .structure-catalog-summary small,
  .catalog-level small,
  .catalog-node small,
  .catalog-preset-card small,
  .catalog-kind-card span {
    color: var(--muted);
    font-size: 13px;
    line-height: 1.45;
  }

  .structure-toolbar,
  .catalog-kind-grid,
  .catalog-form-grid,
  .catalog-tabs,
  .catalog-layout,
  .catalog-preset-grid {
    display: grid;
    gap: 14px;
  }

  .structure-toolbar {
    align-items: end;
    grid-template-columns: minmax(260px, 1fr) minmax(220px, 0.8fr) minmax(220px, 0.8fr);
  }

  .catalog-layout {
    align-items: start;
    grid-template-columns: minmax(280px, 0.82fr) minmax(0, 1.18fr);
  }

  .catalog-form-grid,
  .catalog-tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .catalog-preset-grid,
  .catalog-kind-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }

  .catalog-column,
  .catalog-form,
  .catalog-preset-card,
  .catalog-kind-card {
    display: grid;
    gap: 12px;
  }

  .structure-toolbar label,
  .catalog-form label {
    color: var(--muted);
    display: grid;
    font-size: 14px;
    font-weight: 800;
    gap: 7px;
  }

  .catalog-node,
  .catalog-level,
  .catalog-preset-card,
  .catalog-kind-card {
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 14px;
  }

  .catalog-kind-card {
    appearance: none;
    color: inherit;
    cursor: pointer;
    font: inherit;
    min-height: 112px;
    text-align: left;
  }

  .catalog-kind-card strong {
    color: var(--foreground);
    font-size: 17px;
    line-height: 1.2;
  }

  .catalog-level-header,
  .catalog-node-header,
  .catalog-preset-header {
    align-items: center;
    display: flex;
    gap: 10px;
    justify-content: space-between;
  }

  .catalog-badge,
  .catalog-mini-button {
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 12px;
    font-weight: 900;
    padding: 7px 10px;
  }

  .catalog-badge {
    background: #fbf8f1;
    color: var(--primary);
    display: inline-flex;
    justify-content: center;
    min-width: 76px;
  }

  .catalog-mini-button {
    background: #fff;
    color: var(--primary);
    cursor: pointer;
    font: inherit;
  }

  .catalog-level-actions,
  .catalog-preset-steps {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .catalog-preset-card h3 { font-size: 18px; line-height: 1.2; margin: 0; }

  .catalog-preset-steps span {
    background: #fbf8f1;
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--muted);
    font-size: 12px;
    font-weight: 800;
    padding: 7px 10px;
  }

  .catalog-tabs .metric-card strong { font-size: 24px; }

  .catalog-help {
    background: #fbf8f1;
    border: 1px dashed var(--border);
    border-radius: 16px;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.55;
    padding: 14px;
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
    .catalog-tabs,
    .catalog-preset-grid,
    .catalog-kind-grid { grid-template-columns: 1fr; }
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

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

function isFixedJurisdictionLevel(level: Pick<StructureLevel, 'level_key' | 'name'>) {
  return fixedJurisdictionKeys.includes(level.level_key) || /pa[ií]s|provincia eclesi[aá]stica|arquidi[oó]cesis|di[oó]cesis|ordinariato/i.test(level.name)
}

function isStructureKindKey(value: string | null): value is StructureKindKey {
  return !!value && allowedKindKeys.includes(value as StructureKindKey)
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
  const [draftParentLevelId, setDraftParentLevelId] = useState<string | null>(null)
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
  const sortedNodes = [...treeNodes].sort((a, b) => a.path_names.join(' / ').localeCompare(b.path_names.join(' / '), 'es'))
  const rootNode = sortedNodes.find((node) => !node.parent_node_id) ?? null
  const selectedParentNode = treeNodes.find((node) => node.node_id === selectedParentNodeId) ?? null
  const effectiveParentLevelId = selectedParentNode?.level_id ?? rootJurisdictionLevel?.id ?? null
  const selectedKind = structureKinds.find((kind) => kind.key === activeKind) ?? fallbackKinds.find((kind) => kind.key === activeKind)
  const nextVisibleLevel = customLevels.length > 0 ? Math.max(...customLevels.map(visibleLevelOrder)) + 1 : 3

  function levelName(id: string | null) {
    if (!id) return 'Nivel 2 · Diócesis / Arquidiócesis'
    const level = levels.find((item) => item.id === id)
    return level ? `Nivel ${visibleLevelOrder(level)} · ${level.name}` : 'Nivel no encontrado'
  }

  function childLevelLabel(option: ChildLevelOption) {
    return `Nivel ${option.level_order + 1} · ${option.level_name}`
  }

  function entityTypeIdByKeys(keys?: string[]) {
    if (!keys || keys.length === 0) return null
    return entityTypes.find((type) => keys.includes(type.key))?.id ?? null
  }

  function resolveRequestedDiocese(loadedDioceses: EcclesiasticalEntity[]) {
    const params = new URLSearchParams(window.location.search)
    const requested = params.get('diocese') ?? params.get('diocese_id') ?? params.get('slug')
    if (!requested) return loadedDioceses[0]
    return loadedDioceses.find((diocese) => diocese.id === requested || diocese.slug === requested) ?? loadedDioceses[0]
  }

  function resolveRequestedKind() {
    const params = new URLSearchParams(window.location.search)
    const requested = params.get('kind') ?? params.get('catalog') ?? params.get('tipo')
    return isStructureKindKey(requested) ? requested : 'territorial'
  }

  function syncUrl(nextDioceseId: string, nextKind: StructureKindKey) {
    const params = new URLSearchParams(window.location.search)
    if (nextDioceseId) params.set('diocese', nextDioceseId)
    params.set('kind', nextKind)
    window.history.replaceState(null, '', `/admin/estructura?${params.toString()}`)
  }

  function changeDiocese(dioceseId: string) {
    setSelectedDioceseId(dioceseId)
    setSelectedTemplateId('')
    setSelectedParentNodeId('')
    syncUrl(dioceseId, activeKind)
  }

  function changeKind(kind: StructureKindKey) {
    setActiveKind(kind)
    setSelectedTemplateId('')
    setLevels([])
    setTreeNodes([])
    setChildLevelOptions([])
    syncUrl(selectedDioceseId, kind)
  }

  async function createRootNode(templateId: string, rootLevelId: string) {
    if (!selectedDioceseId || !selectedDiocese) return null

    const { data, error: rootError } = await supabase.rpc('admin_save_structure_node', {
      payload: {
        template_id: templateId,
        level_id: rootLevelId,
        parent_node_id: null,
        name: selectedDiocese.name,
        official_name: selectedDiocese.official_name,
        slug: selectedDiocese.slug || slugify(selectedDiocese.name),
        linked_ecclesiastical_entity_id: selectedDioceseId,
        start_date: todayIso(),
        status: 'active',
        visibility: 'public',
      },
    })

    if (rootError) throw new Error(rootError.message)
    return (data as RpcResult | null)?.id ?? null
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
    const requestedDiocese = resolveRequestedDiocese(loadedDioceses)
    const requestedKind = resolveRequestedKind()

    setEntities(loadedEntities)
    setDioceses(loadedDioceses)
    setStructureKinds(((kindRes.data ?? []) as StructureKind[]).length > 0 ? (kindRes.data as StructureKind[]) : fallbackKinds)
    setEntityTypes((entityTypeRes.data ?? []) as EntityType[])
    setActiveKind(requestedKind)

    if (requestedDiocese) {
      setSelectedDioceseId(requestedDiocese.id)
    } else if (!selectedDioceseId && loadedDioceses[0]) {
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

    const loadedLevels = (levelRes.data ?? []) as StructureLevel[]
    let loadedNodes = (treeRes.data ?? []) as StructureTreeNode[]
    const loadedRootLevel = loadedLevels.find((level) => fixedJurisdictionKeys.includes(level.level_key)) ?? loadedLevels.find(isFixedJurisdictionLevel) ?? null

    if (loadedRootLevel && loadedNodes.length === 0 && selectedDioceseId && selectedDiocese) {
      try {
        await createRootNode(templateId, loadedRootLevel.id)
        const { data: refreshedTree, error: refreshedTreeError } = await supabase.rpc('get_structure_tree', {
          p_template_id: templateId,
          p_root_node_id: null,
          p_as_of: todayIso(),
          p_include_inactive: false,
        })
        if (refreshedTreeError) setError(refreshedTreeError.message)
        loadedNodes = (refreshedTree ?? []) as StructureTreeNode[]
      } catch (rootError) {
        setError(rootError instanceof Error ? rootError.message : 'No se pudo crear la raíz de la diócesis.')
      }
    }

    setLevels(loadedLevels)
    setTreeNodes(loadedNodes)

    if (selectedParentNodeId && !loadedNodes.some((node) => node.node_id === selectedParentNodeId)) {
      setSelectedParentNodeId('')
    }

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
    setDraftParentLevelId(null)
    setSelectedParentNodeId('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId])

  useEffect(() => {
    loadChildLevelOptions(selectedTemplateId, effectiveParentLevelId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId, effectiveParentLevelId])

  async function createModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const form = new FormData(event.currentTarget)
      const name = String(form.get('name') ?? '').trim()

      if (!selectedDioceseId || !selectedDiocese || !name) {
        throw new Error('Selecciona una diócesis y escribe el nombre del catálogo.')
      }

      const { data: templateData, error: templateError } = await supabase.rpc('admin_save_structure_template', {
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

      if (templateError) throw new Error(templateError.message)
      const templateId = (templateData as RpcResult | null)?.id
      if (!templateId) throw new Error('No se recibió el identificador del catálogo creado.')

      const dioceseType = entityTypes.find((type) => ['archdiocese', 'diocese', 'military_ordinariate'].includes(type.key))
      const { data: levelData, error: levelError } = await supabase.rpc('admin_save_structure_level', {
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

      if (levelError) throw new Error(levelError.message)
      const rootLevelId = (levelData as RpcResult | null)?.id
      if (!rootLevelId) throw new Error('No se recibió el nivel raíz del catálogo.')

      await createRootNode(templateId, rootLevelId)
      setSelectedTemplateId(templateId)
      setMessage('Catálogo creado. Ahora agrega niveles desde el nivel 3 y luego sus unidades.')
      event.currentTarget.reset()
      await loadTemplates(selectedDioceseId, activeKind)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo crear el catálogo.')
    } finally {
      setSaving(false)
    }
  }

  async function saveLevel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const form = new FormData(event.currentTarget)
      const name = String(form.get('name') ?? '').trim()
      const displayOrder = Number(form.get('display_order') ?? 3)
      const parentValue = String(form.get('parent_level_id') ?? '__diocese__')
      const parentLevelId = parentValue === '__diocese__' ? rootJurisdictionLevel?.id ?? null : emptyToNull(parentValue)

      if (!selectedTemplateId || !name || !Number.isFinite(displayOrder) || displayOrder < 3) {
        throw new Error('Completa el nivel. Los niveles personalizados comienzan desde el nivel 3.')
      }

      if (!parentLevelId) {
        throw new Error('El catálogo necesita la raíz de Diócesis / Arquidiócesis antes de agregar niveles hijos.')
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

      if (saveError) throw new Error(saveError.message)
      const result = data as RpcResult | null
      setMessage(result?.id === editingLevelId ? 'Nivel actualizado y movido correctamente.' : 'Nivel agregado al catálogo.')
      setEditingLevelId('')
      setDraftParentLevelId(null)
      event.currentTarget.reset()
      await loadTemplateDetails(selectedTemplateId)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el nivel.')
    } finally {
      setSaving(false)
    }
  }

  async function applyPreset(preset: StructurePreset) {
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      if (!selectedTemplateId || !rootJurisdictionLevel) {
        throw new Error('Selecciona o crea un catálogo antes de aplicar una plantilla.')
      }

      let parentLevelId = rootJurisdictionLevel.id
      let createdCount = 0
      let reusedCount = 0

      for (const [index, presetLevel] of preset.levels.entries()) {
        const existingLevel = customLevels.find((level) => level.level_key === presetLevel.levelKey)

        if (existingLevel) {
          parentLevelId = existingLevel.id
          reusedCount += 1
          continue
        }

        const { data, error: presetError } = await supabase.rpc('admin_save_structure_level', {
          payload: {
            template_id: selectedTemplateId,
            parent_level_id: parentLevelId,
            linked_entity_type_id: entityTypeIdByKeys(presetLevel.entityTypeKeys),
            level_key: presetLevel.levelKey,
            name: presetLevel.name,
            plural_name: presetLevel.pluralName,
            description: `Nivel creado desde la plantilla ${preset.title}.`,
            level_order: dbOrderFromVisibleLevel(index + 3),
            scope: presetLevel.scope ?? 'ecclesial',
            is_entry_point: index === 0,
            is_required: true,
            allows_multiple_entities: true,
            allows_new_nodes: true,
          },
        })

        if (presetError) throw new Error(presetError.message)
        const result = data as RpcResult | null
        if (!result?.id) throw new Error(`No se recibió el identificador para el nivel ${presetLevel.name}.`)
        parentLevelId = result.id
        createdCount += 1
      }

      await loadTemplateDetails(selectedTemplateId)
      setMode('unit')
      setMessage(`Plantilla aplicada: ${preset.title}. Niveles creados: ${createdCount}. Niveles ya existentes reutilizados: ${reusedCount}.`)
    } catch (presetError) {
      setError(presetError instanceof Error ? presetError.message : 'No se pudo aplicar la plantilla.')
    } finally {
      setSaving(false)
    }
  }

  async function saveUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const form = new FormData(event.currentTarget)
      const name = String(form.get('name') ?? '').trim()
      const levelId = String(form.get('level_id') ?? '')
      const parentNodeId = emptyToNull(form.get('parent_node_id')) ?? rootNode?.node_id ?? null

      if (!selectedTemplateId || !name || !levelId) {
        throw new Error('Selecciona el padre, el nivel permitido y el nombre de la unidad.')
      }

      if (!rootNode) {
        throw new Error('El catálogo todavía no tiene raíz operativa. Cambia de modelo y vuelve a entrar, o crea de nuevo el catálogo.')
      }

      const { data, error: saveError } = await supabase.rpc('admin_save_structure_node', {
        payload: {
          template_id: selectedTemplateId,
          level_id: levelId,
          parent_node_id: parentNodeId,
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

      if (saveError) throw new Error(saveError.message)
      const result = data as RpcResult | null
      setMessage(`Unidad agregada${result?.id ? `: ${result.id}` : ''}.`)
      event.currentTarget.reset()
      setSelectedParentNodeId('')
      await loadTemplateDetails(selectedTemplateId)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo agregar la unidad.')
    } finally {
      setSaving(false)
    }
  }

  if (loadingBase) {
    return <main className="container"><div className="empty-state">Cargando catálogo de estructura...</div></main>
  }

  return (
    <main className="container dashboard-page admin-config-page structure-catalog">
      <style>{pageStyles}</style>
      <div className="detail-backlink"><Link href="/admin">← Volver al panel administrativo</Link></div>

      <section className="dashboard-hero card structure-catalog-hero">
        <div>
          <p className="eyebrow">Catálogo jerárquico</p>
          <h1>Estructura de la diócesis</h1>
          <p className="lead">La base es fija: nivel 1 provincia eclesiástica y nivel 2 diócesis o arquidiócesis. Desde el nivel 3 puedes crear, mover y ordenar los niveles propios de cada diócesis.</p>
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
          <label>Diócesis
            <select value={selectedDioceseId} onChange={(event) => changeDiocese(event.target.value)}>
              <option value="">Seleccionar diócesis</option>
              {dioceses.map((diocese) => <option key={diocese.id} value={diocese.id}>{diocese.name}</option>)}
            </select>
          </label>
          <label>Catálogo
            <select value={activeKind} onChange={(event) => changeKind(event.target.value as StructureKindKey)}>
              {structureKinds.map((kind) => <option key={kind.key} value={kind.key}>{kind.name}</option>)}
            </select>
          </label>
          <label>Modelo activo
            <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
              <option value="">Crear o seleccionar</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}{template.is_primary ? ' · principal' : ''}</option>)}
            </select>
          </label>
        </div>

        <div className="catalog-kind-grid" aria-label="Tipos de catálogo">
          {structureKinds.map((kind) => (
            <button className={`catalog-kind-card ${activeKind === kind.key ? 'active-filter' : ''}`} key={kind.key} onClick={() => changeKind(kind.key)} type="button">
              <strong>{kind.name}</strong>
              <span>{kind.description ?? 'Catálogo configurable por diócesis.'}</span>
            </button>
          ))}
        </div>

        {!selectedTemplate && (
          <form className="catalog-form" onSubmit={createModel}>
            <div className="catalog-form-grid">
              <label>Nombre del catálogo<input name="name" placeholder={defaultModelName(activeKind)} /></label>
              <label>Clave opcional<input name="key" placeholder={`${activeKind}-principal`} /></label>
            </div>
            <button className="button button-primary" disabled={saving || !selectedDioceseId} type="submit">{saving ? 'Creando...' : 'Crear catálogo para esta diócesis'}</button>
          </form>
        )}
      </section>

      {selectedTemplate && (
        <section className="card dashboard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Plantillas rápidas</p>
              <h2>Crear niveles comunes sin escribirlos uno por uno</h2>
              <p className="meta">Selecciona una plantilla para insertar niveles debajo de la diócesis. Si un nivel ya existe por clave interna, se reutiliza y no se duplica.</p>
            </div>
          </div>

          <div className="catalog-preset-grid">
            {structurePresets.map((preset) => (
              <article className="catalog-preset-card" key={preset.key}>
                <div className="catalog-preset-header">
                  <h3>{preset.title}</h3>
                  <span className="catalog-badge">{preset.levels.length} niveles</span>
                </div>
                <small>{preset.description}</small>
                <div className="catalog-preset-steps">
                  {preset.levels.map((level) => <span key={level.levelKey}>{level.name}</span>)}
                </div>
                <button className="button button-secondary" disabled={saving || !rootJurisdictionLevel} onClick={() => applyPreset(preset)} type="button">
                  {saving ? 'Aplicando...' : 'Aplicar plantilla'}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {selectedTemplate && (
        <section className="catalog-layout">
          <div className="card dashboard-section catalog-column">
            <div>
              <p className="eyebrow">Niveles del catálogo</p>
              <h2>Árbol de niveles</h2>
              <p className="meta">Primero crea el nivel, después agregas unidades dentro de ese nivel.</p>
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
                <div className="catalog-level-header"><strong>Nivel {visibleLevelOrder(level)} · {level.name}</strong><span className="catalog-badge">Editable</span></div>
                <small>Padre: {levelName(level.parent_level_id)}</small>
                <div className="catalog-level-actions">
                  <button className="catalog-mini-button" onClick={() => { setEditingLevelId(level.id); setDraftParentLevelId(null); setMode('level') }} type="button">Editar / mover</button>
                  <button className="catalog-mini-button" onClick={() => { setEditingLevelId(''); setDraftParentLevelId(level.id); setMode('level') }} type="button">Agregar hija</button>
                </div>
              </div>
            ))}

            {customLevels.length === 0 && <p className="catalog-help">Todavía no hay niveles personalizados. Puedes usar una plantilla rápida o agregar primero el nivel 3 manualmente, por ejemplo “Vicaría”, “Zona Pastoral” o “Área Pastoral”.</p>}
          </div>

          <div className="card dashboard-section catalog-column">
            <div>
              <p className="eyebrow">Unidades del árbol</p>
              <h2>Provincia → Diócesis → unidades</h2>
              <p className="meta">Aquí se agregan las unidades reales: vicaría, zona, parroquia, capilla, comunidad o institución.</p>
            </div>

            {loadingStructure && <div className="empty-state">Actualizando árbol...</div>}

            <div className="catalog-node catalog-fixed">
              <div className="catalog-node-header"><strong>Nivel 1 · Provincia eclesiástica</strong><span className="catalog-badge">Base</span></div>
              <small>Se resolverá desde la provincia eclesiástica oficial de la diócesis.</small>
            </div>
            <div className="catalog-node catalog-fixed">
              <div className="catalog-node-header"><strong>Nivel 2 · {selectedDiocese?.name ?? 'Diócesis'}</strong><span className="catalog-badge">Base</span></div>
              <small>{rootNode ? 'Raíz operativa lista.' : 'Preparando raíz operativa...'}</small>
            </div>

            {sortedNodes.filter((node) => !isFixedJurisdictionLevel({ level_key: node.level_key, name: node.level_name })).map((node) => (
              <div className="catalog-node" key={node.node_id} style={{ marginLeft: `${Math.min(node.depth, 5) * 18}px` }}>
                <div className="catalog-node-header"><strong>Nivel {node.depth + 2} · {node.name}</strong><span className="catalog-badge">{node.level_name}</span></div>
                <small>{node.parent_node_id ? `Depende de ${treeNodes.find((item) => item.node_id === node.parent_node_id)?.name ?? '—'}` : 'Depende de la diócesis'} · desde {formatDate(node.start_date)}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {selectedTemplate && (
        <section className="card dashboard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Acciones rápidas</p>
              <h2>{mode === 'level' ? editingLevel ? 'Editar o mover nivel' : 'Agregar nivel personalizado' : 'Agregar unidad al árbol'}</h2>
              <p className="meta">Primero crea niveles. Luego selecciona padre y nivel permitido para agregar unidades.</p>
            </div>
          </div>

          <div className="catalog-tabs">
            <button className={`metric-card metric-button ${mode === 'unit' ? 'active-filter' : ''}`} onClick={() => setMode('unit')} type="button"><strong>Agregar unidad</strong><span>Vicaría, zona, parroquia, capilla, institución...</span></button>
            <button className={`metric-card metric-button ${mode === 'level' ? 'active-filter' : ''}`} onClick={() => { setMode('level'); setEditingLevelId(''); setDraftParentLevelId(null) }} type="button"><strong>Agregar / mover nivel</strong><span>Cambiar Vicaría a nivel 3, crear Sector como hija...</span></button>
          </div>

          {mode === 'level' && (
            <form className="catalog-form" key={`${editingLevel?.id ?? 'new-level'}-${draftParentLevelId ?? 'root'}`} onSubmit={saveLevel}>
              <input name="id" type="hidden" value={editingLevel?.id ?? ''} readOnly />
              <div className="catalog-form-grid">
                <label>Nombre del nivel<input name="name" defaultValue={editingLevel?.name ?? ''} placeholder="Ej. Vicaría" /></label>
                <label>Plural<input name="plural_name" defaultValue={editingLevel?.plural_name ?? ''} placeholder="Ej. Vicarías" /></label>
                <label>Nivel visible<input name="display_order" defaultValue={editingLevel ? visibleLevelOrder(editingLevel) : nextVisibleLevel} min="3" type="number" /></label>
                <label>Clave interna<input name="level_key" defaultValue={editingLevel?.level_key ?? ''} placeholder="Opcional" /></label>
                <label>Padre
                  <select name="parent_level_id" defaultValue={editingLevel?.parent_level_id ?? draftParentLevelId ?? '__diocese__'}>
                    <option value="__diocese__">Nivel 2 · Diócesis / Arquidiócesis</option>
                    {customLevels.filter((level) => level.id !== editingLevel?.id).map((level) => <option key={level.id} value={level.id}>Nivel {visibleLevelOrder(level)} · {level.name}</option>)}
                  </select>
                </label>
                <label>Tipo vinculado
                  <select name="linked_entity_type_id" defaultValue={editingLevel?.linked_entity_type_id ?? ''}>
                    <option value="">Sin vínculo</option>
                    {entityTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </select>
                </label>
                <label>Uso
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
                <label>Padre
                  <select name="parent_node_id" value={selectedParentNodeId} onChange={(event) => setSelectedParentNodeId(event.target.value)}>
                    <option value="">Nivel 2 · Diócesis / Arquidiócesis</option>
                    {sortedNodes.filter((node) => !isFixedJurisdictionLevel({ level_key: node.level_key, name: node.level_name })).map((node) => <option key={node.node_id} value={node.node_id}>{'— '.repeat(node.depth)}{node.name} · {node.level_name}</option>)}
                  </select>
                </label>
                <label>Nivel permitido
                  <select name="level_id" defaultValue="" disabled={childLevelOptions.length === 0}>
                    <option value="">Seleccionar nivel</option>
                    {childLevelOptions.map((option) => <option key={option.level_id} value={option.level_id}>{childLevelLabel(option)}</option>)}
                  </select>
                </label>
                <label>Nombre<input name="name" placeholder="Ej. Vicaría Norte" /></label>
                <label>Nombre oficial<input name="official_name" placeholder="Opcional" /></label>
                <label>Código<input name="code" placeholder="Opcional" /></label>
                <label>Vincular entidad existente
                  <select name="linked_ecclesiastical_entity_id" defaultValue="">
                    <option value="">No vincular todavía</option>
                    {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
                  </select>
                </label>
                <label>Fecha de inicio<input name="start_date" type="date" /></label>
              </div>
              <textarea name="description" placeholder="Fuente o nota" />
              {childLevelOptions.length === 0 && <p className="catalog-help">No hay un nivel permitido debajo del padre seleccionado. Usa una plantilla rápida o ve a “Agregar / mover nivel” y crea primero un nivel hijo, por ejemplo “Área Pastoral”, “Vicaría” o “Zona Pastoral”.</p>}
              <button className="button button-primary" disabled={saving || childLevelOptions.length === 0 || !rootNode} type="submit">{saving ? 'Guardando...' : 'Agregar unidad'}</button>
            </form>
          )}
        </section>
      )}
    </main>
  )
}
