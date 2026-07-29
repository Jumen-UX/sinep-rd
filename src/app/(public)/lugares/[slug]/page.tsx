import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
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

    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
        <PublicRegistryProfileView data={data} />
      </>
    )
  } catch (error) {
    console.error('Unable to render public ecclesiastical place profile', error)
    return <main className="container dashboard-page"><div className="error-box">No se pudo cargar la ficha del lugar.</div></main>
  }
}
