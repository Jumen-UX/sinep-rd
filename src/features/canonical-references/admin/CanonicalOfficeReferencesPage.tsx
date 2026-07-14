'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  hasCanonicalReferenceAdminSession,
  loadCanonicalOfficeDefinitions,
  type CanonicalOfficeDefinition,
} from '../services/canonical-office-reference-admin-service'

export default function CanonicalOfficeReferencesPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [definitions, setDefinitions] = useState<CanonicalOfficeDefinition[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        if (!(await hasCanonicalReferenceAdminSession(supabase))) {
          router.push('/admin/login')
          return
        }
        setDefinitions(await loadCanonicalOfficeDefinitions(supabase))
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las referencias canónicas.')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [router, supabase])

  const filtered = definitions.filter((item) => {
    const term = query.trim().toLowerCase()
    if (!term) return true
    return [item.name, item.short_definition, item.full_definition, item.canon_reference, item.canonical_context]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term))
  })

  if (loading) return <main className="container"><div className="empty-state">Cargando referencias canónicas...</div></main>

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink"><Link href="/admin">← Volver al panel administrativo</Link></div>
      <section className="dashboard-hero card"><div><p className="eyebrow">Fuente primaria</p><h1>Referencias canónicas de cargos</h1><p className="lead">Consulta definiciones breves y completas de cargos y oficios según el Código de Derecho Canónico.</p></div></section>
      {error && <div className="error-box">{error}</div>}
      <section className="card dashboard-section"><div className="section-heading"><div><p className="eyebrow">Búsqueda</p><h2>Buscar cargo u oficio</h2></div><span className="meta">{filtered.length} resultados</span></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Párroco, vicario, obispo, conferencia episcopal..." /></section>
      <section className="grid admin-modules">{filtered.map((definition) => <article className="entity-card admin-module" key={definition.id} title={definition.short_definition}><p className="entity-type">{definition.canon_reference}</p><h2>{definition.name} ⓘ</h2><p className="meta">{definition.short_definition}</p><details><summary>Ver definición canónica</summary><p>{definition.full_definition ?? definition.short_definition}</p><p className="meta">Contexto: {definition.canonical_context ?? 'Oficio eclesiástico'}</p><p className="meta">{definition.requires_bishop ? 'Requiere obispo.' : definition.requires_priest ? 'Requiere sacerdote.' : 'Requisitos según el derecho universal o particular.'}</p>{definition.source_url && <a href={definition.source_url}>Código de Derecho Canónico</a>}</details></article>)}</section>
    </main>
  )
}
