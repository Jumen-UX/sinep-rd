import 'server-only'

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on'])

function isEnabled(value: string | undefined) {
  const normalized = value?.trim().toLowerCase()
  return normalized ? ENABLED_VALUES.has(normalized) : false
}

export function isPublicIndexingEnabled() {
  return isEnabled(process.env.PUBLIC_INDEXING_ENABLED)
    && isEnabled(process.env.PUBLIC_LAUNCH_APPROVED)
}
