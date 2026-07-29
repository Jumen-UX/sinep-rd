import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadPublicOrganizationDetail } from '@/lib/public/cache'

type PageProps = {
  params: Promise<{ id: string }>
}

export const revalidate = 900

export default async function CollegialOrganizationPage({ params }: PageProps) {
  const { id } = await params
  let detail: Awaited<ReturnType<typeof loadPublicOrganizationDetail>>

  try {
    detail = await loadPublicOrganizationDetail(id)
  } catch (error) {
    console.error('Unable to server render public collegial organization detail', error)
    return <main className="container"><div className="error-box">No se pudo cargar el organismo.</div></main>
  }

  if (!detail) notFound()

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
