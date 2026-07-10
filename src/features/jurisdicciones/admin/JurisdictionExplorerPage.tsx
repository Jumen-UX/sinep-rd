'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AdminModuleHeader from '@/components/admin/AdminModuleHeader'
import AdminStatusNotice from '@/components/admin/AdminStatusNotice'
import { createClient } from '@/lib/supabase/client'
import {
  loadJurisdictionDetails,
  loadJurisdictionTree,
  type InternalTreeRow,
  type JurisdictionProfile,
  type JurisdictionTreeRow,
  type SuiIurisChurch,
} from '../services/jurisdiction-admin-service'

type ViewMode = 'canonical' | 'civil' | 'internal' | 'collegial'

const tabs: Array<{ key: ViewMode; title: string; description: string }> = [
  { key: 'canonical', title: 'Territorial-canónica', description: 'Provincias, sedes metropolitanas y sufragáneas.' },
  { key: 'civil', title: 'Geográfica civil', description: 'Países y subdivisiones como capa paralela.' },
  { key: 'internal', title: 'Pastoral interna', description: 'Vicarías, zonas, parroquias y otros niveles.' },
  { key: 'collegial', title: 'Colegial', description: 'Conferencias, consejos, comisiones y curia.' },
]

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

function roleLabel(row: JurisdictionTreeRow) {
  if (row.relationship_key === 'has_metropolitan_see' || row.provincial_role === 'metropolitan_see') return 'Metropolitana'
  if (row.relationship_key === 'has_suffragan_jurisdiction' || row.provincial_role === 'suffragan') return 'Sufragánea'
  if (row.grouping_type === 'ecclesiastical_province') return 'Provincia eclesiástica'
  return row.jurisdiction_type_name ?? row.entity_type_name
}

function internalLabel(row: InternalTreeRow) {
  const labels: Record<string, string> = {
    archdiocese: 'Arquidiócesis',
    diocese: 'Diócesis',
    vicariate: 'Vicaría',
    pastoral_zone: 'Zona pastoral',
    parish: 'Parroquia',
    chapel: 'Capilla',
    community: 'Comunidad',
  }
  return labels[row.entity_type_key] ?? row.entity_type_name
}

export default function JurisdictionExplorerPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [churches, setChurches] = useState<SuiIurisChurch[]>([])
  const [treeRows, setTreeRows] = useState<JurisdictionTreeRow[]>([])
  const [internalRows, setInternalRows] = useState<InternalTreeRow[]>([])
  const [profile, setProfile] = useState<JurisdictionProfile | null>(null)
  const [selectedChurchId, setSelectedChurchId] = useState('')
  const [selectedEntityId, setSelectedEntityId] = useState('')
  const [asOfDate, setAsOfDate] = useState(todayIso())
  const [viewMode, setViewMode] = useState<ViewMode>('canonical')
  const [loading, setLoading] = useState(true)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedRow = treeRows.find((row) => row.entity_id === selectedEntityId) ?? treeRows[0] ?? null
  const provinceCount = treeRows.filter((row) => row.grouping_type === 'ecclesiastical_province').length
  const jurisdictionCount = treeRows.filter((row) => Boolean(row.jurisdiction_type_key)).length
  const metropolitanCount = treeRows.filter((row) => row.provincial_role === 'metropolitan_see').length

  async function refreshTree() {
    setLoading(true)
    setError(null)
    try {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.replace('/admin/login')
        return
      }
      const result = await loadJurisdictionTree(supabase, selectedChurchId, asOfDate)
      setChurches(result.churches)
      setTreeRows(result.tree)
      setSelectedEntityId((current) => result.tree.some((row) => row.entity_id === current) ? current : (result.tree[0]?.entity_id ?? ''))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el árbol de jurisdicciones.')
    } finally {
      setLoading(false)
    }
  }

  async function refreshProfile(entityId: string) {
    if (!entityId) {
      setProfile(null)
      setInternalRows([])
      return
    }
    setLoadingProfile(true)
    setError(null)
    try {
      const result = await loadJurisdictionDetails(supabase, entityId, asOfDate)
      setProfile(result.profile)
      setInternalRows(result.internalTree)
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : 'No se pudo cargar la ficha de la jurisdicción.')
      setProfile(null)
      setInternalRows([])
    } finally {
      setLoadingProfile(false)
    }
  }

  useEffect(() => {
    refreshTree()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChurchId, asOfDate])

  useEffect(() => {
    refreshProfile(selectedEntityId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntityId, asOfDate])

  return (
    <main className="jurisdiction-page" id="top">
      <AdminModuleHeader
        badge="JUR"
        title="Jurisdicciones"
        eyebrow="Gobierno territorial-canónico"
        heading="Jurisdicciones eclesiásticas"
        description="Explora la jerarquía canónica sin confundirla con la división civil. Cada estructura interna se administra de forma flexible por diócesis."
        tags={[`${jurisdictionCount} jurisdicciones`, `${provinceCount} provincias`, `${metropolitanCount} metropolitanas`]}
        actions={<><Link className="button button-secondary" href="/admin/paises">Países ISO</Link><Link className="button button-secondary" href="/admin/estructura">Estructuras</Link><Link className="button button-primary" href="/admin/nuevo/jurisdiccion">Crear jurisdicción</Link></>}
      />

      {error && <AdminStatusNotice tone="error" title="No se pudo cargar el módulo" description={error} action={<button className="button button-secondary" type="button" onClick={refreshTree}>Reintentar</button>} />}

      <section className="admin-stat-strip" aria-label="Resumen de jurisdicciones">
        <a href="#jurisdiction-tree"><span>◎</span><strong>{jurisdictionCount}</strong><small>Jurisdicciones</small></a>
        <a href="#jurisdiction-tree"><span>◉</span><strong>{provinceCount}</strong><small>Provincias eclesiásticas</small></a>
        <a href="#jurisdiction-tree"><span>▤</span><strong>{metropolitanCount}</strong><small>Sedes metropolitanas</small></a>
        <a href="/admin/nuevo/jurisdiccion"><span>＋</span><strong>+</strong><small>Nueva jurisdicción</small></a>
        <a href="/admin/estructura"><span>↗</span><strong>↗</strong><small>Configurar estructura</small></a>
      </section>

      <section className="card dashboard-section">
        <div className="jurisdiction-toolbar">
          <label>Iglesia sui iuris<select value={selectedChurchId} onChange={(event) => setSelectedChurchId(event.target.value)}><option value="">Todas desde la Iglesia universal</option>{churches.map((church) => <option key={church.id} value={church.id}>{church.official_name}</option>)}</select></label>
          <label>Fecha histórica<input type="date" value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} /></label>
          <label>Entidad seleccionada<select value={selectedEntityId} onChange={(event) => setSelectedEntityId(event.target.value)}>{treeRows.map((row) => <option key={row.entity_id} value={row.entity_id}>{'— '.repeat(Math.max(0, row.depth))}{row.name}</option>)}</select></label>
        </div>
      </section>

      <section className="jurisdiction-view-tabs">
        {tabs.map((tab) => <button className={`jurisdiction-view-tab${viewMode === tab.key ? ' active' : ''}`} key={tab.key} onClick={() => setViewMode(tab.key)} type="button"><strong>{tab.title}</strong><span>{tab.description}</span></button>)}
      </section>

      <section className="jurisdiction-visual-grid" id="jurisdiction-tree">
        <section className="card dashboard-section tree-panel">
          <div className="section-heading"><div><p className="eyebrow">Árbol canónico</p><h2>Jerarquía territorial</h2><p className="meta">Se genera desde relaciones canónicas vigentes.</p></div></div>
          {loading && <AdminStatusNotice tone="info" title="Cargando jurisdicciones" description="Consultando la estructura vigente…" />}
          {!loading && treeRows.length === 0 && <AdminStatusNotice tone="empty" title="Sin relaciones canónicas" description="Crea o importa jurisdicciones para construir el árbol." />}
          <div className="tree-list">{treeRows.map((row) => <button className={`tree-row${selectedEntityId === row.entity_id ? ' active' : ''}`} key={`${row.entity_id}-${row.parent_entity_id ?? 'root'}`} onClick={() => setSelectedEntityId(row.entity_id)} style={{ marginLeft: `${Math.min(row.depth, 5) * 16}px`, width: `calc(100% - ${Math.min(row.depth, 5) * 16}px)` }} type="button"><div className="tree-row-main"><div className="tree-row-title"><span className="tree-dot">{row.depth + 1}</span><strong>{row.name}</strong></div><span className="mini-badge">{roleLabel(row)}</span></div><small>{row.path_names.join(' → ')}</small></button>)}</div>
        </section>

        <section className="card dashboard-section profile-panel">
          <div className="profile-title"><div><p className="eyebrow">Ficha contextual</p><h2>{profile?.entity?.name ?? selectedRow?.name ?? 'Selecciona una entidad'}</h2><p className="meta">{profile?.jurisdiction?.jurisdiction_type_name ?? selectedRow?.jurisdiction_type_name ?? selectedRow?.entity_type_name ?? 'Sin clasificación'}</p></div>{loadingProfile && <span className="mini-badge">Actualizando</span>}</div>
          <div className="jurisdiction-profile-grid">
            <div className="profile-tile"><strong>Iglesia sui iuris</strong><span>{profile?.jurisdiction?.sui_iuris_church_name ?? profile?.grouping?.sui_iuris_church_name ?? '—'}</span></div>
            <div className="profile-tile"><strong>Rol canónico</strong><span>{selectedRow ? roleLabel(selectedRow) : '—'}</span></div>
            <div className="profile-tile"><strong>Estado</strong><span>{profile?.jurisdiction?.canonical_status ?? profile?.grouping?.status ?? profile?.entity?.status ?? '—'}</span></div>
            <div className="profile-tile"><strong>Fecha de erección</strong><span>{formatDate(profile?.jurisdiction?.erection_date ?? profile?.grouping?.erection_date ?? profile?.entity?.erected_at)}</span></div>
            <div className="profile-tile"><strong>Sede / catedral</strong><span>{profile?.entity?.cathedral_name ?? profile?.jurisdiction?.principal_see_city ?? '—'}</span></div>
            <div className="profile-tile"><strong>Ordinario actual</strong><span>{profile?.entity?.current_ordinary_name ? `${profile.entity.current_ordinary_title ?? ''} ${profile.entity.current_ordinary_name}`.trim() : '—'}</span></div>
          </div>

          {viewMode === 'canonical' && <div className="mode-panel"><div className="relationship-list"><div className="relationship-card"><strong>Relaciones superiores</strong>{(profile?.incoming_relationships ?? []).length === 0 && <small>Sin relación superior activa.</small>}{(profile?.incoming_relationships ?? []).map((rel) => <small key={`${rel.relationship_key}-${rel.entity_id}`}>{rel.relationship_name}: {rel.name}</small>)}</div><div className="relationship-card"><strong>Relaciones hijas</strong>{(profile?.outgoing_relationships ?? []).length === 0 && <small>Sin relaciones hijas activas.</small>}{(profile?.outgoing_relationships ?? []).map((rel) => <small key={`${rel.relationship_key}-${rel.entity_id}`}>{rel.relationship_name}: {rel.name}</small>)}</div></div><div className="relationship-card"><strong>Historia</strong>{(profile?.events ?? []).length === 0 && <small>Sin eventos históricos registrados.</small>}{(profile?.events ?? []).map((event) => <small key={event.id}>{formatDate(event.effective_date ?? event.event_date)} · {event.event_type_name}: {event.title}</small>)}</div></div>}

          {viewMode === 'internal' && <div className="mode-panel"><div className="mode-card highlight"><strong>Estructura interna configurable</strong><span className="meta">Vicarías, zonas, parroquias, capillas y niveles propios de cada diócesis.</span></div>{internalRows.length === 0 ? <AdminStatusNotice tone="empty" title="Sin estructura interna" description="Abre el configurador de estructuras para definir niveles y nodos." action={<Link className="button button-secondary" href="/admin/estructura">Configurar estructura</Link>} /> : <div className="tree-list">{internalRows.map((row) => <div className="tree-row" key={`${row.entity_id}-${row.parent_entity_id ?? 'root'}`} style={{ marginLeft: `${Math.min(row.depth, 5) * 16}px`, width: `calc(100% - ${Math.min(row.depth, 5) * 16}px)` }}><div className="tree-row-main"><div className="tree-row-title"><span className="tree-dot">{row.depth + 1}</span><strong>{row.name}</strong></div><span className="mini-badge">{internalLabel(row)}</span></div><small>{row.path_names.join(' → ')}</small></div>)}</div>}</div>}

          {viewMode === 'civil' && <div className="mode-panel"><div className="mode-card highlight"><strong>Capa geográfica civil</strong><span className="meta">País, provincia, municipio y barrio se conectan por territorio o intersección; no son padres canónicos.</span></div><div className="layer-map"><div className="layer-node canonical"><strong>Entidad canónica</strong><span>{selectedRow?.path_names.join(' → ') ?? 'Selecciona una entidad.'}</span></div><div className="layer-node civil"><strong>Geografía civil</strong><span>Pendiente de polígonos oficiales y subdivisiones ISO.</span></div></div></div>}

          {viewMode === 'collegial' && <div className="mode-panel"><div className="mode-card highlight"><strong>Estructuras colegiales</strong><span className="meta">Conferencias episcopales, consejos, comisiones, tribunales y curia sin alterar el árbol territorial.</span></div></div>}
        </section>
      </section>
    </main>
  )
}
