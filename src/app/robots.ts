import type { MetadataRoute } from 'next'
import { getAppBaseUrl } from '@/lib/appBaseUrl'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getAppBaseUrl()

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
