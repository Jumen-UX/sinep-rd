const rasterPathPattern = /(?:\.(?:avif|gif|jpe?g|png|webp)|\/(?:avif|gif|jpe?g|png|webp))$/i

export function normalizePersonPhotoSource(src: string) {
  try {
    const url = new URL(src)
    if (url.hostname === 'placehold.co' && !rasterPathPattern.test(url.pathname)) {
      url.pathname = `${url.pathname.replace(/\/$/, '')}/png`
    }
    return url.toString()
  } catch {
    return src
  }
}
