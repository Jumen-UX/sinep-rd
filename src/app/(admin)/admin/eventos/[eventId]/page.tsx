'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { EventReviewPage } from '@/features/events'

export default function EventDetailPage() {
  const params = useParams<{ eventId: string }>()
  const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId

  return (
    <>
      <div className="container" style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 18 }}>
        <Link className="button button-secondary" href={`/admin/eventos/${eventId}/corregir`}>
          Corregir evento
        </Link>
      </div>
      <EventReviewPage />
    </>
  )
}
