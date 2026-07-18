import 'server-only'

import type { Metadata } from 'next'
import { getAppBaseUrl } from '@/lib/appBaseUrl'

export const PUBLIC_SITE_NAME = 'SINEP RD'
export const PUBLIC_SITE_DESCRIPTION =
  'Sistema de Información Eclesiástica y Pastoral para consulta pública de jurisdicciones, personas e instituciones de la Iglesia.'

function normalizePath(path: string) {
  if (!path || path === '/') return '/'
  return `/${path.replace(/^\/+|\/+$/g, '')}`
}

export function getPublicMetadataBase() {
  return new URL(getAppBaseUrl())
}

type PublicMetadataInput = {
  title: string
  description: string
  path: string
  image?: string | null
  imageAlt?: string
  type?: 'website' | 'profile'
  index?: boolean
}

export function buildPublicMetadata({
  title,
  description,
  path,
  image,
  imageAlt,
  type = 'website',
  index = true,
}: PublicMetadataInput): Metadata {
  const canonicalPath = normalizePath(path)
  const images = image
    ? [{ url: image, alt: imageAlt || title }]
    : undefined

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    robots: { index, follow: index },
    openGraph: {
      title,
      description,
      siteName: PUBLIC_SITE_NAME,
      locale: 'es_DO',
      type,
      url: canonicalPath,
      images,
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  }
}
