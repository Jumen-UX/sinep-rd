import { notFound } from 'next/navigation'
import PersonDetailServerView from '@/features/personas/PersonDetailServerView'
import { loadPublicPersonDetail } from '@/lib/public/person-detail'

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function PersonDetailPage({ params }: PageProps) {
  const { slug } = await params

  try {
    const data = await loadPublicPersonDetail(slug)
    if (!data) notFound()
    return <PersonDetailServerView data={data} />
  } catch (error) {
    console.error('Unable to server render public person detail', error)
    return <main className="container"><div className="error-box">No se pudo cargar la ficha de la persona.</div></main>
  }
}
