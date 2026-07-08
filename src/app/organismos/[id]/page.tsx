'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type OrganizationDetail = {
  unit: { id: string; name: string; description: string | null; parent_unit_id: string | null }
  chart: { id: string; name: string; description: string | null } | null
}

export default function CollegialOrganizationPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [detail, setDetail] = useState<OrganizationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDetail() {
      try {
        const response = await fetch(`/api/organizacion?id=${encodeURIComponent(id)}`)
        const payload = await response.json()
        if (!response.ok) {
          setError(payload.error ?? 'No se pudo cargar el organismo.')
          return
        }
        setDetail(payload as OrganizationDetail)
      } finally {
        setLoading(false)
      }
    }

    loadDetail()
  }, [id])

  if (loading) return <main className="container"><div className="empty-state">Cargando organismo...</div></main>
  if (error || !detail) return <main className="container"><div className="error-box">{error ?? 'Organismo no encontrado.'}</div></main>

  return (
    <main className="container dashboard-page home-dashboard">
      <div className="detail-backlink"><Link href="/?vista=colegial">← Volver al explorador</Link></div>
      <section className="home-hero-panel card">
        <div className="home-hero-copy">
          <p className="eyebrow">Organización colegial</p>
          <h1>{detail.unit.name}</h1>
          <p className="lead">{detail.unit.description ?? 'Ficha pública del organismo colegial seleccionado.'}</p>
        </div>
        <aside className="home-context-card">
          <p className="eyebrow">Organigrama</p>
          <h2>{detail.chart?.name ?? 'Sin organigrama publicado'}</h2>
          <p className="meta">Consejos, comisiones, comités, organismos colegiados o equipos transversales.</p>
        </aside>
      </section>
    </main>
  )
}
