import type { PublicView } from '@/lib/public/dashboard'

export type PublicDashboardUrlState = {
  activeView: PublicView
  country: string
  defaultCountry: string
  province: string
  jurisdictionId: string
}

function setOptionalParam(params: URLSearchParams, key: string, value: string, defaultValue = '') {
  if (value && value !== defaultValue) params.set(key, value)
  else params.delete(key)
}

export function buildPublicDashboardSearch(
  currentSearch: string,
  { activeView, country, defaultCountry, province, jurisdictionId }: PublicDashboardUrlState,
) {
  const params = new URLSearchParams(currentSearch)

  setOptionalParam(params, 'vista', activeView, 'territorial')
  setOptionalParam(params, 'pais', country, defaultCountry)
  setOptionalParam(params, 'provincia', province)
  setOptionalParam(params, 'jurisdiccion', jurisdictionId)

  return params.toString()
}
