import type { MetadataRoute } from 'next'
import { getAppBaseUrl } from '@/lib/appBaseUrl'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getAppBaseUrl()
  const routes = ['/', '/diocesis', '/personas', '/privacidad', '/cookies', '/aviso-legal']

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '/' ? 'daily' : 'weekly',
    priority: route === '/' ? 1 : 0.7,
  }))
}
