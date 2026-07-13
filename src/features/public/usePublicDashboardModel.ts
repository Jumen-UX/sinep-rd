'use client'

import { useMemo, useState } from 'react'
import type { PublicView } from '@/lib/public/dashboard'
import { personTypeLabel, views, type PersonCard, type Props } from './PublicDashboardShared'
import { buildPublicDashboardScope } from './buildPublicDashboardScope'

export function usePublicDashboardModel({ initialData, initialSummary, initialView, initialProvince }: Props) {
  const [activeView, setActiveView] = useState<PublicView>(initialView)
  const [country, setCountry] = useState(initialData.countries[0]?.key ?? 'DO')
  const [province, setProvince] = useState(initialProvince)
  const [jurisdictionId, setJurisdictionId] = useState('')
  const [personType, setPersonType] = useState('')
  const [pastoralLevel, setPastoralLevel] = useState('')

  const scope = useMemo(
    () => buildPublicDashboardScope(initialData, country, province, jurisdictionId),
    [country, initialData, jurisdictionId, province],
  )
  const countryPeople: PersonCard[] = initialData.people.map((item) => ({
    id: item.id,
    name: item.display_name,
    slug: item.slug,
    personType: item.person_type,
    role: personTypeLabel(item.person_type),
    scope: initialData.countries.find((row) => row.key === country)?.name ?? 'República Dominicana',
  }))
  const peopleBase = scope.scopeFiltered
    ? [...scope.ordinaryPeople, ...scope.assignmentPeople]
    : countryPeople
  const visiblePeople = peopleBase.filter((item) => !personType || item.personType === personType).slice(0, 24)
  const administrativeUnits = initialData.organization_units.filter(
    (item) => !/(consejo|comisi[oó]n|comit[eé]|colegio|equipo)/i.test(item.name),
  )
  const collegialUnits = initialData.organization_units.filter(
    (item) => /(consejo|comisi[oó]n|comit[eé]|colegio|equipo)/i.test(item.name),
  )
  const scopeTitle = scope.selectedJurisdiction?.name
    || province
    || initialData.countries.find((item) => item.key === country)?.name
    || 'Ámbito seleccionado'
  const activeMeta = views.find((item) => item.key === activeView) ?? views[0]

  function resetScope() {
    setProvince('')
    setJurisdictionId('')
    setPersonType('')
    setPastoralLevel('')
  }

  return {
    initialData,
    initialSummary,
    activeView,
    setActiveView,
    country,
    setCountry,
    province,
    setProvince,
    jurisdictionId,
    setJurisdictionId,
    personType,
    setPersonType,
    pastoralLevel,
    setPastoralLevel,
    ...scope,
    visiblePeople,
    peopleBase,
    administrativeUnits,
    collegialUnits,
    scopeTitle,
    activeMeta,
    resetScope,
  }
}

export type PublicDashboardModel = ReturnType<typeof usePublicDashboardModel>
