'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadChildLevelOptions,
  loadStructureBaseData,
  loadStructureTemplateDetails,
  loadStructureTemplates,
} from '../services/structure-admin-service'
import { fallbackKinds } from '../config/presets'
import type {
  ChildLevelOption,
  EcclesiasticalEntity,
  EntityType,
  StructureKind,
  StructureKindKey,
  StructureLevel,
  StructureTemplate,
  StructureTreeNode,
} from '../types'

type UseStructureConfiguratorOptions = {
  client: SupabaseClient
  initialKind?: StructureKindKey
  asOf?: string
}

export function useStructureConfigurator({
  client,
  initialKind = 'territorial',
  asOf = new Date().toISOString().slice(0, 10),
}: UseStructureConfiguratorOptions) {
  const [entities, setEntities] = useState<EcclesiasticalEntity[]>([])
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([])
  const [kinds, setKinds] = useState<StructureKind[]>(fallbackKinds)
  const [templates, setTemplates] = useState<StructureTemplate[]>([])
  const [levels, setLevels] = useState<StructureLevel[]>([])
  const [nodes, setNodes] = useState<StructureTreeNode[]>([])
  const [childLevelOptions, setChildLevelOptions] = useState<ChildLevelOption[]>([])
  const [selectedDioceseId, setSelectedDioceseId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedParentNodeId, setSelectedParentNodeId] = useState('')
  const [activeKind, setActiveKind] = useState<StructureKindKey>(initialKind)
  const [loadingBase, setLoadingBase] = useState(true)
  const [loadingStructure, setLoadingStructure] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dioceses = useMemo(
    () => entities.filter((entity) => /di[oó]cesis|arquidi[oó]cesis|ordinariato|vicariato/i.test(entity.name)),
    [entities],
  )

  const selectedDiocese = useMemo(
    () => dioceses.find((entity) => entity.id === selectedDioceseId) ?? null,
    [dioceses, selectedDioceseId],
  )

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  )

  const selectedParentNode = useMemo(
    () => nodes.find((node) => node.node_id === selectedParentNodeId) ?? null,
    [nodes, selectedParentNodeId],
  )

  const loadBase = useCallback(async () => {
    setLoadingBase(true)
    setError(null)
    try {
      const result = await loadStructureBaseData(client)
      setEntities(result.entities)
      setEntityTypes(result.entityTypes)
      setKinds(result.kinds.length > 0 ? result.kinds : fallbackKinds)
      setSelectedDioceseId((current) => current || result.entities.find((entity) => /di[oó]cesis|arquidi[oó]cesis|ordinariato|vicariato/i.test(entity.name))?.id || '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la configuración estructural.')
    } finally {
      setLoadingBase(false)
    }
  }, [client])

  const loadTemplates = useCallback(async () => {
    if (!selectedDioceseId) {
      setTemplates([])
      setSelectedTemplateId('')
      return
    }

    setLoadingStructure(true)
    setError(null)
    try {
      const result = await loadStructureTemplates(client, selectedDioceseId, activeKind)
      setTemplates(result)
      setSelectedTemplateId((current) => {
        const existing = result.find((template) => template.id === current)
        return existing?.id ?? result.find((template) => template.is_primary && template.status === 'active')?.id ?? result[0]?.id ?? ''
      })
    } catch (cause) {
      setTemplates([])
      setSelectedTemplateId('')
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los catálogos estructurales.')
    } finally {
      setLoadingStructure(false)
    }
  }, [activeKind, client, selectedDioceseId])

  const loadDetails = useCallback(async () => {
    if (!selectedTemplateId) {
      setLevels([])
      setNodes([])
      setChildLevelOptions([])
      return
    }

    setLoadingStructure(true)
    setError(null)
    try {
      const result = await loadStructureTemplateDetails(client, selectedTemplateId, asOf)
      setLevels(result.levels)
      setNodes(result.nodes)
      setSelectedParentNodeId((current) => result.nodes.some((node) => node.node_id === current) ? current : '')
    } catch (cause) {
      setLevels([])
      setNodes([])
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el árbol estructural.')
    } finally {
      setLoadingStructure(false)
    }
  }, [asOf, client, selectedTemplateId])

  const loadAllowedChildren = useCallback(async (parentLevelId: string | null) => {
    if (!selectedTemplateId) {
      setChildLevelOptions([])
      return
    }

    try {
      setChildLevelOptions(await loadChildLevelOptions(client, selectedTemplateId, parentLevelId))
    } catch (cause) {
      setChildLevelOptions([])
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los niveles hijos permitidos.')
    }
  }, [client, selectedTemplateId])

  useEffect(() => {
    void loadBase()
  }, [loadBase])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  useEffect(() => {
    void loadDetails()
  }, [loadDetails])

  function changeDiocese(dioceseId: string) {
    setSelectedDioceseId(dioceseId)
    setSelectedTemplateId('')
    setSelectedParentNodeId('')
  }

  function changeKind(kind: StructureKindKey) {
    setActiveKind(kind)
    setSelectedTemplateId('')
    setSelectedParentNodeId('')
    setLevels([])
    setNodes([])
    setChildLevelOptions([])
  }

  return {
    activeKind,
    changeDiocese,
    changeKind,
    childLevelOptions,
    dioceses,
    entities,
    entityTypes,
    error,
    kinds,
    levels,
    loadAllowedChildren,
    loadingBase,
    loadingStructure,
    nodes,
    refreshBase: loadBase,
    refreshDetails: loadDetails,
    refreshTemplates: loadTemplates,
    selectedDiocese,
    selectedDioceseId,
    selectedParentNode,
    selectedParentNodeId,
    selectedTemplate,
    selectedTemplateId,
    setError,
    setSelectedParentNodeId,
    setSelectedTemplateId,
    templates,
  }
}
