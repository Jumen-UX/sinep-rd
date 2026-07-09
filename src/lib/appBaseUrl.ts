function normalizeBaseUrl(value: string) {
  const url = new URL(value)
  url.pathname = ''
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

export function getAppBaseUrl() {
  const value = process.env.APP_BASE_URL?.trim()

  if (!value) {
    throw new Error('Missing environment variable: APP_BASE_URL')
  }

  return normalizeBaseUrl(value)
}
