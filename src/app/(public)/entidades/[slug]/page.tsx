import { notFound } from 'next/navigation'
import EntityDetailServerView from '@/features/entidades/EntityDetailServerView'
import { loadPublicEntityDetail } from '@/lib/public/cache'

type PageProps = {
  params: Promise<{ slug: string }>
}

export const revalidate = 900

export default async function EntityDetailPage({ params }: PageProps) {
  const { slug } = await params

  try {
    const data = await loadPublicEntityDetail(slug)
    if (!data) notFound()
    return <EntityDetailServerView data={data} />
  } catch (error) {
    console.error('Unable to server render public entity detail', error)
    return <main className="container dashboard-page"><div className="error-box">No se pudo cargar la ficha de la entidad.</div></main>
  }
}
