import { notFound, unstable_rethrow } from 'next/navigation'
import EntityDetailServerView from '@/features/entidades/EntityDetailServerView'
import PublicJurisdictionStructure from '@/features/entidades/PublicJurisdictionStructure'
import { loadPublicEntityDetail } from '@/lib/public/cache'
import { loadPublicJurisdictionStructure } from '@/lib/public/jurisdiction-structure'

type PageProps = {
  params: Promise<{ slug: string }>
}

export const revalidate = 900

export default async function EntityDetailPage({ params }: PageProps) {
  const { slug } = await params

  try {
    const data = await loadPublicEntityDetail(slug)
    if (!data) notFound()

    const structure = await loadPublicJurisdictionStructure(data.entity.id)

    return (
      <>
        <EntityDetailServerView data={data} />
        <PublicJurisdictionStructure nodes={structure} />
      </>
    )
  } catch (error) {
    unstable_rethrow(error)
    console.error('Unable to server render public entity detail', error)
    return <main className="container dashboard-page"><div className="error-box">No se pudo cargar la ficha de la entidad.</div></main>
  }
}
