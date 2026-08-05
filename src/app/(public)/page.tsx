import type { Metadata } from 'next'
import PublicDashboardShell from '@/features/public/PublicDashboardShell'
import { loadPublicTerritorialDashboardBundle, type PublicView } from '@/lib/public/dashboard'
import { buildPublicMetadata } from '@/lib/public/metadata'
import '../public-combobox.css'
import '../public-dashboard.css'
import '../public-territorial.css'

export const metadata: Metadata = buildPublicMetadata({
  title: 'Plan de jurisdicciones eclesiales',
  description: 'Explora la organización jurisdiccional de la Iglesia católica desde la Santa Sede, con contexto histórico, geográfico y pedagógico.',
  path: '/',
})

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const firstValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value
const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams
  const requestedCountry = firstValue(params.pais)?.toUpperCase()
  const requestedProvince = firstValue(params.provincia) ?? ''
  const requestedJurisdictionId = firstValue(params.jurisdiccion) ?? ''
  const initialView: PublicView = 'territorial'

  try {
    const { data: initialData, summary: initialSummary } = await loadPublicTerritorialDashboardBundle()
    const initialCountry = requestedCountry && initialData.countries.some((item) => item.key === requestedCountry)
      ? requestedCountry
      : ''
    const jurisdictionsWithExplicitCoverage = new Set(
      initialData.jurisdiction_coverages.map((coverage) => coverage.jurisdiction_id),
    )
    const jurisdictionIdsForCountry = new Set(
      initialData.jurisdiction_coverages
        .filter((coverage) => coverage.country_iso2 === initialCountry)
        .map((coverage) => coverage.jurisdiction_id),
    )
    const countryJurisdictions = initialData.dioceses.filter((item) => (
      !initialCountry
      || jurisdictionIdsForCountry.has(item.id)
      || (!jurisdictionsWithExplicitCoverage.has(item.id)
        && (item.country_iso2 ? item.country_iso2 === initialCountry : initialCountry === 'DO'))
    ))
    const initialProvince = countryJurisdictions.find((item) => {
      const provinceName = item.ecclesiastical_province_name
      return provinceName && (provinceName === requestedProvince || slugify(provinceName) === requestedProvince)
    })?.ecclesiastical_province_name ?? ''
    const initialJurisdictionId = countryJurisdictions.find((item) => (
      item.id === requestedJurisdictionId
      && (!initialProvince || item.ecclesiastical_province_name === initialProvince)
    ))?.id ?? ''

    return (
      <PublicDashboardShell
        initialCountry={initialCountry}
        initialData={initialData}
        initialDataComplete={false}
        initialJurisdictionId={initialJurisdictionId}
        initialParishId=""
        initialProvince={initialProvince}
        initialStructureNodeId=""
        initialSummary={initialSummary}
        initialView={initialView}
      />
    )
  } catch (error) {
    console.error('Unable to render the jurisdiction portal', error)
    return <main className="container"><div className="error-box">No se pudo cargar el plan de jurisdicciones. Intenta nuevamente.</div></main>
  }
}
