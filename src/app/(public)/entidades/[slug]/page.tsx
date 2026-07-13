'use client'

import { useParams } from 'next/navigation'
import { EntityDetailPageView } from '@/features/entidades/EntityDetailPage'
import EntityInstitutionalTimeline from '@/features/entidades/EntityInstitutionalTimeline'

export default function EntityDetailPage() {
  const params = useParams<{ slug: string }>()
  const slug = params?.slug

  return (
    <>
      <EntityDetailPageView />
      {slug && <EntityInstitutionalTimeline slug={slug} />}
    </>
  )
}
