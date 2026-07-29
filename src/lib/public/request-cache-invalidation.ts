import type { PublicCacheScope } from './cache-tags'

export async function requestPublicCacheInvalidation(scope: PublicCacheScope) {
  try {
    const response = await fetch('/api/admin/public-cache', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope }),
    })

    if (!response.ok) {
      console.warn('Public cache invalidation request failed', {
        scope,
        status: response.status,
      })
      return false
    }

    return true
  } catch (error) {
    console.warn('Public cache invalidation request failed', { scope, error })
    return false
  }
}
