import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { normalizePersonPhotoSource } from '@/features/personas/person-photo-source'
import { loadPublicPersonDetail } from '@/lib/public/cache'
import { buildPublicMetadata } from '@/lib/public/metadata'

type LayoutProps = {
  children: ReactNode
  params: Promise<{ slug: string }>
}

function personTypeLabel(value: string | null) {
  const labels: Record<string, string> = {
    bishop: 'Obispo',
    priest: 'Sacerdote',
    deacon: 'Diácono',
    religious: 'Religioso/a',
    layperson: 'Laico/a',
  }
  return value ? labels[value] ?? value : 'Persona'
}

export async function generateMetadata({ params }: Omit<LayoutProps, 'children'>): Promise<Metadata> {
  const { slug } = await params
  const data = await loadPublicPersonDetail(slug)
  const person = data?.person

  if (!person) {
    return buildPublicMetadata({
      title: 'Persona no encontrada',
      description: 'La ficha solicitada no está disponible públicamente.',
      path: `/personas/${slug}`,
      index: false,
    })
  }

  const type = personTypeLabel(data.ecclesial_state?.effective_person_type ?? person.person_type)
  const description = person.biography_public?.trim()
    || `Ficha pública de ${person.display_name}, ${type.toLowerCase()}, en SINEP RD.`
  const image = person.photo_url ? normalizePersonPhotoSource(person.photo_url) : null

  return buildPublicMetadata({
    title: person.display_name,
    description,
    path: `/personas/${person.slug}`,
    image,
    imageAlt: person.display_name,
    type: 'profile',
  })
}

export default function PersonDetailLayout({ children }: LayoutProps) {
  return children
}
