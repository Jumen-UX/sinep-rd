'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>
type ViewMode = 'canonical' | 'civil' | 'internal' | 'collegial'

type SuiIurisChurch = {
  id: string
  official_name: string
  juridic_type: string
  status: string
}

type JurisdictionTreeRow = {
  entity_id: string
  parent_entity_id: string | null
  depth: number
  path_ids: string[]
  path_names: string[]
  entity_type_key: string
  entity_type_name: string
  name: string
  official_name: string | null
  relationship_key: string | null
  relationship_name: string | null
  jurisdiction_type_key: string | null
  jurisdiction_type_name: string | null
  grouping_type: string | null
  is_metropolitan: boolean
  provincial_role: string | null
  canonical_status: string | null
  status: string
  has_children: boolean
}

type InternalTreeRow = {
  entity_id: string
  parent_entity_id: string | null
  depth: number
  path_ids: string[]
  path_names: string[]
  entity_type_key: string
  entity_type_name: string
  name: string
  official_name: string | null
  relationship_type: string | null
  status: string
  has_children: boolean
}

type ProfileRelationship = {
  direction: 'incoming' | 'outgoing'
  relationship_key: string
  relationship_name: string
  entity_id: string
  name: string
  entity_type_key: string
  valid_from: string | null
  valid_to: string | null
  status: string
}

type ProfileEvent = {
  id: string
  event_type_key: string
  event_type_name: string
  title: string
  event_date: string | null
  effective_date: string | null
  status: string
}

type JurisdictionProfile = {
  entity?: {
    id: string
    name: string
    official_name: string | null
    slug: string
    description: string | null
    status: string
    entity_type_key: string
    entity_type_name: string
    cathedral_name: string | null
    current_ordinary_name: string | null
    current_ordinary_title: string | null
    territory_summary: string | null
    erected_at: string | null
    suppressed_at: string | null
    source_name: string | null
    source_url: string | null
  }
  jurisdiction?: {
    jurisdiction_type_key?: string
    jurisdiction_type_name?: string
    sui_iuris_church_name?: string
    is_metropolitan?: boolean
    provincial_role?: string
    governance_mode?: string
    canonical_status?: string
    principal_see_city?: string | null
    erection_date?: string | null
    suppression_date?: string | null
  }
  grouping?: {
    grouping_type?: string
    sui_iuris_church_name?: string
    metropolitan_entity_id?: string | null
    metropolitan_name?: string | null
    erection_date?: string | null
    suppression_date?: string | null
    status?: string
  }
  incoming_relationships?: ProfileRelationship[]
  outgoing_relationships?: ProfileRelationship[]
  events?: ProfileEvent[]
}

type ActionSuggestion = {
  title: string
  description: string
}

const viewTabs: Array<{ key: ViewMode; title: string; description: string }> = [
  { key: 'canonical', title: 'Territorial-canónica', description: 'Iglesia sui iuris → provincia → sede metropolitana / sufragáneas.' },
  { key: 'civil', title: 'Geográfica civil', description: 'País, provincia civil, municipio y barrio como capa paralela.' },
  { key: 'internal', title: 'Pastoral interna', description: 'Vicarías, zonas, parroquias, capillas y sectores por diócesis.' },
  { key: 'collegial', title: 'Colegial', description: 'Conferencias, colegios, consejos y comisiones como estructuras alternas.' },
]

const pageStyles = `
  .jurisdiction-page select,
  .jurisdiction-page input {
    border: 1px solid var(--border);
    border-radius: 14px;
    font: inherit;
    padding: 12px 14px;
    width: 100%;
  }

  .jurisdiction-hero {
    align-items: stretch;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 0.42fr);
  }

  .jurisdiction-summary {
    background: #fbf8f1;
    border: 1px solid var(--border);
    border-radius: 18px;
    display: grid;
    gap: 10px;
    padding: 20px;
  }

  .jurisdiction-summary strong {
    font-size: 32px;
    letter-spacing: -0.04em;
    line-height: 1;
  }

  .jurisdiction-toolbar,
  .jurisdiction-view-tabs,
  .jurisdiction-visual-grid,
  .jurisdiction-profile-grid,
  .jurisdiction-action-grid,
  .relationship-list,
  .layer-map,
  .mode-panel,
  .tree-list {
    display: grid;
    gap: 14px;
  }

  .jurisdiction-toolbar {
    align-items: end;
    grid-template-columns: minmax(220px, 1fr) minmax(180px, 0.72fr) minmax(180px, 0.72fr);
  }

  .jurisdiction-toolbar label {
    color: var(--muted);
    display: grid;
    font-size: 14px;
    font-weight: 800;
    gap: 7px;
  }

  .jurisdiction-view-tabs {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .jurisdiction-view-tab {
    appearance: none;
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 18px;
    cursor: pointer;
    display: grid;
    gap: 6px;
    padding: 18px;
    text-align: left;
  }

  .jurisdiction-view-tab strong,
  .layer-node strong,
  .profile-tile strong,
  .tree-row strong,
  .action-card strong,
  .relationship-card strong {
    color: var(--foreground);
  }

  .jurisdiction-view-tab span,
  .profile-tile span,
  .layer-node span,
  .tree-row small,
  .relationship-card small,
  .action-card span {
    color: var(--muted);
    font-size: 13px;
    line-height: 1.45;
  }

  .jurisdiction-view-tab.active {
    border-color: rgba(122, 31, 31, 0.55);
    box-shadow: 0 16px 38px rgba(122, 31, 31, 0.12);
  }

  .jurisdiction-visual-grid {
    align-items: start;
    grid-template-columns: minmax(310px, 0.9fr) minmax(0, 1.1fr);
  }

  .tree-panel,
  .profile-panel {
    display: grid;
    gap: 12px;
  }

  .tree-row {
    align-items: center;
    appearance: none;
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 16px;
    cursor: pointer;
    display: grid;
    gap: 6px;
    padding: 13px 14px;
    text-align: left;
    width: 100%;
  }

  .tree-row:hover,
  .tree-row.active {
    border-color: rgba(122, 31, 31, 0.55);
    box-shadow: 0 12px 30px rgba(31, 41, 51, 0.08);
  }

  .tree-row-main {
    align-items: center;
    display: flex;
    gap: 10px;
    justify-content: space-between;
  }

  .tree-row-title {
    align-items: center;
    display: flex;
    gap: 9px;
    min-width: 0;
  }

  .tree-dot {
    align-items: center;
    background: #fbf8f1;
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--primary);
    display: inline-flex;
    flex: 0 0 auto;
    font-size: 12px;
    font-weight: 900;
    height: 28px;
    justify-content: center;
    width: 28px;
  }

  .mini-badge {
    background: #fbf8f1;
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--primary);
    display: inline-flex;
    font-size: 12px;
    font-weight: 900;
    padding: 6px 9px;
  }

  .profile-title {
    align-items: flex-start;
    display: flex;
    gap: 14px;
    justify-content: space-between;
  }

  .profile-title h2 {
    margin-top: 6px;
  }

  .jurisdiction-profile-grid,
  .relationship-list,
  .layer-map {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .profile-tile,
  .relationship-card,
  .layer-node,
  .action-card,
  .mode-card {
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 16px;
    display: grid;
    gap: 7px;
    padding: 14px;
  }

  .layer-node.canonical {
    border-color: rgba(122, 31, 31, 0.35);
  }

  .layer-node.civil,
  .mode-card.highlight {
    background: #fbf8f1;
    border-style: dashed;
  }

  .jurisdiction-action-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .action-card button {
    justify-self: start;
    margin-top: 4px;
  }

  .detail-backlink {
    margin-bottom: 8px;
  }

  .detail-backlink a {
    color: var(--primary);
    font-weight: 800;
    text-decoration: none;
  }

  @media (max-width: 980px) {
    .jurisdiction-hero,
    .jurisdiction-toolbar,
    .jurisdiction-view-tabs,
    .jurisdiction-visual-grid,
    .jurisdiction-profile-grid,
    .relationship-list,
    .layer-map,
    .jurisdiction-action-grid {
      grid-template-columns: 1fr;
    }
  }
`

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

function roleLabel(row: Pick<JurisdictionTreeRow, 'relationship_key' | 'provincial_role' | 'grouping_type' | 'jurisdiction_type_name' | 'entity_type_name'>) {
  if (row.relationship_key === 'contains_sui_iuris_church') return 'Iglesia sui iuris'
  if (row.relationship_key === 'contains_ecclesiastical_grouping') return 'Agrupación canónica'
  if (row.relationship_key === 'has_metropolitan_see') return 'Sede metropolitana'
  if (row.relationship_key === 'has_suffragan_jurisdiction') return 'Sufragánea'
  if (row.relationship_key === 'has_personal_jurisdiction') return 'Jurisdicción personal'
  if (row.provincial_role === 'metropolitan_see') return 'Metropolitana'
  if (row.provincial_role === 'suffragan') return 'Sufragánea'
  return row.jurisdiction_type_name ?? row.entity_type_name
}

function entityKind(profile: JurisdictionProfile | null, selected: JurisdictionTreeRow | null) {
  if (profile?.jurisdiction?.jurisdiction_type_name) return profile.jurisdiction.jurisdiction_type_name
  if (profile?.grouping?.grouping_type === 'ecclesiastical_province') return 'Provincia eclesiástica'
  return selected?.entity_type_name ?? profile?.entity?.entity_type_name ?? 'Entidad eclesial'
}

function actionSuggestions(selected: JurisdictionTreeRow | null, profile: JurisdictionProfile | null): ActionSuggestion[] {
  const entityType = profile?.entity?.entity_type_key ?? selected?.entity_type_key
  const relationship = selected?.relationship_key
  const jurisdictionType = profile?.jurisdiction?.jurisdiction_type_key ?? selected?.jurisdiction_type_key
  const groupingType = profile?.grouping?.grouping_type ?? selected?.grouping_type

  if (entityType === 'universal_church') {
    return [
      { title: 'Registrar Iglesia sui iuris', description: 'Agregar una Iglesia católica con derecho propio y su tradición litúrgica.' },
      { title: 'Ver jurisdicciones directas', description: 'Revisar jurisdicciones inmediatamente sujetas o personales.' },
      { title: 'Monitor Santa Sede', description: 'Detectar boletines o documentos oficiales para revisión.' },
    ]
  }

  if (entityType === 'sui_iuris_church') {
    return [
      { title: 'Crear provincia eclesiástica', description: 'Agrupar jurisdicciones y definir sede metropolitana.' },
      { title: 'Registrar jurisdicción especial', description: 'Ordinariato, misión sui iuris u otra jurisdicción personal/especial.' },
      { title: 'Ver tradición y rito', description: 'Validar tradición litúrgica y tipo jurídico de la Iglesia sui iuris.' },
    ]
  }

  if (groupingType === 'ecclesiastical_province') {
    return [
      { title: 'Cambiar sede metropolitana', description: 'Cerrar relación anterior y crear nueva sede metropolitana con documento.' },
      { title: 'Agregar sufragánea', description: 'Asociar diócesis, arquidiócesis o jurisdicción equivalente a la provincia.' },
      { title: 'Dividir o modificar provincia', description: 'Crear evento histórico con relaciones antes y después.' },
    ]
  }

  if (relationship === 'has_metropolitan_see' || profile?.jurisdiction?.provincial_role === 'metropolitan_see') {
    return [
      { title: 'Ver sufragáneas', description: 'Consultar las jurisdicciones de la provincia que preside.' },
      { title: 'Modificar territorio', description: 'Registrar cambio de límites con mapa y fuente oficial.' },
      { title: 'Definir estructura interna', description: 'Pasar a vicarías, zonas pastorales, parroquias, capillas o sectores.' },
    ]
  }

  if (jurisdictionType === 'diocese' || jurisdictionType === 'archdiocese') {
    return [
      { title: 'Cambio de límites', description: 'Dibujar o importar territorio y detectar municipios/parroquias afectadas.' },
      { title: 'Crear por desmembramiento', description: 'Crear nueva jurisdicción tomando territorio de esta diócesis.' },
      { title: 'Elevar a arquidiócesis', description: 'Cambiar rango y, si aplica, asociarla como sede metropolitana.' },
    ]
  }

  if (jurisdictionType?.includes('ordinariate')) {
    return [
      { title: 'Revisar naturaleza personal', description: 'Validar que no dependa de un polígono territorial obligatorio.' },
      { title: 'Registrar ordinario', description: 'Asignar o actualizar el ordinario actual con fuente oficial.' },
      { title: 'Ver documentación', description: 'Consultar acto de erección, estatutos y documentos posteriores.' },
    ]
  }

  return [
    { title: 'Ver relaciones', description: 'Revisar cómo se conecta esta entidad con el árbol canónico.' },
    { title: 'Registrar evento', description: 'Aplicar cambios solo mediante evento histórico documentado.' },
    { title: 'Agregar fuente', description: 'Vincular documento oficial, boletín o decreto.' },
  ]
}

function internalLevelLabel(row: InternalTreeRow) {
  if (row.entity_type_key === 'archdiocese') return 'Arquidiócesis'
  if (row.entity_type_key === 'diocese') return 'Diócesis'
  if (row.entity_type_key === 'vicariate') return 'Vicaría'
  if (row.entity_type_key === 'pastoral_zone') return 'Zona pastoral'
  if (row.entity_type_key === 'parish') return 'Parroquia'
  if (row.entity_type_key === 'chapel') return 'Capilla'
  if (row.entity_type_key === 'community') return 'Comunidad'
  return row.entity_type_name
}

function ModeContent({
  viewMode,
  selectedRow,
  profile,
  internalRows,
}: {
  viewMode: ViewMode
  selectedRow: JurisdictionTreeRow | null
  profile: JurisdictionProfile | null
  internalRows: InternalTreeRow[]
}) {
  if (viewMode === 'internal') {
    const childRows = internalRows.filter((row) => row.depth > 0)
    return (
      <div className="mode-panel">
        <div className="mode-card highlight">
          <strong>Estructura interna de la jurisdicción seleccionada</strong>
          <span className="meta">Esta vista representa cómo trabaja internamente una diócesis o arquidiócesis: vicarías, zonas, parroquias, capillas, sectores u otros niveles configurables.</span>
        </div>
        {childRows.length === 0 && (
          <div className="empty-state">Esta entidad todavía no tiene estructura interna cargada. Al definirla, aparecerá aquí como árbol separado de la jerarquía canónica.</div>
        )}
        <div className="tree-list">
          {internalRows.map((row) => (
            <div
              className="tree-row"
              key={`internal-${row.entity_id}-${row.parent_entity_id ?? 'root'}`}
              style={{ marginLeft: `${Math.min(row.depth, 5) * 16}px`, width: `calc(100% - ${Math.min(row.depth, 5) * 16}px)` }}
            >
              <div className="tree-row-main">
                <div className="tree-row-title">
                  <span className="tree-dot">{row.depth + 1}</span>
                  <strong>{row.name}</strong>
                </div>
                <span className="mini-badge">{internalLevelLabel(row)}</span>
              </div>
              <small>{row.path_names.join(' → ')}</small>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (viewMode === 'civil') {
    return (
      <div className="mode-panel">
        <div className="mode-card highlight">
          <strong>Capa geográfica civil</strong>
          <span className="meta">El país, la provincia civil, el municipio, el distrito y el barrio se conectan por territorio/intersección. No mandan sobre la provincia eclesiástica.</span>
        </div>
        <div className="layer-map">
          <div className="layer-node canonical"><strong>Entidad canónica</strong><span>{selectedRow?.path_names.join(' → ') ?? 'Selecciona una entidad.'}</span></div>
          <div className="layer-node civil"><strong>Geografía civil</strong><span>Pendiente de cargar polígonos oficiales para detectar municipios, barrios y zonas intersectadas.</span></div>
        </div>
      </div>
    )
  }

  if (viewMode === 'collegial') {
    return (
      <div className="mode-panel">
        <div className="mode-card highlight">
          <strong>Estructuras colegiales y orgánicas</strong>
          <span className="meta">Aquí irán conferencias episcopales, colegios, consejos, comisiones, tribunales, curia y otras relaciones que no son territorio.</span>
        </div>
        <div className="relationship-card">
          <strong>Regla de lectura</strong>
          <small>Estas estructuras podrán relacionarse con personas y cargos sin alterar el árbol territorial-canónico.</small>
        </div>
      </div>
    )
  }

  return (
    <div className="mode-panel">
      <div className="layer-map">
        <div className="layer-node canonical"><strong>Capa canónica</strong><span>{selectedRow?.path_names.join(' → ') ?? 'Selecciona una entidad del árbol.'}</span></div>
        <div className="layer-node civil"><strong>Capa civil paralela</strong><span>País / municipio / barrio se conectan por territorio o intersección, no como padre canónico.</span></div>
      </div>
      <div className="relationship-list">
        <div className="relationship-card">
          <strong>Relaciones superiores</strong>
          {(profile?.incoming_relationships ?? []).length === 0 && <small>Sin relación superior activa en esta vista.</small>}
          {(profile?.incoming_relationships ?? []).map((rel) => <small key={`${rel.relationship_key}-${rel.entity_id}`}>{rel.relationship_name}: {rel.name}</small>)}
        </div>
        <div className="relationship-card">
          <strong>Relaciones hijas</strong>
          {(profile?.outgoing_relationships ?? []).length === 0 && <small>Sin hijos canónicos activos.</small>}
          {(profile?.outgoing_relationships ?? []).map((rel) => <small key={`${rel.relationship_key}-${rel.entity_id}`}>{rel.relationship_name}: {rel.name}</small>)}
        </div>
      </div>
      <div className="relationship-card">
        <strong>Línea histórica</strong>
        {(profile?.events ?? []).length === 0 && <small>Todavía no hay eventos canónicos migrados para esta entidad. Los próximos cambios se crearán como eventos, no como edición directa.</small>}
        {(profile?.events ?? []).map((event) => <small key={event.id}>{formatDate(event.effective_date ?? event.event_date)} · {event.event_type_name}: {event.title}</small>)}
      </div>
    </div>
  )
}

export default function AdminJurisdiccionesPage() {
  const router = useRouter()
  const supabase = useMemo<SupabaseClient>(() => createClient(), [])

  const [churches, setChurches] = useState<SuiIurisChurch[]>([])
  const [selectedChurchId, setSelectedChurchId] = useState('')
  const [asOfDate, setAsOfDate] = useState(todayIso())
  const [treeRows, setTreeRows] = useState<JurisdictionTreeRow[]>([])
  const [internalRows, setInternalRows] = useState<InternalTreeRow[]>([])
  const [selectedEntityId, setSelectedEntityId] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('canonical')
  const [profile, setProfile] = useState<JurisdictionProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedRow = treeRows.find((row) => row.entity_id === selectedEntityId) ?? treeRows[0] ?? null
  const provinceCount = treeRows.filter((row) => row.grouping_type === 'ecclesiastical_province').length
  const jurisdictionCount = treeRows.filter((row) => row.jurisdiction_type_key).length
  const metropolitanCount = treeRows.filter((row) => row.provincial_role === 'metropolitan_see').length
  const actions = actionSuggestions(selectedRow, profile)

  async function loadTree() {
    setError(null)
    setLoading(true)

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    const [churchRes, treeRes] = await Promise.all([
      supabase.from('sui_iuris_churches').select('id,official_name,juridic_type,status').eq('status', 'active').order('official_name'),
      supabase.rpc('get_jurisdiction_tree', {
        p_sui_iuris_church_id: selectedChurchId || null,
        p_as_of: asOfDate || todayIso(),
        p_include_historical: false,
      }),
    ])

    if (churchRes.error) setError(churchRes.error.message)
    if (treeRes.error) setError(treeRes.error.message)

    const loadedTree = (treeRes.data ?? []) as JurisdictionTreeRow[]
    setChurches((churchRes.data ?? []) as SuiIurisChurch[])
    setTreeRows(loadedTree)

    if (!selectedEntityId || !loadedTree.some((row) => row.entity_id === selectedEntityId)) {
      setSelectedEntityId(loadedTree[0]?.entity_id ?? '')
    }

    setLoading(false)
  }

  async function loadEntityDetails(entityId: string) {
    if (!entityId) {
      setProfile(null)
      setInternalRows([])
      return
    }

    setLoadingProfile(true)
    setError(null)

    const [profileRes, internalRes] = await Promise.all([
      supabase.rpc('get_jurisdiction_profile', {
        p_entity_id: entityId,
        p_as_of: asOfDate || todayIso(),
      }),
      supabase.rpc('get_entity_internal_tree', {
        p_root_entity_id: entityId,
        p_as_of: asOfDate || todayIso(),
        p_include_historical: false,
      }),
    ])

    if (profileRes.error) {
      setError(profileRes.error.message)
      setProfile(null)
    } else {
      setProfile((profileRes.data ?? null) as JurisdictionProfile | null)
    }

    if (internalRes.error) {
      setError(internalRes.error.message)
      setInternalRows([])
    } else {
      setInternalRows((internalRes.data ?? []) as InternalTreeRow[])
    }

    setLoadingProfile(false)
  }

  useEffect(() => {
    loadTree()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChurchId, asOfDate])

  useEffect(() => {
    if (selectedEntityId) loadEntityDetails(selectedEntityId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntityId, asOfDate])

  if (loading) {
    return <main className="container"><div className="empty-state">Cargando mapa territorial-canónico...</div></main>
  }

  return (
    <main className="container dashboard-page jurisdiction-page">
      <style>{pageStyles}</style>
      <div className="detail-backlink"><Link href="/admin">← Volver al panel administrativo</Link></div>

      <section className="dashboard-hero card jurisdiction-hero">
        <div>
          <p className="eyebrow">SINEP Core · vista universal</p>
          <h1>Jurisdicciones eclesiásticas</h1>
          <p className="lead">Explorador visual para separar la jerarquía canónica de la capa civil. Aquí el país no es padre de la provincia eclesiástica; solo sirve como referencia geográfica.</p>
        </div>
        <div className="jurisdiction-summary">
          <span className="mini-badge">Vista territorial-canónica</span>
          <strong>{jurisdictionCount}</strong>
          <span className="meta">jurisdicciones visibles · {provinceCount} provincias · {metropolitanCount} sedes metropolitanas</span>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="card dashboard-section">
        <div className="jurisdiction-toolbar">
          <label>Iglesia sui iuris
            <select value={selectedChurchId} onChange={(event) => setSelectedChurchId(event.target.value)}>
              <option value="">Todas desde Iglesia Católica universal</option>
              {churches.map((church) => <option key={church.id} value={church.id}>{church.official_name}</option>)}
            </select>
          </label>
          <label>Fecha histórica
            <input value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} type="date" />
          </label>
          <label>Entidad seleccionada
            <select value={selectedEntityId} onChange={(event) => setSelectedEntityId(event.target.value)}>
              {treeRows.map((row) => <option key={row.entity_id} value={row.entity_id}>{'— '.repeat(Math.max(0, row.depth))}{row.name}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="jurisdiction-view-tabs">
        {viewTabs.map((tab) => (
          <button className={`jurisdiction-view-tab ${viewMode === tab.key ? 'active' : ''}`} key={tab.key} onClick={() => setViewMode(tab.key)} type="button">
            <strong>{tab.title}</strong>
            <span>{tab.description}</span>
          </button>
        ))}
      </section>

      <section className="jurisdiction-visual-grid">
        <div className="card dashboard-section tree-panel">
          <div>
            <p className="eyebrow">Árbol canónico</p>
            <h2>Jerarquía territorial</h2>
            <p className="meta">Este árbol se genera desde relaciones canónicas, no desde el país civil.</p>
          </div>

          {treeRows.length === 0 && <div className="empty-state">Todavía no hay relaciones canónicas visibles.</div>}

          {treeRows.map((row) => (
            <button
              className={`tree-row ${selectedEntityId === row.entity_id ? 'active' : ''}`}
              key={`${row.entity_id}-${row.parent_entity_id ?? 'root'}`}
              onClick={() => setSelectedEntityId(row.entity_id)}
              style={{ marginLeft: `${Math.min(row.depth, 5) * 16}px`, width: `calc(100% - ${Math.min(row.depth, 5) * 16}px)` }}
              type="button"
            >
              <div className="tree-row-main">
                <div className="tree-row-title">
                  <span className="tree-dot">{row.depth + 1}</span>
                  <strong>{row.name}</strong>
                </div>
                <span className="mini-badge">{roleLabel(row)}</span>
              </div>
              <small>{row.path_names.join(' → ')}</small>
            </button>
          ))}
        </div>

        <div className="card dashboard-section profile-panel">
          <div className="profile-title">
            <div>
              <p className="eyebrow">Ficha y relaciones</p>
              <h2>{profile?.entity?.name ?? selectedRow?.name ?? 'Selecciona una entidad'}</h2>
              <p className="meta">{entityKind(profile, selectedRow)}</p>
            </div>
            {loadingProfile && <span className="mini-badge">Actualizando</span>}
          </div>

          <div className="jurisdiction-profile-grid">
            <div className="profile-tile"><strong>Iglesia sui iuris</strong><span>{profile?.jurisdiction?.sui_iuris_church_name ?? profile?.grouping?.sui_iuris_church_name ?? '—'}</span></div>
            <div className="profile-tile"><strong>Rol canónico</strong><span>{selectedRow ? roleLabel(selectedRow) : '—'}</span></div>
            <div className="profile-tile"><strong>Estado</strong><span>{profile?.jurisdiction?.canonical_status ?? profile?.grouping?.status ?? profile?.entity?.status ?? '—'}</span></div>
            <div className="profile-tile"><strong>Fecha de erección</strong><span>{formatDate(profile?.jurisdiction?.erection_date ?? profile?.grouping?.erection_date ?? profile?.entity?.erected_at)}</span></div>
            <div className="profile-tile"><strong>Sede / catedral</strong><span>{profile?.entity?.cathedral_name ?? profile?.jurisdiction?.principal_see_city ?? '—'}</span></div>
            <div className="profile-tile"><strong>Ordinario actual</strong><span>{profile?.entity?.current_ordinary_name ? `${profile.entity.current_ordinary_title ?? ''} ${profile.entity.current_ordinary_name}`.trim() : '—'}</span></div>
          </div>

          <ModeContent viewMode={viewMode} selectedRow={selectedRow} profile={profile} internalRows={internalRows} />
        </div>
      </section>

      <section className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Acciones válidas</p>
            <h2>Qué se podrá hacer aquí</h2>
            <p className="meta">Por ahora esta pantalla permite validar visualmente el modelo. El siguiente paso es activar asistentes que creen eventos canónicos con fuente oficial.</p>
          </div>
        </div>
        <div className="jurisdiction-action-grid">
          {actions.map((action) => (
            <div className="action-card" key={action.title}>
              <strong>{action.title}</strong>
              <span className="meta">{action.description}</span>
              <button className="button button-secondary" disabled type="button">Asistente pendiente</button>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
