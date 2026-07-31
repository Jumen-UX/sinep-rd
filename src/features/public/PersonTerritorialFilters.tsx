'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { PublicSearchableSelect, type PublicSearchableOption } from './PublicSearchableSelect'

type Props = {
  countryOptions: PublicSearchableOption[]
  dioceseOptions: PublicSearchableOption[]
  parishOptions: PublicSearchableOption[]
  selectedCountry: string
  selectedDiocese: string
  selectedParish: string
}

export function PersonTerritorialFilters({
  countryOptions,
  dioceseOptions,
  parishOptions,
  selectedCountry,
  selectedDiocese,
  selectedParish,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function updateScope(next: { country?: string; diocese?: string; parish?: string }) {
    const params = new URLSearchParams(searchParams.toString())
    const country = next.country ?? selectedCountry
    const diocese = next.diocese ?? selectedDiocese
    const parish = next.parish ?? selectedParish

    if (country) params.set('pais', country)
    else params.delete('pais')
    if (diocese) params.set('diocesis', diocese)
    else params.delete('diocesis')
    if (parish) params.set('parroquia', parish)
    else params.delete('parroquia')

    const query = params.toString()
    router.push(query ? `/personas?${query}` : '/personas')
  }

  return (
    <div className="public-filter-grid" aria-label="Filtros territoriales de personas">
      <PublicSearchableSelect
        label="País de servicio"
        onChange={(country) => updateScope({ country, diocese: '', parish: '' })}
        options={countryOptions}
        placeholder="Buscar país"
        value={selectedCountry}
      />
      <PublicSearchableSelect
        disabled={!selectedCountry}
        label="Diócesis o jurisdicción"
        onChange={(diocese) => updateScope({ diocese, parish: '' })}
        options={dioceseOptions}
        placeholder={selectedCountry ? 'Buscar diócesis' : 'Selecciona primero un país'}
        value={selectedDiocese}
      />
      <PublicSearchableSelect
        disabled={!selectedDiocese}
        label="Parroquia"
        onChange={(parish) => updateScope({ parish })}
        options={parishOptions}
        placeholder={selectedDiocese ? 'Buscar parroquia' : 'Selecciona primero una diócesis'}
        value={selectedParish}
      />
    </div>
  )
}
