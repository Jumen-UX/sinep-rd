import type { Metadata } from 'next'
import PublicDashboardClient from '@/features/public/PublicDashboardClient'
import { loadPublicDashboardBundle, type PublicView } from '@/lib/public/dashboard'
import { buildPublicMetadata } from '@/lib/public/metadata'

export const metadata: Metadata = buildPublicMetadata({
  title: 'Información eclesial y pastoral',
  description: 'Consulta pública de jurisdicciones, personas, estructuras pastorales, administrativas y colegiales de SINEP RD.',
  path: '/',
})

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const allowedViews = new Set<PublicView>(['territorial', 'clero', 'pastoral', 'administrativa', 'colegial'])
const firstValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams
  const requestedView = firstValue(params.vista)
  const requestedProvince = firstValue(params.provincia) ?? ''
  const initialView = allowedViews.has(requestedView as PublicView) ? requestedView as PublicView : 'territorial'

  try {
    const { data: initialData, summary: initialSummary } = await loadPublicDashboardBundle()
    const exactProvince = initialSummary.dioceses.provinces.find((item) => item.name === requestedProvince || item.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') === requestedProvince)?.name ?? ''
    return <PublicDashboardClient initialData={initialData} initialSummary={initialSummary} initialView={initialView} initialProvince={exactProvince} />
  } catch (error) {
    console.error('Unable to render the public dashboard', error)
    return <main className="container"><div className="error-box">No se pudo cargar el portal público. Intenta nuevamente.</div></main>
  }
}
