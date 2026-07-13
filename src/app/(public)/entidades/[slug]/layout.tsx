import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { loadPublicEntityDetail } from '@/lib/public/entity-detail'

type LayoutProps = {
  children: ReactNode
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Omit<LayoutProps, 'children'>): Promise<Metadata> {
  const { slug } = await params
  const data = await loadPublicEntityDetail(slug)
  const entity = data?.entity

  if (!entity) {
    return {
      title: 'Entidad no encontrada',
      description: 'La ficha solicitada no está disponible públicamente.',
      robots: { index: false, follow: false },
    }
  }

  const title = entity.official_name || entity.name
  const description = entity.description?.trim()
    || (entity.cathedral_name
      ? `${title}. Sede: ${entity.cathedral_name}. Consulta su ficha institucional en SINEP RD.`
      : `Ficha institucional pública de ${title} en SINEP RD.`)

  return {
    title,
    description,
    alternates: { canonical: `/entidades/${entity.slug}` },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/entidades/${entity.slug}`,
    },
  }
}

export default function EntityDetailLayout({ children }: LayoutProps) {
  return children
}
