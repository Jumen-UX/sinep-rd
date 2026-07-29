import { notFound } from 'next/navigation'
import PublicRegistryProfileView from '@/features/ecclesial-registry/public/PublicRegistryProfileView'
import { loadPublicInstitutionProfile } from '@/lib/public/ecclesial-registry-cache'

type PageProps = { params: Promise<{ slug: string }> }

export const revalidate = 900

export default async function PublicInstitutionPage({ params }: PageProps) {
  const { slug } = await params
  try {
    const data = await loadPublicInstitutionProfile(slug)
    if (!data) notFound()
    return <PublicRegistryProfileView data={data} />
  } catch (error) {
    console.error('Unable to render public ecclesial institution profile', error)
    return <main className="container dashboard-page"><div className="error-box">No se pudo cargar la ficha de la institución.</div></main>
  }
}
