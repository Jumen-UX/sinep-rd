import ImportBatchDetailPage from '@/features/importaciones/admin/ImportBatchDetailPage'

type Props = {
  params: Promise<{ batchId: string }>
}

export default async function AdminImportBatchDetailRoute({ params }: Props) {
  const { batchId } = await params
  return <ImportBatchDetailPage batchId={batchId} />
}
