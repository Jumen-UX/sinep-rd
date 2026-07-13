'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>
export type StructureKindKey = 'territorial' | 'pastoral' | 'administrative' | 'organic'

type EntityTypeRelation = { key: string; name: string }

type EcclesiasticalEntity = {
  id: string
  name: string
  official_name: string | null
  slug: string
  country_iso2: string | null
  entity_types: EntityTypeRelation[] | EntityTypeRelation | null
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
  linked_organization_unit_id: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  status: string
  visibility: string
  has_children: boolean
}

export type StructureSelection = {
  dioceseId: string
  templateId: string
  parentNodeId: string
  parentNodeName: string
  parentLevelId: string
  parentLevelKey: string
  parentLevelName: string
  linkedEntityId: string | null
  pathLabel: string
}

type StructureHierarchySelectorProps = {
  kind?: StructureKindKey
  label?: string
  helperText?: string
  namePrefix?: string
  defaultDioceseId?: string
  defaultParentNodeId?: string
  countryIso2?: string | null
  required?: boolean
  onChange?: (selection: StructureSelection | null) => void
}

const fixedJurisdictionKeys = ['country', 'ecclesiastical_province', 'archdiocese', 'diocese', 'military_ordinariate']
const dioceseEntityTypeKeys = ['archdiocese', 'diocese', 'military_ordinariate', 'ordinariate', 'apostolic_vicariate', 'vicariate']

const componentStyles = `
  .structure-selector {
    background: #fbf8f1;
    border: 1px solid var(--border);
    border-radius: 18px;
    display: grid;
    gap: 14px;
    padding: 18px;
  }

  .structure-selector h3 {
    color: var(--foreground);
    font-size: clamp(19px, 2vw, 22px);
    line-height: 1.15;
    margin: 0;
  }

  .structure-selector-grid {
    display: grid;
    gap: 14px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .structure-selector label {
    color: var(--muted);
    display: grid;
    font-size: 14px;
    font-weight: 800;
    gap: 7px;
  }

  .structure-selector select {
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 14px;
    color: var(--foreground);
    font: inherit;
    padding: 12px 14px;
    width: 100%;
  }

  .structure-selector-path {
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 16px;
    display: grid;
    gap: 6px;
    padding: 14px;
  }

  .structure-selector-path strong {
    color: var(--foreground);
    line-height: 1.2;
  }

  .structure-selector-path span,
  .structure-selector-path small {
    color: var(--muted);
    font-size: 13px;
    line-height: 1.45;
  }

  .legacy-parent-selector {
    border-top: 1px solid var(--border);
    display: grid;
    gap: 10px;
    margin-top: 16px;
    padding-top: 16px;
  }

  .legacy-parent-selector label {
    color: var(--muted);
    display: grid;
    font-size: 14px;
    font-weight: 800;
    gap: 7px;
  }

  @media (max-width: 860px) {
    .structure-selector-grid {
      grid-template-columns: 1fr;
    }
  }
`

function toEntityTypes(entity: Pick<EcclesiasticalEntity, 'entity_types'>) {
  if (!entity.entity_types) return []
  return Array.isArray(entity.entity_types) ? entity.entity_types : [entity.entity_types]
}

function hasEntityType(entity: Pick<EcclesiasticalEntity, 'entity_types'>, keys: string[]) {
  return toEntityTypes(entity).some((type) => keys.includes(type.key))
}

function isDioceseEntity(entity: EcclesiasticalEntity) {
  return hasEntityType(entity, dioceseEntityTypeKeys) || /di[oó]cesis|arquidi[oó]cesis|ordinariato|vicariato/i.test(entity.name)
}

function isFixedJurisdictionNode(node: Pick<StructureTreeNode, 'level_key' | 'level_name'>) {
  return fixedJurisdictionKeys.includes(node.level_key) || /pa[ií]s|provincia eclesi[aá]stica|arquidi[oó]cesis|di[oó]cesis|ordinariato/i.test(node.level_name)
}

function nodeLabel(node: StructureTreeNode) {
  const prefix = node.depth > 0 ? `${'— '.repeat(Math.max(0, node.depth - 1))}` : ''
  return `${prefix}${node.name} · ${node.level_name}`
}

function pathLabel(node: StructureTreeNode) {
  return node.path_names.length > 0 ? node.path_names.join(' → ') : node.name
}

function filterDioceses(entities: EcclesiasticalEntity[], countryIso2?: string | null) {
  return entities.filter((entity) => {
    const matchesCountry = !countryIso2 || !entity.country_iso2 || entity.country_iso2 === countryIso2
    return isDioceseEntity(entity) && matchesCountry
  })
}

export default function StructureHierarchySelector({
  kind = 'territorial',
  label = 'Contexto jerárquico',
  helperText = 'Selecciona la diócesis y la unidad interna donde se ubicará este registro.',
  namePrefix = 'structure',
  defaultDioceseId,
  defaultParentNodeId,
  countryIso2 = null,
  required = false,
  onChange,
}: StructureHierarchySelectorProps) {
  const supabase = useMemo<SupabaseClient>(() => createClient(), [])
  const [dioceses, setDioceses] = useState<EcclesiasticalEntity[]>([])
  const [selectedDioceseId, setSelectedDioceseId] = useState(defaultDioceseId ?? '')
  const [templates, setTemplates] = useState<StructureTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [nodes, setNodes] = useState<StructureTreeNode[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState(defaultParentNodeId ?? '')
  const [loadingBase, setLoadingBase] = useState(true)
  const [loadingTree, setLoadingTree] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null
  const sortedNodes = useMemo(() => [...nodes].sort((a, b) => pathLabel(a).localeCompare(pathLabel(b), 'es')), [nodes])
  const selectableNodes = useMemo(() => sortedNodes.filter((node) => node.is_current && node.status === 'active'), [sortedNodes])
  const selectedNode = selectableNodes.find((node) => node.node_id === selectedNodeId) ?? null
  const selection = useMemo<StructureSelection | null>(() => {
    if (!selectedDioceseId || !selectedTemplateId || !selectedNode) return null

    return {
      dioceseId: selectedDioceseId,
      templateId: selectedTemplateId,
      parentNodeId: selectedNode.node_id,
      parentNodeName: selectedNode.name,
      parentLevelId: selectedNode.level_id,
      parentLevelKey: selectedNode.level_key,
      parentLevelName: selectedNode.level_name,
      linkedEntityId: selectedNode.linked_ecclesiastical_entity_id,
      pathLabel: pathLabel(selectedNode),
    }
  }, [selectedDioceseId, selectedNode, selectedTemplateId])

  useEffect(() => {
    async function loadDioceses() {
      setError(null)
      setLoadingBase(true)

      const { data, error: entityError } = await supabase
        .from('ecclesiastical_entities')
        .select('id,name,official_name,slug,country_iso2,entity_types(key,name)')
        .eq('status', 'active')
        .order('name')

      if (entityError) {
        setError(entityError.message)
        setDioceses([])
        setLoadingBase(false)
        return
      }

      const loadedDioceses = filterDioceses((data ?? []) as unknown as EcclesiasticalEntity[], countryIso2)
      setDioceses(loadedDioceses)
      setSelectedDioceseId((current) => {
        if (current && loadedDioceses.some((diocese) => diocese.id === current)) return current
        return loadedDioceses[0]?.id || ''
      })
      setLoadingBase(false)
    }

    loadDioceses()
  }, [countryIso2, supabase])

  useEffect(() => {
    async function loadTemplates() {
      if (!selectedDioceseId) {
        setTemplates([])
        setSelectedTemplateId('')
        setNodes([])
        return
      }

      setError(null)
      setLoadingTree(true)

      const { data, error: templateError } = await supabase.rpc('get_structure_templates', {
        p_diocese_id: selectedDioceseId,
        p_kind_key: kind,
        p_active_only: false,
      })

      if (templateError) {
        setError(templateError.message)
        setTemplates([])
        setSelectedTemplateId('')
        setNodes([])
        setLoadingTree(false)
        return
      }

      const loadedTemplates = ((data ?? []) as StructureTemplate[]).filter((template) => template.status === 'active')
      setTemplates(loadedTemplates)
      const preferred = loadedTemplates.find((template) => template.is_primary) ?? loadedTemplates[0]
      setSelectedTemplateId(preferred?.id ?? '')
      setLoadingTree(false)
    }

    loadTemplates()
  }, [kind, selectedDioceseId, supabase])

  useEffect(() => {
    async function loadTree() {
      if (!selectedTemplateId) {
        setNodes([])
        setSelectedNodeId('')
        return
      }

      setError(null)
      setLoadingTree(true)

      const { data, error: treeError } = await supabase.rpc('get_structure_tree', {
        p_template_id: selectedTemplateId,
        p_root_node_id: null,
        p_as_of: new Date().toISOString().slice(0, 10),
        p_include_inactive: false,
      })

      if (treeError) {
        setError(treeError.message)
        setNodes([])
        setSelectedNodeId('')
        setLoadingTree(false)
        return
      }

      const loadedNodes = (data ?? []) as StructureTreeNode[]
      setNodes(loadedNodes)
      setSelectedNodeId((current) => {
        if (current && loadedNodes.some((node) => node.node_id === current)) return current
        const firstCustomNode = loadedNodes.find((node) => !isFixedJurisdictionNode(node))
        return defaultParentNodeId && loadedNodes.some((node) => node.node_id === defaultParentNodeId)
          ? defaultParentNodeId
          : firstCustomNode?.node_id ?? loadedNodes[0]?.node_id ?? ''
      })
      setLoadingTree(false)
    }

    loadTree()
  }, [defaultParentNodeId, selectedTemplateId, supabase])

  useEffect(() => {
    onChange?.(selection)
  }, [onChange, selection])

  return (
    <section className="structure-selector">
      <style>{componentStyles}</style>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Motor flexible</p>
          <h3>{label}</h3>
          <p className="meta">{helperText}</p>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="structure-selector-grid">
        <label>Diócesis
          <select value={selectedDioceseId} onChange={(event) => setSelectedDioceseId(event.target.value)} required={required}>
            <option value="">Seleccionar diócesis</option>
            {dioceses.map((diocese) => <option key={diocese.id} value={diocese.id}>{diocese.name}</option>)}
          </select>
        </label>

        <label>Catálogo activo
          <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)} disabled={templates.length === 0}>
            <option value="">{loadingTree ? 'Cargando catálogo...' : 'Sin catálogo activo'}</option>
            {templates.map((template) => <option key={template.id} value={template.id}>{template.name}{template.is_primary ? ' · principal' : ''}</option>)}
          </select>
        </label>

        <label>Unidad padre
          <select value={selectedNodeId} onChange={(event) => setSelectedNodeId(event.target.value)} disabled={selectableNodes.length === 0} required={required}>
            <option value="">{loadingTree ? 'Cargando árbol...' : 'Seleccionar unidad'}</option>
            {selectableNodes.map((node) => <option key={node.node_id} value={node.node_id}>{nodeLabel(node)}</option>)}
          </select>
        </label>
      </div>

      <input name={`${namePrefix}_diocese_id`} type="hidden" value={selection?.dioceseId ?? ''} readOnly />
      <input name={`${namePrefix}_template_id`} type="hidden" value={selection?.templateId ?? ''} readOnly />
      <input name={`${namePrefix}_parent_node_id`} type="hidden" value={selection?.parentNodeId ?? ''} readOnly />
      <input name={`${namePrefix}_parent_level_id`} type="hidden" value={selection?.parentLevelId ?? ''} readOnly />
      <input name={`${namePrefix}_parent_level_key`} type="hidden" value={selection?.parentLevelKey ?? ''} readOnly />
      <input name={`${namePrefix}_linked_entity_id`} type="hidden" value={selection?.linkedEntityId ?? ''} readOnly />
      <input name={`${namePrefix}_parent_path`} type="hidden" value={selection?.pathLabel ?? ''} readOnly />

      <div className="structure-selector-path">
        <strong>Ruta seleccionada</strong>
        <span>{selection?.pathLabel ?? (loadingBase || loadingTree ? 'Cargando estructura...' : 'Selecciona una unidad del árbol flexible.')}</span>
        {selection && !selection.linkedEntityId && <small>Esta unidad no está vinculada a una ficha pública; se guardará como contexto estructural cuando el backend lo soporte.</small>}
        {selectedTemplate && <small>Modelo: {selectedTemplate.name}</small>}
      </div>
    </section>
  )
}
