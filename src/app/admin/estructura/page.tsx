'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>

type Diocese = {
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

type StructureKindKey = 'territorial' | 'pastoral' | 'administrative' | 'organic'

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
  { key: 'territorial', name: 'Territorial', description: 'Vicarías, zonas, parroquias, sectores y capillas.' },
  { key: 'pastoral', name: 'Pastoral', description: 'Áreas pastorales, movimientos, comunidades y servicios.' },
  { key: 'administrative', name: 'Administrativa', description: 'Curia, oficinas, departamentos y dependencias internas.' },
  { key: 'organic', name: 'Orgánica', description: 'Organigramas, unidades y líneas de responsabilidad.' },
]

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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Ocurrió un error inesperado.'
}

export default function AdminEstructuraPage() {
  const router = useRouter()
  const supabase = useMemo<SupabaseClient>(() => createClient(), [])

  const [dioceses, setDioceses] = useState<Diocese[]>([])
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([])
  const [structureKinds, setStructureKinds] = useState<StructureKind[]>(fallbackKinds)
  const [activeKind, setActiveKind] = useState<StructureKindKey>('territorial')
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

  async function loadBaseData() {
    setError(null)
    setLoadingBase(true)

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    const [dioceseRes, kindRes, entityTypeRes] = await Promise.all([
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

    if (dioceseRes.error) setError(dioceseRes.error.message)
    if (kindRes.error) setError(kindRes.error.message)
    if (entityTypeRes.error) setError(entityTypeRes.error.message)

    const loadedDioceses = ((dioceseRes.data ?? []) as Diocese[]).filter((entity) =>
      /di[oó]cesis|arquidi[oó]cesis|ordinariato|vicariato/i.test(entity.name),
    )

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
      setError('Escribe el nombre de la estructura.')
      setSaving(false)
      return
    }

    const payload = {
      diocese_id: selectedDioceseId,
      kind_key: activeKind,
      key: emptyToNull(form.get('key')) ?? `${activeKind}-${slugify(name)}`,
      name,
      description: emptyToNull(form.get('description')),
      is_primary: toBoolean(form.get('is_primary')),
      is_active: true,
      status: 'active',
    }

    const { data, error: saveError } = await supabase.rpc('admin_save_structure_template', { payload })

    if (saveError) {
      setError(saveError.message)
    } else {
      const result = data as RpcResult | null
      setMessage(`Estructura guardada${result?.id ? `: ${result.id}` : ''}.`)
      event.currentTarget.reset()
      await loadTemplates(selectedDioceseId, activeKind)
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
      setError('Selecciona una plantilla de estructura.')
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
      setError('Selecciona una plantilla de estructura.')
      setSaving(false)
      return
    }

    if (!name || !levelId) {
      setError('Selecciona el nivel y escribe el nombre del nodo.')
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
      setMessage(`Nodo guardado${result?.id ? `: ${result.id}` : ''}.`)
      event.currentTarget.reset()
      setSelectedParentNodeId('')
      await loadTemplateDetails(selectedTemplateId)
    }

    setSaving(false)
  }

  if (loadingBase) {
    return <main className="container"><div className="empty-state">Cargando motor de estructuras...</div></main>
  }

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink">
        <Link href="/admin">← Volver al panel administrativo</Link>
      </div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Fase 1 · Motor flexible</p>
          <h1>Estructuras de la diócesis</h1>
          <p className="lead">
            Define la jerarquía real de cada diócesis sin imponer un modelo fijo. Puedes crear niveles como vicaría,
            zona pastoral, parroquia, sector, capilla u otros, y luego crear nodos debajo del nivel permitido.
          </p>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="empty-state">{message}</div>}

      <section className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Contexto</p>
            <h2>Selecciona jurisdicción y tipo de estructura</h2>
            <p className="meta">Los formularios se adaptan a la configuración de la diócesis seleccionada.</p>
          </div>
        </div>

        <form className="admin-form admin-config-form">
          <label>
            Diócesis o jurisdicción
            <select value={selectedDioceseId} onChange={(event) => setSelectedDioceseId(event.target.value)}>
              <option value="">Seleccionar</option>
              {dioceses.map((diocese) => (
                <option key={diocese.id} value={diocese.id}>{diocese.name}</option>
              ))}
            </select>
          </label>

          <label>
            Tipo de estructura
            <select value={activeKind} onChange={(event) => setActiveKind(event.target.value as StructureKindKey)}>
              {structureKinds.map((kind) => (
                <option key={kind.key} value={kind.key}>{kind.name}</option>
              ))}
            </select>
          </label>
        </form>
      </section>

      <div className="dashboard-grid dashboard-summary">
        {structureKinds.map((kind) => (
          <button
            className={`metric-card metric-button ${activeKind === kind.key ? 'active-filter' : ''}`}
            key={kind.key}
            onClick={() => setActiveKind(kind.key)}
            type="button"
          >
            <strong>{kind.name}</strong>
            <span>{kind.description ?? 'Estructura configurable'}</span>
          </button>
        ))}
      </div>

      <section className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Plantillas</p>
            <h2>{selectedDiocese?.name ?? 'Selecciona una diócesis'}</h2>
            <p className="meta">Una plantilla define los niveles permitidos para este tipo de estructura.</p>
          </div>
        </div>

        {loadingStructure && <div className="empty-state">Actualizando estructura...</div>}

        {templates.length > 0 && (
          <div className="grid admin-modules">
            {templates.map((template) => (
              <button
                className={`entity-card admin-module metric-button ${selectedTemplateId === template.id ? 'active-filter' : ''}`}
                key={template.id}
                onClick={() => setSelectedTemplateId(template.id)}
                type="button"
              >
                <p className="entity-type">{template.kind_key}</p>
                <h2>{template.name}</h2>
                <p className="meta">{template.description ?? 'Sin descripción'}</p>
                <span className="role-pill">{template.is_primary ? 'Principal' : 'Alterna'} · {template.status}</span>
              </button>
            ))}
          </div>
        )}

        <form className="admin-form admin-config-form" onSubmit={saveTemplate}>
          <input name="name" placeholder="Nombre de la estructura, ej. Estructura territorial 2026" />
          <input name="key" placeholder="Clave opcional, ej. territorial-2026" />
          <textarea name="description" placeholder="Descripción o fuente de la configuración" />
          <label className="role-pill"><input name="is_primary" type="checkbox" /> Usar como estructura principal</label>
          <button className="button button-primary" disabled={saving || !selectedDioceseId} type="submit">
            {saving ? 'Guardando...' : 'Crear plantilla'}
          </button>
        </form>
      </section>

      {selectedTemplate && (
        <section className="card dashboard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Niveles</p>
              <h2>{selectedTemplate.name}</h2>
              <p className="meta">Define qué niveles existen y qué nivel puede depender de cuál.</p>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table dashboard-list-table">
              <thead>
                <tr><th>Orden</th><th>Nivel</th><th>Depende de</th><th>Tipo vinculado</th><th>Entrada</th></tr>
              </thead>
              <tbody>
                {sortedLevels.map((level) => (
                  <tr key={level.id}>
                    <td>{level.level_order}</td>
                    <td>{level.name}<br /><span className="meta">{level.level_key}</span></td>
                    <td>{levels.find((item) => item.id === level.parent_level_id)?.name ?? 'Raíz'}</td>
                    <td>{entityTypes.find((item) => item.id === level.linked_entity_type_id)?.name ?? 'Sin vínculo'}</td>
                    <td>{level.is_entry_point ? 'Sí' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form className="admin-form admin-config-form" onSubmit={saveLevel}>
            <input name="name" placeholder="Nombre del nivel, ej. Sector" />
            <input name="plural_name" placeholder="Plural opcional, ej. Sectores" />
            <input name="level_key" placeholder="Clave opcional, ej. sector" />
            <input name="level_order" min="1" placeholder="Orden jerárquico" type="number" />
            <select name="parent_level_id" defaultValue="">
              <option value="">Sin padre / nivel raíz</option>
              {sortedLevels.map((level) => (
                <option key={level.id} value={level.id}>{level.level_order}. {level.name}</option>
              ))}
            </select>
            <select name="linked_entity_type_id" defaultValue="">
              <option value="">Tipo de entidad vinculado opcional</option>
              {entityTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
            <select name="scope" defaultValue="ecclesial">
              <option value="ecclesial">Eclesial</option>
              <option value="pastoral">Pastoral</option>
              <option value="administrative">Administrativa</option>
              <option value="organic">Orgánica</option>
              <option value="mixed">Mixta</option>
            </select>
            <textarea name="description" placeholder="Descripción del nivel" />
            <label className="role-pill"><input name="is_entry_point" type="checkbox" /> Nivel de entrada</label>
            <label className="role-pill"><input name="is_required" type="checkbox" /> Obligatorio</label>
            <button className="button button-primary" disabled={saving} type="submit">
              {saving ? 'Guardando...' : 'Guardar nivel'}
            </button>
          </form>
        </section>
      )}

      {selectedTemplate && (
        <section className="card dashboard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Nodos</p>
              <h2>Jerarquía actual</h2>
              <p className="meta">Crea vicarías, zonas, parroquias, sectores u otros nodos según el nivel permitido.</p>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table dashboard-list-table">
              <thead>
                <tr><th>Nodo</th><th>Nivel</th><th>Padre</th><th>Inicio</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {sortedNodes.map((node) => (
                  <tr key={node.node_id}>
                    <td>{'— '.repeat(node.depth)}{node.name}<br /><span className="meta">{node.path_names.join(' / ')}</span></td>
                    <td>{node.level_name}</td>
                    <td>{treeNodes.find((item) => item.node_id === node.parent_node_id)?.name ?? 'Raíz'}</td>
                    <td>{formatDate(node.start_date)}</td>
                    <td>{node.status}</td>
                  </tr>
                ))}
                {sortedNodes.length === 0 && (
                  <tr><td colSpan={5}>No hay nodos cargados para esta plantilla.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <form className="admin-form admin-config-form" onSubmit={saveNode}>
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
            <select name="level_id" defaultValue="">
              <option value="">Nivel permitido</option>
              {childLevelOptions.map((option) => (
                <option key={option.level_id} value={option.level_id}>{option.level_order}. {option.level_name}</option>
              ))}
            </select>
            <input name="name" placeholder="Nombre del nodo, ej. Vicaría Norte" />
            <input name="official_name" placeholder="Nombre oficial opcional" />
            <input name="slug" placeholder="Slug opcional" />
            <input name="code" placeholder="Código opcional" />
            <select name="linked_ecclesiastical_entity_id" defaultValue="">
              <option value="">Vincular a entidad existente opcional</option>
              {dioceses.map((diocese) => (
                <option key={diocese.id} value={diocese.id}>{diocese.name}</option>
              ))}
            </select>
            <label>Fecha de inicio<input name="start_date" type="date" /></label>
            <select name="visibility" defaultValue="public">
              <option value="public">Público</option>
              <option value="authenticated">Solo usuarios autenticados</option>
              <option value="restricted">Restringido</option>
              <option value="private">Privado</option>
            </select>
            <textarea name="description" placeholder="Descripción, fuente o notas" />
            <button className="button button-primary" disabled={saving || childLevelOptions.length === 0} type="submit">
              {saving ? 'Guardando...' : 'Crear nodo'}
            </button>
          </form>
        </section>
      )}
    </main>
  )
}
