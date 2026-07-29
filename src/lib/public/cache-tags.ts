export const PUBLIC_CACHE_REVALIDATE_SECONDS = 300

export const PUBLIC_CACHE_TAGS = {
  dashboard: 'public:dashboard',
  directories: 'public:directories',
  registry: 'public:registry',
} as const

export type PublicCacheScope = keyof typeof PUBLIC_CACHE_TAGS | 'all'
