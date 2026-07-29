import 'server-only'

import { revalidatePath, revalidateTag } from 'next/cache'
import { PUBLIC_CACHE_TAGS, type PublicCacheScope } from './cache-tags'

const scopeTags: Record<Exclude<PublicCacheScope, 'all'>, string[]> = {
  dashboard: [PUBLIC_CACHE_TAGS.dashboard],
  directories: [PUBLIC_CACHE_TAGS.dashboard, PUBLIC_CACHE_TAGS.directories],
  registry: [PUBLIC_CACHE_TAGS.dashboard, PUBLIC_CACHE_TAGS.directories, PUBLIC_CACHE_TAGS.registry],
}

const scopePaths: Record<Exclude<PublicCacheScope, 'all'>, Array<[string, 'layout' | 'page']>> = {
  dashboard: [['/', 'page']],
  directories: [
    ['/', 'page'],
    ['/diocesis', 'page'],
    ['/personas', 'page'],
    ['/entidades/[slug]', 'page'],
    ['/personas/[slug]', 'page'],
  ],
  registry: [
    ['/', 'page'],
    ['/lugares/[slug]', 'page'],
    ['/instituciones/[slug]', 'page'],
    ['/sitemap.xml', 'page'],
  ],
}

export function revalidatePublicCache(scope: PublicCacheScope = 'all') {
  const scopes = scope === 'all'
    ? (Object.keys(scopeTags) as Array<Exclude<PublicCacheScope, 'all'>>)
    : [scope]

  const tags = new Set(scopes.flatMap((item) => scopeTags[item]))
  const paths = new Map(scopes.flatMap((item) => scopePaths[item]))

  for (const tag of tags) revalidateTag(tag)
  for (const [path, type] of paths) revalidatePath(path, type)
}
