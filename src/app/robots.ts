import type { MetadataRoute } from 'next'
import { getAppBaseUrl } from '@/lib/appBaseUrl'
import { isPublicIndexingEnabled } from '@/lib/public/indexing'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getAppBaseUrl()

  if (!isPublicIndexingEnabled()) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
      host: baseUrl,
    }
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
