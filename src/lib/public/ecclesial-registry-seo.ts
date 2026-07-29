import type { Metadata } from 'next'
import type { PublicInstitutionProfile, PublicPlaceProfile } from './ecclesial-registry-detail'

const DEFAULT_APP_URL = 'https://sinep-rd.vercel.app'

export function getPublicAppUrl() {
  const configured = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL
  return configured.replace(/\/$/, '')
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function locationText(record: Record<string, unknown>) {
  return [text(record.sector), text(record.municipality), text(record.province), text(record.country_iso2)]
    .filter(Boolean)
    .join(', ')
}

function descriptionFor(
  profile: PublicPlaceProfile | PublicInstitutionProfile,
  label: string,
) {
  const record = profile.record
  const explicit = text(record.description)
  if (explicit) return explicit.slice(0, 155)

  const location = locationText(record)
  const entity = profile.primary_entity_name
  const parts = [
    `${label} en el directorio eclesial de SINEP`,
    entity ? `vinculado a ${entity}` : null,
    location ? `ubicado en ${location}` : null,
  ].filter(Boolean)

  return `${parts.join(', ')}.`.slice(0, 155)
}

function metadataFor(
  profile: PublicPlaceProfile | PublicInstitutionProfile,
  pathname: string,
  typeLabel: string,
): Metadata {
  const record = profile.record
  const name = text(record.official_name) || text(record.name) || typeLabel
  const description = descriptionFor(profile, `${typeLabel}: ${name}`)
  const canonical = `${getPublicAppUrl()}${pathname}`

  return {
    title: `${name} · ${typeLabel}`,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      locale: 'es_DO',
      url: canonical,
      siteName: 'SINEP',
      title: `${name} · ${typeLabel}`,
      description,
    },
    twitter: {
      card: 'summary',
      title: `${name} · ${typeLabel}`,
      description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
  }
}

export function buildPlaceMetadata(profile: PublicPlaceProfile, slug: string): Metadata {
  return metadataFor(profile, `/lugares/${encodeURIComponent(slug)}`, profile.type_name || 'Lugar eclesiástico')
}

export function buildInstitutionMetadata(profile: PublicInstitutionProfile, slug: string): Metadata {
  return metadataFor(profile, `/instituciones/${encodeURIComponent(slug)}`, profile.category_name || 'Institución eclesial')
}

function contactPoint(profile: PublicPlaceProfile | PublicInstitutionProfile) {
  const phone = profile.channels.find((channel) => /^\+?[\d\s().-]{7,}$/.test(channel.value))
  return phone ? { '@type': 'ContactPoint', telephone: phone.value, contactType: 'information' } : undefined
}

function sameAs(profile: PublicPlaceProfile | PublicInstitutionProfile) {
  return profile.channels
    .map((channel) => channel.value)
    .filter((value) => /^https?:\/\//i.test(value))
}

function address(record: Record<string, unknown>) {
  const hasAddress = ['address', 'sector', 'municipality', 'province', 'country_iso2'].some((key) => text(record[key]))
  if (!hasAddress) return undefined

  return {
    '@type': 'PostalAddress',
    streetAddress: text(record.address) || undefined,
    addressLocality: text(record.municipality) || text(record.sector) || undefined,
    addressRegion: text(record.province) || undefined,
    addressCountry: text(record.country_iso2) || undefined,
  }
}

export function buildRegistryJsonLd(
  profile: PublicPlaceProfile | PublicInstitutionProfile,
  slug: string,
) {
  const record = profile.record
  const name = text(record.official_name) || text(record.name) || 'Registro eclesial'
  const isPlace = profile.kind === 'place'
  const pathname = isPlace ? `/lugares/${encodeURIComponent(slug)}` : `/instituciones/${encodeURIComponent(slug)}`
  const canonical = `${getPublicAppUrl()}${pathname}`
  const socialLinks = sameAs(profile)

  return {
    '@context': 'https://schema.org',
    '@type': isPlace ? 'PlaceOfWorship' : 'Organization',
    '@id': `${canonical}#profile`,
    name,
    alternateName: text(record.official_name) && text(record.name) !== text(record.official_name)
      ? text(record.name)
      : undefined,
    description: text(record.description) || undefined,
    url: canonical,
    address: address(record),
    geo: record.latitude != null && record.longitude != null
      ? {
          '@type': 'GeoCoordinates',
          latitude: Number(record.latitude),
          longitude: Number(record.longitude),
        }
      : undefined,
    contactPoint: contactPoint(profile),
    sameAs: socialLinks.length > 0 ? socialLinks : undefined,
    parentOrganization: profile.primary_entity_name
      ? {
          '@type': 'Organization',
          name: profile.primary_entity_name,
          url: profile.primary_entity_slug
            ? `${getPublicAppUrl()}/entidades/${encodeURIComponent(profile.primary_entity_slug)}`
            : undefined,
        }
      : undefined,
    foundingDate: isPlace ? text(record.opened_at) || undefined : text(record.founded_at) || undefined,
  }
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
