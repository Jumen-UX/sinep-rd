import 'server-only'

import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import {
  loadPublicInstitutionProfile as loadUncachedPublicInstitutionProfile,
  loadPublicPlaceProfile as loadUncachedPublicPlaceProfile,
} from './ecclesial-registry-detail'

export const PUBLIC_REGISTRY_DETAIL_TAG = 'public-ecclesial-registry-details'
export const PUBLIC_REGISTRY_REVALIDATE_SECONDS = 900

const cachedPlace = unstable_cache(
  async (slug: string) => loadUncachedPublicPlaceProfile(slug),
  ['public-ecclesiastical-place-profile-v1'],
  { revalidate: PUBLIC_REGISTRY_REVALIDATE_SECONDS, tags: [PUBLIC_REGISTRY_DETAIL_TAG] },
)

const cachedInstitution = unstable_cache(
  async (slug: string) => loadUncachedPublicInstitutionProfile(slug),
  ['public-ecclesial-institution-profile-v1'],
  { revalidate: PUBLIC_REGISTRY_REVALIDATE_SECONDS, tags: [PUBLIC_REGISTRY_DETAIL_TAG] },
)

export const loadPublicPlaceProfile = cache(cachedPlace)
export const loadPublicInstitutionProfile = cache(cachedInstitution)
