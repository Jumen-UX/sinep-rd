import type { MetadataRoute } from 'next'
import { getAppBaseUrl } from '@/lib/appBaseUrl'
import { isPublicIndexingEnabled } from '@/lib/public/indexing'
import { fetchSupabaseJson } from '@/lib/supabase/rest'

type SitemapRecord = {
  slug: string
  updated_at: string | null
}

const staticRoutes = ['/', '/diocesis', '/personas', '/lugares', '/instituciones', '/privacidad', '/cookies', '/aviso-legal']

function validDate(value: string | null) {
  if (!value) return new Date()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

function dynamicEntries(
  baseUrl: string,
  basePath: string,
  records: SitemapRecord[],
  priority: number,
): MetadataRoute.Sitemap {
  return records
    .filter((record) => Boolean(record.slug))
    .map((record) => ({
      url: `${baseUrl}${basePath}/${encodeURIComponent(record.slug)}`,
      lastModified: validDate(record.updated_at),
      changeFrequency: 'monthly',
      priority,
    }))
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

  const [people, entities, places, institutions] = await Promise.all([
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
    fetchSupabaseJson<SitemapRecord[]>('ecclesiastical_places', {
      status: 'eq.active',
      visibility: 'eq.public',
      select: 'slug,updated_at',
      order: 'updated_at.desc.nullslast',
    }).catch(() => []),
    fetchSupabaseJson<SitemapRecord[]>('ecclesial_institutions', {
      status: 'eq.active',
      visibility: 'eq.public',
      select: 'slug,updated_at',
      order: 'updated_at.desc.nullslast',
    }).catch(() => []),
  ])

  return [
    ...staticEntries,
    ...dynamicEntries(baseUrl, '/entidades', entities, 0.8),
    ...dynamicEntries(baseUrl, '/personas', people, 0.6),
    ...dynamicEntries(baseUrl, '/lugares', places, 0.7),
    ...dynamicEntries(baseUrl, '/instituciones', institutions, 0.7),
  ]
}
