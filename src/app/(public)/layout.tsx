import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import {
  buildPublicMetadata,
  getPublicMetadataBase,
  PUBLIC_SITE_DESCRIPTION,
  PUBLIC_SITE_NAME,
} from '@/lib/public/metadata'

export const metadata: Metadata = {
  metadataBase: getPublicMetadataBase(),
  ...buildPublicMetadata({
    title: PUBLIC_SITE_NAME,
    description: PUBLIC_SITE_DESCRIPTION,
    path: '/',
  }),
  title: {
    default: PUBLIC_SITE_NAME,
    template: `%s | ${PUBLIC_SITE_NAME}`,
  },
}

export default function PublicLayout({ children }: { children: ReactNode }) {
  return children
}
