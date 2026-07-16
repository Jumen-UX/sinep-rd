import { RecordCompletenessPage } from '@/features/data-quality'
import ImportQualityQueuePanel from '@/features/data-quality/admin/ImportQualityQueuePanel'

export default function RecordCompletenessRoute() {
  return (
    <>
      <RecordCompletenessPage />
      <ImportQualityQueuePanel />
    </>
  )
}