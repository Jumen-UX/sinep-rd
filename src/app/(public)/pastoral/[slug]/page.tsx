import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadPublicOrganizationUnitDetail } from '@/lib/public/cache'

type PageProps = {
  params: Promise<{ slug: string }>
}

export const revalidate = 900

export default async function OrganizationUnitPage({ params }: PageProps) {
  const { slug } = await params
  let item: Awaited<ReturnType<typeof loadPublicOrganizationUnitDetail>>

  try {
    item = await loadPublicOrganizationUnitDetail(slug)
  } catch (error) {
    console.error('Unable to server render public organization unit detail', error)
    return <main className="container"><div className="error-box">No se pudo cargar la unidad organizativa.</div></main>
  }

  if (!item) notFound()

  return (
    <main className="container dashboard-page home-dashboard">
      <div className="detail-backlink"><Link href="/?vista=pastoral">← Volver al explorador</Link></div>
      <section className="home-hero-panel card">
        <div className="home-hero-copy">
          <p className="eyebrow">Unidad organizativa</p>
          <h1>{item.name}</h1>
          <p className="lead">{item.description ?? 'Ficha pública de la unidad organizativa seleccionada.'}</p>
          <div className="home-hero-actions">
            {item.ecclesiastical_entity_slug && <Link className="button button-primary" href={`/entidades/${item.ecclesiastical_entity_slug}`}>Ver entidad vinculada</Link>}
          </div>
        </div>
        <aside className="home-context-card">
          <p className="eyebrow">Ubicación organizativa</p>
          <h2>{item.organization_chart_name ?? 'Organigrama no indicado'}</h2>
          <p className="meta">
            {item.ecclesiastical_entity_name ?? item.pastoral_area_name ?? 'Sin ámbito registrado'}
            {item.parent_unit_name ? ` · ${item.parent_unit_name}` : ''}
          </p>
        </aside>
      </section>
    </main>
  )
}
