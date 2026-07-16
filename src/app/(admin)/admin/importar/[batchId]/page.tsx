import { ImportBatchDetailPage } from '@/features/importaciones'
import ImportBatchReportAndReversalPanel from '@/features/importaciones/admin/ImportBatchReportAndReversalPanel'

type Props = {
  params: Promise<{ batchId: string }>
}

export default async function AdminImportBatchDetailRoute({ params }: Props) {
  const { batchId } = await params
  return (
    <>
      <ImportBatchDetailPage batchId={batchId} />
      <ImportBatchReportAndReversalPanel batchId={batchId} />
    </>
  )
}
