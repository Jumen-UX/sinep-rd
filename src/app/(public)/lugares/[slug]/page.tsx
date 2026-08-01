import type { Metadata } from 'next'
import { notFound, unstable_rethrow } from 'next/navigation'
import { PublicBreadcrumbs } from '@/components/public/PublicBreadcrumbs'
import PublicRegistryProfileView from '@/features/ecclesial-registry/public/PublicRegistryProfileView'
import { loadPublicPlaceProfile } from '@/lib/public/ecclesial-registry-cache'
import { buildPlaceMetadata, buildRegistryJsonLd, serializeJsonLd } from '@/lib/public/ecclesial-registry-seo'

type PageProps = { params: Promise<{ slug: string }> }

export const revalidate = 900

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const data = await loadPublicPlaceProfile(slug).catch(() => null)
  if (!data) return { title: 'Lugar no encontrado', robots: { index: false, follow: false } }
  return buildPlaceMetadata(data, slug)
}

export default async function PublicPlacePage({ params }: PageProps) {
  const { slug } = await params
  try {
    const data = await loadPublicPlaceProfile(slug)
    if (!data) notFound()
    const jsonLd = buildRegistryJsonLd(data, slug)
    const title = String(data.record.official_name || data.record.name)
    const parentItems = data.primary_entity_slug
      ? [
          { label: 'Diócesis y jurisdicciones', href: '/diocesis' },
          { label: data.primary_entity_name ?? 'Entidad principal', href: `/entidades/${data.primary_entity_slug}` },
        ]
      : [{ label: 'Diócesis y jurisdicciones', href: '/diocesis' }]

    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
        <div className="container dashboard-page">
          <PublicBreadcrumbs items={[
            { label: 'Inicio', href: '/' },
            ...parentItems,
            { label: title },
          ]} />
        </div>
        <PublicRegistryProfileView data={data} />
      </>
    )
  } catch (error) {
    unstable_rethrow(error)
    console.error('Unable to render public ecclesiastical place profile', error)
    return <main className="container dashboard-page"><div className="error-box">No se pudo cargar la ficha del lugar.</div></main>
  }
}
