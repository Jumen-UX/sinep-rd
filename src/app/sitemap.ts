import type { MetadataRoute } from 'next'
import { getAppBaseUrl } from '@/lib/appBaseUrl'
import { isPublicIndexingEnabled } from '@/lib/public/indexing'
import { fetchSupabaseJson } from '@/lib/supabase/rest'

type SitemapRecord = {
  slug: string
  updated_at: string | null
}

const staticRoutes = ['/', '/diocesis', '/personas', '/privacidad', '/cookies', '/aviso-legal']

function validDate(value: string | null) {
  if (!value) return new Date()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isPublicIndexingEnabled()) return []

  const baseUrl = getAppBaseUrl()
  const generatedAt = new Date()

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: generatedAt,
    changeFrequency: route === '/' ? 'daily' : 'weekly',
    priority: route === '/' ? 1 : 0.7,
  }))

  const [people, entities] = await Promise.all([
    fetchSupabaseJson<SitemapRecord[]>('person_public_directory', {
      select: 'slug,updated_at',
      order: 'updated_at.desc.nullslast',
    }).catch(() => []),
    fetchSupabaseJson<SitemapRecord[]>('ecclesiastical_entities', {
      status: 'eq.active',
      visibility: 'eq.public',
      select: 'slug,updated_at',
      order: 'updated_at.desc.nullslast',
    }).catch(() => []),
  ])

  const personEntries: MetadataRoute.Sitemap = people
    .filter((person) => Boolean(person.slug))
    .map((person) => ({
      url: `${baseUrl}/personas/${encodeURIComponent(person.slug)}`,
      lastModified: validDate(person.updated_at),
      changeFrequency: 'monthly',
      priority: 0.6,
    }))

  const entityEntries: MetadataRoute.Sitemap = entities
    .filter((entity) => Boolean(entity.slug))
    .map((entity) => ({
      url: `${baseUrl}/entidades/${encodeURIComponent(entity.slug)}`,
      lastModified: validDate(entity.updated_at),
      changeFrequency: 'weekly',
      priority: 0.8,
    }))

  return [...staticEntries, ...entityEntries, ...personEntries]
}
