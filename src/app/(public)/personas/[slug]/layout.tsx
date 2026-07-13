import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { loadPublicPersonDetail } from '@/lib/public/cache'

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
    return {
      title: 'Persona no encontrada',
      description: 'La ficha solicitada no está disponible públicamente.',
      robots: { index: false, follow: false },
    }
  }

  const type = personTypeLabel(data.ecclesial_state?.effective_person_type ?? person.person_type)
  const description = person.biography_public?.trim()
    || `Ficha pública de ${person.display_name}, ${type.toLowerCase()}, en SINEP RD.`

  return {
    title: person.display_name,
    description,
    alternates: { canonical: `/personas/${person.slug}` },
    openGraph: {
      title: person.display_name,
      description,
      type: 'profile',
      url: `/personas/${person.slug}`,
      images: person.photo_url ? [{ url: person.photo_url, alt: person.display_name }] : undefined,
    },
  }
}

export default function PersonDetailLayout({ children }: LayoutProps) {
  return children
}
