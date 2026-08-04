import type { Metadata } from 'next'
import PublicDashboardShell from '@/features/public/PublicDashboardShell'
import {
  loadPublicDashboardBundle,
  loadPublicTerritorialDashboardBundle,
  type PublicView,
} from '@/lib/public/dashboard'
import { buildPublicMetadata } from '@/lib/public/metadata'
import '../public-combobox.css'
import '../public-dashboard.css'
import '../public-territorial.css'

export const metadata: Metadata = buildPublicMetadata({
  title: 'Información eclesial y pastoral',
  description: 'Consulta pública de jurisdicciones, personas, instituciones y estructuras pastorales, administrativas y colegiales de la Iglesia en distintos países.',
  path: '/',
})

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const allowedViews = new Set<PublicView>(['territorial', 'clero', 'pastoral', 'administrativa', 'colegial'])
const firstValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value
const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams
  const requestedView = firstValue(params.vista)
  const requestedCountry = firstValue(params.pais)?.toUpperCase()
  const requestedProvince = firstValue(params.provincia) ?? ''
  const requestedJurisdictionId = firstValue(params.jurisdiccion) ?? ''
  const requestedStructureNodeId = firstValue(params.nodo) ?? ''
  const requestedParishId = firstValue(params.parroquia) ?? ''
  const initialView = allowedViews.has(requestedView as PublicView) ? requestedView as PublicView : 'territorial'
  const initialDataComplete = initialView !== 'territorial'

  try {
    const { data: initialData, summary: initialSummary } = initialDataComplete
      ? await loadPublicDashboardBundle()
      : await loadPublicTerritorialDashboardBundle()
    const initialCountry = requestedCountry && initialData.countries.some((item) => item.key === requestedCountry)
      ? requestedCountry
      : ''
    const countryDioceses = initialData.dioceses.filter((item) => (
      !initialCountry
      || (item.country_iso2 ? item.country_iso2 === initialCountry : initialCountry === 'DO')
    ))
    const initialProvince = countryDioceses.find((item) => {
      const provinceName = item.ecclesiastical_province_name
      return provinceName && (provinceName === requestedProvince || slugify(provinceName) === requestedProvince)
    })?.ecclesiastical_province_name ?? ''
    const initialJurisdictionId = countryDioceses.find((item) => (
      item.id === requestedJurisdictionId
      && (!initialProvince || item.ecclesiastical_province_name === initialProvince)
    ))?.id ?? ''
    const initialParishId = initialJurisdictionId
      ? initialData.parishes.find((item) => item.id === requestedParishId && item.diocese_id === initialJurisdictionId)?.id ?? ''
      : ''

    return (
      <PublicDashboardShell
        initialCountry={initialCountry}
        initialData={initialData}
        initialDataComplete={initialDataComplete}
        initialJurisdictionId={initialJurisdictionId}
        initialParishId={initialParishId}
        initialProvince={initialProvince}
        initialStructureNodeId={requestedStructureNodeId}
        initialSummary={initialSummary}
        initialView={initialView}
      />
    )
  } catch (error) {
    console.error('Unable to render the public dashboard', error)
    return <main className="container"><div className="error-box">No se pudo cargar el portal público. Intenta nuevamente.</div></main>
  }
}
