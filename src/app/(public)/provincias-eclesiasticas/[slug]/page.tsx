import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadPublicEcclesiasticalProvinceDetail } from '@/lib/public/cache'

type PageProps = {
  params: Promise<{ slug: string }>
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('es-DO').format(value)
}

export const revalidate = 900

export default async function EcclesiasticalProvincePage({ params }: PageProps) {
  const { slug } = await params
  let detail: Awaited<ReturnType<typeof loadPublicEcclesiasticalProvinceDetail>>

  try {
    detail = await loadPublicEcclesiasticalProvinceDetail(slug)
  } catch (error) {
    console.error('Unable to server render public ecclesiastical province detail', error)
    return <main className="container"><div className="error-box">No se pudo cargar la provincia eclesiástica.</div></main>
  }

  if (!detail) notFound()

  const { province, jurisdictions } = detail

  return (
    <main className="container dashboard-page home-dashboard">
      <div className="detail-backlink"><Link href={`/?vista=territorial&provincia=${province.slug}`}>← Volver al explorador</Link></div>

      <section className="home-hero-panel card">
        <div className="home-hero-copy">
          <p className="eyebrow">Provincia eclesiástica</p>
          <h1>{province.name}</h1>
          <p className="lead">Ficha pública de la provincia eclesiástica, su sede metropolitana, jurisdicciones sufragáneas y datos agregados disponibles.</p>
          <div className="home-hero-actions">
            {province.metropolitan_see && <Link className="button button-primary" href={`/entidades/${province.metropolitan_see.slug}`}>Ver sede metropolitana</Link>}
            <Link className="button button-secondary" href={`/?vista=territorial&provincia=${province.slug}`}>Usar como filtro</Link>
          </div>
        </div>
        <aside className="home-context-card">
          <p className="eyebrow">Sede metropolitana</p>
          <h2>{province.metropolitan_see?.name ?? 'Sin sede registrada'}</h2>
          <p className="meta">{province.current_metropolitan_title ?? 'Cargo no registrado'}{province.current_metropolitan_name ? ` · ${province.current_metropolitan_name}` : ''}</p>
        </aside>
      </section>

      <section className="home-metric-strip" aria-label="Resumen de provincia eclesiástica">
        <div className="home-metric-card"><span>Jurisdicciones</span><strong>{province.jurisdiction_count}</strong><small>Metropolitana y sufragáneas</small></div>
        <div className="home-metric-card"><span>Fieles católicos</span><strong>{formatNumber(province.total_catholics)}</strong><small>Dato agregado disponible</small></div>
        <div className="home-metric-card"><span>Población</span><strong>{formatNumber(province.total_population)}</strong><small>Dato agregado disponible</small></div>
        <div className="home-metric-card"><span>Parroquias reportadas</span><strong>{formatNumber(province.reported_parishes)}</strong><small>Estadística agregada</small></div>
      </section>

      <section className="card dashboard-section">
        <div className="section-heading"><div><p className="eyebrow">Organigrama territorial</p><h2>Jurisdicciones de la provincia</h2></div></div>
        <div className="list-table compact-list-table">
          {jurisdictions.map((item) => (
            <Link className="list-row" href={`/entidades/${item.slug}`} key={item.id}>
              <span><strong>{item.name}</strong><small>{item.entity_type_name ?? 'Jurisdicción'}</small></span>
              <span>{item.current_ordinary_title ?? 'Sin cargo registrado'}</span>
              <span>{item.current_ordinary_name ?? 'Sin ordinario registrado'}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
