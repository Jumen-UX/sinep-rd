import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PublicRegistryProfileView from '@/features/ecclesial-registry/public/PublicRegistryProfileView'
import { loadPublicInstitutionProfile } from '@/lib/public/ecclesial-registry-cache'
import { buildInstitutionMetadata, buildRegistryJsonLd, serializeJsonLd } from '@/lib/public/ecclesial-registry-seo'

type PageProps = { params: Promise<{ slug: string }> }

export const revalidate = 900

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const data = await loadPublicInstitutionProfile(slug).catch(() => null)
  if (!data) return { title: 'Institución no encontrada', robots: { index: false, follow: false } }
  return buildInstitutionMetadata(data, slug)
}

export default async function PublicInstitutionPage({ params }: PageProps) {
  const { slug } = await params
  try {
    const data = await loadPublicInstitutionProfile(slug)
    if (!data) notFound()
    const jsonLd = buildRegistryJsonLd(data, slug)

    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
        <PublicRegistryProfileView data={data} />
      </>
    )
  } catch (error) {
    console.error('Unable to render public ecclesial institution profile', error)
    return <main className="container dashboard-page"><div className="error-box">No se pudo cargar la ficha de la institución.</div></main>
  }
}
