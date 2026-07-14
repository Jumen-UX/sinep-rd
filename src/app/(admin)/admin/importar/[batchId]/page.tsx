import { ImportBatchDetailPage } from '@/features/importaciones'

type Props = {
  params: Promise<{ batchId: string }>
}

export default async function AdminImportBatchDetailRoute({ params }: Props) {
  const { batchId } = await params
  return <ImportBatchDetailPage batchId={batchId} />
}
