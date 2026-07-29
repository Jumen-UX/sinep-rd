import Image from 'next/image'

type PersonPhotoProps = {
  src: string
}

type PublicPersonPhotoProps = PersonPhotoProps & {
  displayName: string
}

export function PublicPersonPhoto({ src, displayName }: PublicPersonPhotoProps) {
  return (
    <Image
      alt={`Fotografía de ${displayName}`}
      className="person-photo"
      height={400}
      priority
      sizes="(max-width: 640px) 100vw, 320px"
      src={src}
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
      src={src}
      width={96}
    />
  )
}
