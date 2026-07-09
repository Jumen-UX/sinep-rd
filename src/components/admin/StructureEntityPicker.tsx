'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type EntityTypeRelation = { key: string; name: string }

type DioceseOption = {
  id: string
  name: string
  official_name: string | null
  slug: string
  entity_types: EntityTypeRelation[] | EntityTypeRelation | null
}

type StructureTemplate = {
  id: string
  diocese_id: string
  kind_key: string
  key: string
  name: string
  description: string | null
  is_primary: boolean
  is_active: boolean
  status: string
}

type StructureNode = {
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

type Group = {
  parentNodeId: string | null
  depth: number
  label: string
  selectedNodeId: string
  nodes: StructureNode[]
}

type CreateNodeResponse = {
  entity_id?: string
  node_id?: string
  error?: string
}

type Props = {
  name: string
  value: string
  label: string
  help?: string
  kindKey?: string
  allowCreate?: boolean
  createEntityTypeKey?: string
  createButtonLabel?: string
  emptyLabel?: string
  onChange: (value: string) => void
}

const dioceseEntityTypeKeys = ['archdiocese', 'diocese', 'military_ordinariate', 'ordinariate', 'apostolic_vicariate', 'vicariate']

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

function toEntityTypes(entity: Pick<DioceseOption, 'entity_types'>) {
  if (!entity.entity_types) return []
  return Array.isArray(entity.entity_types) ? entity.entity_types : [entity.entity_types]
}

function hasEntityType(entity: Pick<DioceseOption, 'entity_types'>, keys: string[]) {
  return toEntityTypes(entity).some((type) => keys.includes(type.key))
}

function isDioceseLike(entity: DioceseOption) {
  return hasEntityType(entity, dioceseEntityTypeKeys) || /di[oó]cesis|arquidi[oó]cesis|ordinariato|vicariato apost[oó]lico/i.test(entity.name)
}

function directChildren(nodes: StructureNode[], parentNodeId: string | null) {
  return nodes
    .filter((node) => node.parent_node_id === parentNodeId)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

function buildGroups(nodes: StructureNode[], rootNode: StructureNode | null, selectedPath: string[]): Group[] {
  if (!rootNode) return []

  const groups: Group[] = []
  let parentNodeId: string | null = rootNode.node_id
  let depth = 0

  while (parentNodeId) {
    const children = directChildren(nodes, parentNodeId)
    if (children.length === 0) break

    const selectedNodeId = selectedPath[depth] ?? ''
    const label = children[0]?.level_name ?? `Nivel ${depth + 1}`

    groups.push({ parentNodeId, depth, label, selectedNodeId, nodes: children })

    if (!selectedNodeId) break
    parentNodeId = selectedNodeId
    depth += 1
  }

  return groups
}

export default function StructureEntityPicker({
  name,
  value,
  label,
  help,
  kindKey = 'territorial',
  allowCreate = false,
  createEntityTypeKey = 'parish',
  createButtonLabel = 'No aparece, agregar aquí',
  emptyLabel = 'Sin unidad seleccionada',
  onChange,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [dioceses, setDioceses] = useState<DioceseOption[]>([])
  const [dioceseId, setDioceseId] = useState('')
  const [templates, setTemplates] = useState<StructureTemplate[]>([])
  const [templateId, setTemplateId] = useState('')
  const [nodes, setNodes] = useState<StructureNode[]>([])
  const [selectedPath, setSelectedPath] = useState<string[]>([])
  const [childLevels, setChildLevels] = useState<ChildLevelOption[]>([])
  const [newLevelId, setNewLevelId] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const selectedNode = nodes.find((node) => node.linked_ecclesiastical_entity_id === value) ?? null
  const rootNode = nodes.find((node) => !node.parent_node_id) ?? null
  const groups = buildGroups(nodes, rootNode, selectedPath)
  const currentParentNodeId = selectedPath.length > 0 ? selectedPath[selectedPath.length - 1] : rootNode?.node_id ?? null
  const currentParentNode = nodes.find((node) => node.node_id === currentParentNodeId) ?? rootNode
  const currentParentEntityId = currentParentNode?.linked_ecclesiastical_entity_id ?? dioceseId
  const selectedTemplate = templates.find((template) => template.id === templateId) ?? null

  useEffect(() => {
    async function loadDioceses() {
      setLoading(true)
      setLocalError(null)

      const { data, error } = await supabase
        .from('ecclesiastical_entities')
        .select('id,name,official_name,slug,entity_types(key,name)')
        .eq('status', 'active')
        .order('name')

      if (error) {
        setLocalError(error.message)
        setLoading(false)
        return
      }

      const loaded = ((data ?? []) as unknown as DioceseOption[]).filter((item) => isDioceseLike(item))
      setDioceses(loaded)
      setLoading(false)
    }

    loadDioceses()
  }, [supabase])

  useEffect(() => {
    async function loadTemplates() {
      if (!dioceseId) {
        setTemplates([])
        setTemplateId('')
        setNodes([])
        setSelectedPath([])
        return
      }

      setLocalError(null)
      const { data, error } = await supabase.rpc('get_structure_templates', {
        p_diocese_id: dioceseId,
        p_kind_key: kindKey,
        p_active_only: true,
      })

      if (error) {
        setLocalError(error.message)
        setTemplates([])
        setTemplateId('')
        return
      }

      const loaded = (data ?? []) as StructureTemplate[]
      setTemplates(loaded)
      const preferred = loaded.find((template) => template.is_primary) ?? loaded[0]
      setTemplateId(preferred?.id ?? '')
    }

    loadTemplates()
  }, [dioceseId, kindKey, supabase])

  useEffect(() => {
    async function loadTree() {
      if (!templateId) {
        setNodes([])
        setSelectedPath([])
        return
      }

      setLocalError(null)
      const { data, error } = await supabase.rpc('get_structure_tree', {
        p_template_id: templateId,
        p_root_node_id: null,
        p_as_of: todayIso(),
        p_include_inactive: false,
      })

      if (error) {
        setLocalError(error.message)
        setNodes([])
        setSelectedPath([])
        return
      }

      const loaded = (data ?? []) as StructureNode[]
      setNodes(loaded)

      if (value) {
        const match = loaded.find((node) => node.linked_ecclesiastical_entity_id === value)
        if (match) {
          const rootId = loaded.find((node) => !node.parent_node_id)?.node_id
          setSelectedPath(match.path_ids.filter((id) => id !== rootId))
        }
      }
    }

    loadTree()
  }, [templateId, value, supabase])

  useEffect(() => {
    async function loadChildLevels() {
      if (!templateId || !currentParentNode?.level_id) {
        setChildLevels([])
        setNewLevelId('')
        return
      }

      const { data, error } = await supabase.rpc('get_structure_child_level_options', {
        p_template_id: templateId,
        p_parent_level_id: currentParentNode.level_id,
      })

      if (error) {
        setLocalError(error.message)
        setChildLevels([])
        setNewLevelId('')
        return
      }

      const loaded = (data ?? []) as ChildLevelOption[]
      setChildLevels(loaded)
      setNewLevelId(loaded[0]?.level_id ?? '')
    }

    loadChildLevels()
  }, [templateId, currentParentNode?.level_id, supabase])

  function handleDioceseChange(nextDioceseId: string) {
    setDioceseId(nextDioceseId)
    setSelectedPath([])
    onChange('')
  }

  function handleGroupChange(depth: number, nodeId: string) {
    const nextPath = [...selectedPath.slice(0, depth), nodeId].filter(Boolean)
    setSelectedPath(nextPath)

    const node = nodes.find((item) => item.node_id === nodeId)
    onChange(node?.linked_ecclesiastical_entity_id ?? '')
  }

  async function createAndSelectNode() {
    setLocalError(null)
    const cleanName = newName.trim()

    if (!templateId || !newLevelId || !currentParentNodeId || !cleanName) {
      setLocalError('Selecciona diócesis, padre, nivel y escribe el nombre.')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/admin/estructura/nodo-entidad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: templateId,
          level_id: newLevelId,
          parent_node_id: currentParentNodeId,
          parent_entity_id: currentParentEntityId,
          entity_type_key: createEntityTypeKey,
          name: cleanName,
          slug: slugify(`${cleanName}-${currentParentNode?.name ?? 'unidad'}`),
          start_date: todayIso(),
        }),
      })

      const data = await response.json() as CreateNodeResponse
      if (!response.ok) throw new Error(data.error ?? 'No se pudo crear la unidad.')

      const { data: refreshed, error } = await supabase.rpc('get_structure_tree', {
        p_template_id: templateId,
        p_root_node_id: null,
        p_as_of: todayIso(),
        p_include_inactive: false,
      })

      if (error) throw new Error(error.message)
      const loaded = (refreshed ?? []) as StructureNode[]
      setNodes(loaded)
      setNewName('')
      setShowCreate(false)

      if (data.entity_id) {
        const createdNode = loaded.find((node) => node.linked_ecclesiastical_entity_id === data.entity_id)
        const rootId = loaded.find((node) => !node.parent_node_id)?.node_id
        if (createdNode) setSelectedPath(createdNode.path_ids.filter((id) => id !== rootId))
        onChange(data.entity_id)
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'No se pudo crear la unidad.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card compact-section">
      <h3>{label}</h3>
      {help && <p className="meta">{help}</p>}
      <input name={name} type="hidden" value={value} readOnly />

      {loading && <div className="empty-state">Cargando diócesis...</div>}
      {localError && <div className="error-box">{localError}</div>}

      <label>
        Diócesis / jurisdicción
        <select value={dioceseId} onChange={(event) => handleDioceseChange(event.target.value)}>
          <option value="">Seleccionar diócesis</option>
          {dioceses.map((diocese) => <option key={diocese.id} value={diocese.id}>{diocese.name}</option>)}
        </select>
      </label>

      {templates.length > 1 && (
        <label>
          Estructura activa
          <select value={templateId} onChange={(event) => { setTemplateId(event.target.value); setSelectedPath([]); onChange('') }}>
            {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
        </label>
      )}

      {dioceseId && templates.length === 0 && (
        <p className="meta">Esta diócesis todavía no tiene una estructura activa de tipo {kindKey}. Créala primero en Administración → Estructura.</p>
      )}

      {selectedTemplate && rootNode && groups.map((group) => (
        <label key={`${group.parentNodeId}-${group.depth}`}>
          {group.label}
          <select value={group.selectedNodeId} onChange={(event) => handleGroupChange(group.depth, event.target.value)}>
            <option value="">Todas / sin seleccionar</option>
            {group.nodes.map((node) => (
              <option key={node.node_id} value={node.node_id}>
                {node.name}{node.has_children ? '' : node.linked_ecclesiastical_entity_id ? ' · seleccionable' : ' · sin entidad vinculada'}
              </option>
            ))}
          </select>
        </label>
      ))}

      <div className="empty-state">
        <strong>{selectedNode?.name ?? emptyLabel}</strong>
        <span>{selectedNode ? selectedNode.path_names.join(' → ') : 'Selecciona por niveles. Solo se guarda una entidad eclesiástica vinculada al nodo.'}</span>
      </div>

      {allowCreate && selectedTemplate && rootNode && (
        <div>
          <button className="button button-secondary" type="button" onClick={() => setShowCreate((current) => !current)}>
            {showCreate ? 'Cancelar creación' : createButtonLabel}
          </button>

          {showCreate && (
            <div className="compact-section">
              <p className="meta">Se creará debajo de: {currentParentNode?.name ?? 'raíz seleccionada'}</p>
              <label>
                Nivel donde se creará
                <select value={newLevelId} onChange={(event) => setNewLevelId(event.target.value)} disabled={childLevels.length === 0}>
                  <option value="">Seleccionar nivel</option>
                  {childLevels.map((level) => <option key={level.level_id} value={level.level_id}>{level.level_name}</option>)}
                </select>
              </label>
              <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Nombre de la nueva unidad" />
              {childLevels.length === 0 && <p className="meta">El padre seleccionado no tiene niveles hijos permitidos. Primero agrega un nivel en el catálogo de estructura.</p>}
              <button className="button button-primary" disabled={saving || childLevels.length === 0} type="button" onClick={createAndSelectNode}>
                {saving ? 'Creando...' : 'Crear y seleccionar'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
