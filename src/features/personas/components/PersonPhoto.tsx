import Image from 'next/image'

type PersonPhotoProps = {
  src: string
}

type PublicPersonPhotoProps = PersonPhotoProps & {
  displayName: string
}

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

export function PublicPersonPhoto({ src, displayName }: PublicPersonPhotoProps) {
  return (
    <Image
      alt={`Fotografía de ${displayName}`}
      className="person-photo"
      height={400}
      priority
      sizes="(max-width: 640px) 100vw, 320px"
      src={normalizePersonPhotoSource(src)}
      width={320}
    />
  )
}

export function AdminPersonPhoto({ src }: PersonPhotoProps) {
  return (
    <Image
      alt=""
      height={96}
      sizes="96px"
      src={normalizePersonPhotoSource(src)}
      width={96}
    />
  )
}
