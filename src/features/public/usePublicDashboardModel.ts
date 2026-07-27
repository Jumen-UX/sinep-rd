'use client'

import { useMemo, useState } from 'react'
import type { PublicView } from '@/lib/public/dashboard'
import { personTypeLabel, views, type PersonCard, type Props } from './PublicDashboardShared'
import { buildPublicDashboardScope } from './buildPublicDashboardScope'

export function usePublicDashboardModel({ initialData, initialSummary, initialView, initialProvince }: Props) {
  const defaultCountry = initialData.countries.some((item) => item.key === 'DO')
    ? 'DO'
    : initialData.countries[0]?.key ?? 'DO'
  const [activeView, setActiveView] = useState<PublicView>(initialView)
  const [country, setCountry] = useState(defaultCountry)
  const [province, setProvince] = useState(initialProvince)
  const [jurisdictionId, setJurisdictionId] = useState('')
  const [personType, setPersonType] = useState('')
  const [pastoralLevel, setPastoralLevel] = useState('')

  const scope = useMemo(
    () => buildPublicDashboardScope(initialData, country, province, jurisdictionId),
    [country, initialData, jurisdictionId, province],
  )
  const countryName = initialData.countries.find((row) => row.key === country)?.name ?? 'República Dominicana'
  const countryPeople: PersonCard[] = initialData.people.map((item) => ({
    id: item.id,
    name: item.display_name,
    slug: item.slug,
    personType: item.person_type,
    role: personTypeLabel(item.person_type),
    scope: countryName,
  }))
  const territoriallyLinkedPeople = Array.from(new Map(
    [...scope.ordinaryPeople, ...scope.assignmentPeople].map((item) => [item.id, item]),
  ).values())
  const peopleBase = scope.scopeFiltered || country !== 'DO'
    ? territoriallyLinkedPeople
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
    || countryName
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
