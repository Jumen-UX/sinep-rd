import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { loadPublicEntityDetail } from '@/lib/public/cache'
import { buildPublicMetadata } from '@/lib/public/metadata'

type LayoutProps = {
  children: ReactNode
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Omit<LayoutProps, 'children'>): Promise<Metadata> {
  const { slug } = await params
  const data = await loadPublicEntityDetail(slug)
  const entity = data?.entity

  if (!entity) {
    return buildPublicMetadata({
      title: 'Entidad no encontrada',
      description: 'La ficha solicitada no está disponible públicamente.',
      path: `/entidades/${slug}`,
      index: false,
    })
  }

  const title = entity.official_name || entity.name
  const description = entity.description?.trim()
    || (entity.cathedral_name
      ? `${title}. Sede: ${entity.cathedral_name}. Consulta su ficha institucional en SINEP RD.`
      : `Ficha institucional pública de ${title} en SINEP RD.`)

  return buildPublicMetadata({
    title,
    description,
    path: `/entidades/${entity.slug}`,
  })
}

export default function EntityDetailLayout({ children }: LayoutProps) {
  return children
}
