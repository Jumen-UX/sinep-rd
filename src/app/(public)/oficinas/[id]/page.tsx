import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadPublicOrganizationDetail } from '@/lib/public/cache'

type PageProps = {
  params: Promise<{ id: string }>
}

export const revalidate = 900

export default async function OfficePage({ params }: PageProps) {
  const { id } = await params
  let detail: Awaited<ReturnType<typeof loadPublicOrganizationDetail>>

  try {
    detail = await loadPublicOrganizationDetail(id)
  } catch (error) {
    console.error('Unable to server render public office detail', error)
    return <main className="container"><div className="error-box">No se pudo cargar la oficina.</div></main>
  }

  if (!detail) notFound()

  return (
    <main className="container dashboard-page home-dashboard">
      <div className="detail-backlink"><Link href="/?vista=administrativa">← Volver al explorador</Link></div>
      <section className="home-hero-panel card">
        <div className="home-hero-copy">
          <p className="eyebrow">Organización administrativa</p>
          <h1>{detail.unit.name}</h1>
          <p className="lead">{detail.unit.description ?? 'Ficha pública de la unidad administrativa seleccionada.'}</p>
        </div>
        <aside className="home-context-card">
          <p className="eyebrow">Organigrama</p>
          <h2>{detail.chart?.name ?? 'Sin organigrama publicado'}</h2>
          <p className="meta">Curia, oficinas, departamentos o dependencias administrativas.</p>
        </aside>
      </section>
    </main>
  )
}
