import 'server-only'

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on'])

export function isPublicIndexingEnabled() {
  const value = process.env.PUBLIC_INDEXING_ENABLED?.trim().toLowerCase()
  return value ? ENABLED_VALUES.has(value) : false
}
